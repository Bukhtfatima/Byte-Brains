from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    get_current_user,
    require_blood_bank_staff,
    require_authenticated,
)
from app.models.entities import BloodInventory, User, BloodBank
from app.models.enums import BloodGroup, InventoryStatus
from app.schemas.inventory import (
    BloodInventoryCreate,
    BloodInventoryUpdate,
    BloodInventoryRead,
    InventoryOverview,
)
from app.services.inventory_service import (
    get_system_thresholds,
    serialize_inventory_item,
    get_inventory_overview,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("", response_model=List[BloodInventoryRead])
def list_inventory(
    blood_group: Optional[BloodGroup] = None,
    status_filter: Optional[InventoryStatus] = Query(None, alias="status"),
    blood_bank_id: Optional[int] = None,
    expiry_urgency: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """
    List blood inventory batches with multi-dimensional filtering
    (blood group, status, blood bank, batch search, expiry).
    """
    _, warn_days, urg_days, crit_days = get_system_thresholds(db)

    query = db.query(BloodInventory)

    # Scoping for blood bank staff: default to their blood bank if specified
    if current_user.blood_bank_id and not blood_bank_id:
        query = query.filter(BloodInventory.blood_bank_id == current_user.blood_bank_id)
    elif blood_bank_id:
        query = query.filter(BloodInventory.blood_bank_id == blood_bank_id)

    if blood_group:
        query = query.filter(BloodInventory.blood_group == blood_group)

    if status_filter:
        query = query.filter(BloodInventory.status == status_filter)

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (BloodInventory.batch_id.ilike(search_fmt))
            | (BloodInventory.storage_location.ilike(search_fmt))
        )

    items = query.order_by(BloodInventory.expiry_date.asc()).all()

    # Filter by computed urgency if requested
    serialized = [
        serialize_inventory_item(item, warn_days, urg_days, crit_days)
        for item in items
    ]

    if expiry_urgency:
        serialized = [i for i in serialized if i.expiry_urgency.lower() == expiry_urgency.lower()]

    return serialized


@router.post("", response_model=BloodInventoryRead, status_code=status.HTTP_201_CREATED)
def add_inventory_batch(
    item_in: BloodInventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_blood_bank_staff),
):
    """Add a new blood donation batch into blood bank inventory."""
    # Ensure blood bank exists
    target_bb_id = item_in.blood_bank_id or current_user.blood_bank_id
    if not target_bb_id:
        first_bb = db.query(BloodBank).first()
        target_bb_id = first_bb.id if first_bb else 1

    item = BloodInventory(
        blood_group=item_in.blood_group,
        quantity=item_in.quantity,
        collection_date=item_in.collection_date,
        expiry_date=item_in.expiry_date,
        batch_id=item_in.batch_id,
        blood_bank_id=target_bb_id,
        storage_location=item_in.storage_location,
        status=item_in.status,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    log_action(
        db=db,
        action="INVENTORY_BATCH_ADDED",
        entity_type="BLOOD_INVENTORY",
        entity_id=str(item.id),
        description=f"Added {item.quantity} units of {item.blood_group.value} (Batch: {item.batch_id})",
        user_id=current_user.id,
    )

    _, warn_days, urg_days, crit_days = get_system_thresholds(db)
    return serialize_inventory_item(item, warn_days, urg_days, crit_days)


@router.get("/summary", response_model=InventoryOverview)
def get_summary(
    blood_bank_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Get aggregated stock overview, totals, and low-stock indicators."""
    bb_id = blood_bank_id or current_user.blood_bank_id
    return get_inventory_overview(db, blood_bank_id=bb_id)


@router.get("/low-stock")
def get_low_stock(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Return all blood groups currently below the configured safety threshold."""
    overview = get_inventory_overview(db, blood_bank_id=current_user.blood_bank_id)
    low_groups = [g for g in overview.by_blood_group if g.is_low_stock]
    return {
        "count": len(low_groups),
        "low_stock_groups": low_groups,
    }


@router.get("/expiring", response_model=List[BloodInventoryRead])
def get_expiring_inventory(
    days: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Get inventory batches expiring within warning or specified threshold."""
    _, warn_days, urg_days, crit_days = get_system_thresholds(db)
    target_days = days if days is not None else warn_days

    items = db.query(BloodInventory).filter(
        BloodInventory.status == InventoryStatus.AVAILABLE,
    ).all()

    today = date.today()
    results = []
    for item in items:
        delta = (item.expiry_date - today).days
        if 0 <= delta <= target_days:
            results.append(serialize_inventory_item(item, warn_days, urg_days, crit_days))

    return sorted(results, key=lambda x: x.days_until_expiry)


@router.get("/{item_id}", response_model=BloodInventoryRead)
def get_inventory_batch(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Get single batch by ID."""
    item = db.query(BloodInventory).filter(BloodInventory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory batch not found")

    _, warn_days, urg_days, crit_days = get_system_thresholds(db)
    return serialize_inventory_item(item, warn_days, urg_days, crit_days)


@router.put("/{item_id}", response_model=BloodInventoryRead)
def update_inventory_batch(
    item_id: int,
    item_update: BloodInventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_blood_bank_staff),
):
    """Update inventory batch (quantity, storage location, status, expiry date)."""
    item = db.query(BloodInventory).filter(BloodInventory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory batch not found")

    changes = []
    if item_update.quantity is not None:
        changes.append(f"quantity: {item.quantity} -> {item_update.quantity}")
        item.quantity = item_update.quantity
    if item_update.storage_location is not None:
        changes.append(f"location: {item.storage_location} -> {item_update.storage_location}")
        item.storage_location = item_update.storage_location
    if item_update.status is not None:
        changes.append(f"status: {item.status.value} -> {item_update.status.value}")
        item.status = item_update.status
    if item_update.expiry_date is not None:
        changes.append(f"expiry: {item.expiry_date} -> {item_update.expiry_date}")
        item.expiry_date = item_update.expiry_date

    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)

    log_action(
        db=db,
        action="INVENTORY_BATCH_UPDATED",
        entity_type="BLOOD_INVENTORY",
        entity_id=str(item.id),
        description=f"Updated batch {item.batch_id}: {', '.join(changes)}",
        user_id=current_user.id,
    )

    _, warn_days, urg_days, crit_days = get_system_thresholds(db)
    return serialize_inventory_item(item, warn_days, urg_days, crit_days)


@router.get("/coordination/{blood_group}")
def get_multi_bank_coordination(
    blood_group: BloodGroup,
    quantity_needed: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """
    Multi-Blood-Bank Coordination:
    Identify reported available inventory across authorized participating institutions.
    Strictly informative: DOES NOT automatically transfer or issue blood.
    """
    today = date.today()
    blood_banks = db.query(BloodBank).all()
    participating = []
    total_available_network = 0

    for bb in blood_banks:
        avail_units = (
            db.query(BloodInventory)
            .filter(
                BloodInventory.blood_bank_id == bb.id,
                BloodInventory.blood_group == blood_group,
                BloodInventory.status == InventoryStatus.AVAILABLE,
                BloodInventory.expiry_date >= today,
            )
            .all()
        )
        total_units = sum(i.quantity for i in avail_units)
        total_available_network += total_units

        participating.append({
            "blood_bank_id": bb.id,
            "blood_bank_name": bb.name,
            "location": bb.location,
            "contact_information": bb.contact_information,
            "available_units": total_units,
            "can_fulfill_partial": total_units > 0,
            "can_fulfill_full": (total_units >= quantity_needed) if quantity_needed else False,
        })

    return {
        "blood_group": blood_group.value,
        "quantity_needed": quantity_needed,
        "total_network_available": total_available_network,
        "can_fulfill_across_network": (total_available_network >= quantity_needed) if quantity_needed else False,
        "policy_notice": "Coordination data is advisory. Human authorization is strictly required to transfer or issue blood.",
        "participating_blood_banks": participating,
    }

