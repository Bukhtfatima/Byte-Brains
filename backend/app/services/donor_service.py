from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.entities import Donor, Donation, BloodInventory, BloodBank
from app.models.enums import DonorStatus, InventoryStatus, BloodGroup
from app.schemas.donor import DonorCreate, DonorUpdate, DonationRecordCreate
from app.services.audit_service import log_action
from app.services.websocket_manager import ws_manager
import uuid
import asyncio


WHO_DONATION_INTERVAL_DAYS = 56
WHOLE_BLOOD_SHELF_LIFE_DAYS = 42


def calculate_donor_eligibility(donor: Donor) -> Tuple[bool, int, Optional[date]]:
    """
    Computes eligibility status based on WHO 56-day cooldown rule:
    Returns: (is_eligible, days_until_eligible, next_eligible_date)
    """
    if donor.status != DonorStatus.ACTIVE:
        return False, 999, None

    if not donor.last_donation_date:
        return True, 0, date.today()

    next_date = donor.last_donation_date + timedelta(days=WHO_DONATION_INTERVAL_DAYS)
    today = date.today()
    if today >= next_date:
        return True, 0, today
    else:
        days_left = (next_date - today).days
        return False, days_left, next_date


def enrich_donor_data(donor: Donor) -> Dict[str, Any]:
    """Helper to convert ORM Donor to response dict with eligibility metrics."""
    is_eligible, days_left, next_date = calculate_donor_eligibility(donor)
    total_donations = len(donor.donations) if donor.donations else 0
    return {
        "id": donor.id,
        "name": donor.name,
        "blood_group": donor.blood_group,
        "gender": donor.gender,
        "date_of_birth": donor.date_of_birth,
        "phone": donor.phone,
        "email": donor.email,
        "address": donor.address,
        "status": donor.status,
        "last_donation_date": donor.last_donation_date,
        "medical_notes": donor.medical_notes,
        "is_eligible": is_eligible,
        "days_until_eligible": days_left,
        "next_eligible_date": next_date,
        "total_donations": total_donations,
        "created_at": donor.created_at,
        "updated_at": donor.updated_at,
    }


def get_donors(
    db: Session,
    blood_group: Optional[str] = None,
    status: Optional[str] = None,
    eligible_only: bool = False,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    query = db.query(Donor)

    if blood_group:
        query = query.filter(Donor.blood_group == blood_group)
    if status:
        query = query.filter(Donor.status == status)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Donor.name.ilike(search_filter))
            | (Donor.phone.ilike(search_filter))
            | (Donor.email.ilike(search_filter))
        )

    donors = query.order_by(desc(Donor.created_at)).all()
    results = [enrich_donor_data(d) for d in donors]

    if eligible_only:
        results = [d for d in results if d["is_eligible"]]

    return results


def get_donor_by_id(db: Session, donor_id: int) -> Optional[Donor]:
    return db.query(Donor).filter(Donor.id == donor_id).first()


def create_donor(db: Session, donor_in: DonorCreate, user_id: Optional[int] = None) -> Donor:
    donor = Donor(
        name=donor_in.name,
        blood_group=donor_in.blood_group,
        gender=donor_in.gender,
        date_of_birth=donor_in.date_of_birth,
        phone=donor_in.phone,
        email=donor_in.email,
        address=donor_in.address,
        medical_notes=donor_in.medical_notes,
        status=DonorStatus.ACTIVE,
    )
    db.add(donor)
    db.commit()
    db.refresh(donor)

    log_action(
        db=db,
        action="REGISTER_DONOR",
        entity_type="Donor",
        entity_id=str(donor.id),
        description=f"Registered new donor {donor.name} ({donor.blood_group})",
        user_id=user_id,
    )

    # Broadcast notification to staff
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(
                ws_manager.broadcast({
                    "type": "DONOR_REGISTERED",
                    "title": "New Donor Registered",
                    "message": f"{donor.name} ({donor.blood_group.value}) has been registered.",
                    "severity": "info",
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
                })
            )
    except Exception:
        pass

    return donor


def update_donor(
    db: Session, donor: Donor, donor_in: DonorUpdate, user_id: Optional[int] = None
) -> Donor:
    update_data = donor_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(donor, field, value)

    db.commit()
    db.refresh(donor)

    log_action(
        db=db,
        action="UPDATE_DONOR",
        entity_type="Donor",
        entity_id=str(donor.id),
        description=f"Updated donor record for {donor.name}",
        user_id=user_id,
    )
    return donor


def record_donation(
    db: Session,
    donor: Donor,
    donation_in: DonationRecordCreate,
    user_id: Optional[int] = None,
) -> Tuple[Donation, BloodInventory]:
    """
    Records a donation:
    1. Validates eligibility
    2. Auto-creates a new BloodInventory batch (collection_date=today, expiry=+42d)
    3. Creates Donation record linked to inventory
    4. Updates donor's last_donation_date
    5. Dispatches real-time WebSocket alert
    """
    is_eligible, days_left, next_date = calculate_donor_eligibility(donor)
    if not is_eligible:
        raise ValueError(f"Donor is not currently eligible to donate. Wait {days_left} more days (eligible on {next_date}).")

    donation_dt = donation_in.donation_date or date.today()
    expiry_dt = donation_dt + timedelta(days=WHOLE_BLOOD_SHELF_LIFE_DAYS)
    batch_code = f"BATCH-DON-{donor.blood_group.value.replace('+', 'POS').replace('-', 'NEG')}-{uuid.uuid4().hex[:6].upper()}"

    # Auto-create BloodInventory batch
    inventory_batch = BloodInventory(
        blood_group=donor.blood_group,
        quantity=donation_in.units,
        collection_date=donation_dt,
        expiry_date=expiry_dt,
        batch_id=batch_code,
        blood_bank_id=donation_in.blood_bank_id,
        storage_location="Donor-Intake-Bay",
        status=InventoryStatus.AVAILABLE,
    )
    db.add(inventory_batch)
    db.flush()

    # Create Donation entity
    donation = Donation(
        donor_id=donor.id,
        blood_bank_id=donation_in.blood_bank_id,
        blood_inventory_id=inventory_batch.id,
        blood_group=donor.blood_group,
        units=donation_in.units,
        donation_date=donation_dt,
        hemoglobin=donation_in.hemoglobin,
        blood_pressure=donation_in.blood_pressure,
        notes=donation_in.notes,
    )
    db.add(donation)

    # Update donor record
    donor.last_donation_date = donation_dt
    db.commit()
    db.refresh(donation)
    db.refresh(inventory_batch)

    log_action(
        db=db,
        action="RECORD_DONATION",
        entity_type="Donation",
        entity_id=str(donation.id),
        description=f"Recorded donation: {donation.units} unit(s) of {donor.blood_group} from {donor.name} -> Batch {batch_code}",
        user_id=user_id,
    )

    # Broadcast real-time WebSocket alert
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(
                ws_manager.broadcast({
                    "type": "DONATION_RECEIVED",
                    "title": "New Blood Donation Received",
                    "message": f"{donor.name} donated {donation.units} unit(s) of {donor.blood_group.value}. Added to stock (Batch {batch_code}).",
                    "severity": "success",
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
                })
            )
    except Exception:
        pass

    return donation, inventory_batch
