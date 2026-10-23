import json
from datetime import datetime, date, timedelta
import random
from sqlalchemy.orm import Session
from app.models.entities import (
    Hospital,
    BloodBank,
    User,
    BloodInventory,
    BloodRequest,
    DemandHistory,
    SystemSetting,
    AuditLog,
    Donor,
    Donation,
)
from app.models.enums import (
    UserRole,
    OrgType,
    BloodGroup,
    InventoryStatus,
    RequestStatus,
    RequestPriority,
    DonorStatus,
    Gender,
)
from app.services.auth_service import hash_password


def seed_database(db: Session) -> dict:
    """Populates database with complete realistic seed dataset if empty."""
    # Ensure donors seeded if missing
    seed_donors_if_empty(db)

    # Check if already seeded
    existing_users = db.query(User).first()
    if existing_users:
        return {"status": "already_seeded"}

    print("[Seed] Initializing BloodBridge database seed data...")

    # 1. Hospitals (3)
    hospitals = [
        Hospital(
            name="City General Hospital",
            location="100 Metro Central Ave, Downtown",
            contact_information="contact@citygeneral.health | +1-555-0101",
        ),
        Hospital(
            name="St. Jude Memorial Hospital",
            location="45 Highland Parkway, North District",
            contact_information="er@stjude.health | +1-555-0102",
        ),
        Hospital(
            name="Metro Trauma Center",
            location="800 South Expressway, South Sector",
            contact_information="trauma@metrotrauma.org | +1-555-0103",
        ),
    ]
    db.add_all(hospitals)
    db.flush()

    # 2. Blood Banks (2)
    blood_banks = [
        BloodBank(
            name="Central Blood Bank",
            location="12 Medical Plaza, Downtown",
            contact_information="operations@centralbloodbank.org | +1-555-0201",
        ),
        BloodBank(
            name="Red Cross Regional Blood Center",
            location="340 West Boulevard, West District",
            contact_information="dispatch@redcrossregional.org | +1-555-0202",
        ),
    ]
    db.add_all(blood_banks)
    db.flush()

    # 3. Default System Settings (Thresholds)
    default_stock_thresholds = {
        "O+": 20,
        "O-": 10,
        "A+": 20,
        "A-": 10,
        "B+": 20,
        "B-": 10,
        "AB+": 10,
        "AB-": 5,
    }
    settings = [
        SystemSetting(
            key="min_stock_thresholds",
            value=json.dumps(default_stock_thresholds),
            description="Minimum safety stock thresholds per blood group (units)",
        ),
        SystemSetting(
            key="expiry_warning_days",
            value="14",
            description="Days until expiry for Warning alert",
        ),
        SystemSetting(
            key="expiry_urgent_days",
            value="7",
            description="Days until expiry for Urgent alert",
        ),
        SystemSetting(
            key="expiry_critical_days",
            value="3",
            description="Days until expiry for Critical alert",
        ),
    ]
    db.add_all(settings)
    db.flush()

    # 4. Users (Demonstration accounts with secure hashed passwords)
    # Passwords:
    # Admin: admin123
    # Blood Bank Staff: bloodbank123
    # Hospital Staff: hospital123
    users = [
        User(
            name="Dr. Eleanor Vance (System Admin)",
            email="admin@bloodbridge.org",
            password_hash=hash_password("admin123"),
            role=UserRole.ADMIN,
            is_active=True,
        ),
        User(
            name="Marcus Chen (Lead Blood Bank Officer)",
            email="bloodbank@bloodbridge.org",
            password_hash=hash_password("bloodbank123"),
            role=UserRole.BLOOD_BANK_STAFF,
            organization_type=OrgType.BLOOD_BANK,
            blood_bank_id=blood_banks[0].id,
            is_active=True,
        ),
        User(
            name="Sarah Jenkins, RN (Head Trauma Coordinator)",
            email="hospital@bloodbridge.org",
            password_hash=hash_password("hospital123"),
            role=UserRole.HOSPITAL_STAFF,
            organization_type=OrgType.HOSPITAL,
            hospital_id=hospitals[0].id,
            is_active=True,
        ),
        User(
            name="Dr. David Ross (St. Jude ER Director)",
            email="hospital2@bloodbridge.org",
            password_hash=hash_password("hospital123"),
            role=UserRole.HOSPITAL_STAFF,
            organization_type=OrgType.HOSPITAL,
            hospital_id=hospitals[1].id,
            is_active=True,
        ),
        User(
            name="Kavita Patel (Regional Blood Dispatcher)",
            email="bloodbank2@bloodbridge.org",
            password_hash=hash_password("bloodbank123"),
            role=UserRole.BLOOD_BANK_STAFF,
            organization_type=OrgType.BLOOD_BANK,
            blood_bank_id=blood_banks[1].id,
            is_active=True,
        ),
    ]
    db.add_all(users)
    db.flush()

    # 5. Inventory Batches
    # Blood shelf life is ~35-42 days for packed red cells
    today = date.today()
    inventory_items = []
    batch_counter = 1001

    # Central Blood Bank inventory
    # Specific targeted statuses:
    # O-: Low stock (8 units total, 2 expiring in 4 days) -> trigger low stock & shortage risk demo
    # O+: Healthy stock (32 units)
    # A+: Normal stock (24 units)
    # A-: Expiring soon (6 units expiring in 2 days - Critical)
    # B+: Healthy stock (22 units)
    # B-: Low stock (6 units)
    # AB+: Adequate (12 units)
    # AB-: Very Low stock (2 units)
    
    inventory_configs = [
        # BloodGroup, Quantity, DaysAgoCollected, DaysUntilExpiry, Status, Location, BloodBankIndex
        # O- batches: low total available
        (BloodGroup.O_NEG, 5, 20, 22, InventoryStatus.AVAILABLE, "Refrig-A1", 0),
        (BloodGroup.O_NEG, 3, 37, 4, InventoryStatus.AVAILABLE, "Refrig-A2", 0),  # Expiring in 4 days
        (BloodGroup.O_NEG, 2, 43, -1, InventoryStatus.EXPIRED, "Quarantine-Q1", 0), # Expired yesterday
        
        # O+ batches: plentiful
        (BloodGroup.O_POS, 15, 10, 32, InventoryStatus.AVAILABLE, "Refrig-B1", 0),
        (BloodGroup.O_POS, 12, 18, 24, InventoryStatus.AVAILABLE, "Refrig-B2", 0),
        (BloodGroup.O_POS, 5, 5, 37, InventoryStatus.RESERVED, "Refrig-B3", 0),

        # A+ batches
        (BloodGroup.A_POS, 14, 12, 30, InventoryStatus.AVAILABLE, "Refrig-C1", 0),
        (BloodGroup.A_POS, 10, 22, 20, InventoryStatus.AVAILABLE, "Refrig-C2", 0),

        # A- batches: critical expiry demo
        (BloodGroup.A_NEG, 6, 40, 2, InventoryStatus.AVAILABLE, "Refrig-C3", 0),  # Critical expiry in 2 days
        (BloodGroup.A_NEG, 8, 15, 27, InventoryStatus.AVAILABLE, "Refrig-C4", 0),

        # B+ batches
        (BloodGroup.B_POS, 12, 8, 34, InventoryStatus.AVAILABLE, "Refrig-D1", 0),
        (BloodGroup.B_POS, 10, 16, 26, InventoryStatus.AVAILABLE, "Refrig-D2", 0),

        # B- batches: low
        (BloodGroup.B_NEG, 6, 14, 28, InventoryStatus.AVAILABLE, "Refrig-D3", 0),

        # AB+ batches
        (BloodGroup.AB_POS, 12, 10, 32, InventoryStatus.AVAILABLE, "Refrig-E1", 0),

        # AB- batches: critically low
        (BloodGroup.AB_NEG, 2, 25, 17, InventoryStatus.AVAILABLE, "Refrig-E2", 0),

        # Second Blood Bank (Red Cross)
        (BloodGroup.O_POS, 20, 12, 30, InventoryStatus.AVAILABLE, "RedCross-Bay1", 1),
        (BloodGroup.O_NEG, 6, 15, 27, InventoryStatus.AVAILABLE, "RedCross-Bay2", 1),
        (BloodGroup.A_POS, 16, 14, 28, InventoryStatus.AVAILABLE, "RedCross-Bay3", 1),
        (BloodGroup.B_POS, 14, 10, 32, InventoryStatus.AVAILABLE, "RedCross-Bay4", 1),
    ]

    for bg, qty, days_ago, days_to_exp, status, loc, bb_idx in inventory_configs:
        c_date = today - timedelta(days=days_ago)
        e_date = today + timedelta(days=days_to_exp)
        inventory_items.append(
            BloodInventory(
                blood_group=bg,
                quantity=qty,
                collection_date=c_date,
                expiry_date=e_date,
                batch_id=f"BATCH-2026-{batch_counter}",
                blood_bank_id=blood_banks[bb_idx].id,
                storage_location=loc,
                status=status,
            )
        )
        batch_counter += 1

    db.add_all(inventory_items)
    db.flush()

    # 6. Blood Requests (Demonstrating various priorities, statuses, and hospitals)
    now = datetime.utcnow()
    requests = [
        BloodRequest(
            hospital_id=hospitals[0].id,
            blood_bank_id=blood_banks[0].id,
            blood_group=BloodGroup.O_NEG,
            quantity=3,
            priority=RequestPriority.CRITICAL,
            required_datetime=now + timedelta(hours=2),
            notes="Active internal hemorrhage in Trauma Bay 1. Emergency transfusion required.",
            status=RequestStatus.SUBMITTED,
        ),
        BloodRequest(
            hospital_id=hospitals[0].id,
            blood_bank_id=blood_banks[0].id,
            blood_group=BloodGroup.A_POS,
            quantity=4,
            priority=RequestPriority.URGENT,
            required_datetime=now + timedelta(hours=6),
            notes="Scheduled cardiac bypass surgery patient with borderline hemoglobin.",
            status=RequestStatus.REVIEWING,
        ),
        BloodRequest(
            hospital_id=hospitals[1].id,
            blood_bank_id=blood_banks[0].id,
            blood_group=BloodGroup.B_POS,
            quantity=2,
            priority=RequestPriority.NORMAL,
            required_datetime=now + timedelta(days=1),
            notes="Oncology ward scheduled replenishment.",
            status=RequestStatus.APPROVED,
        ),
        BloodRequest(
            hospital_id=hospitals[0].id,
            blood_bank_id=blood_banks[0].id,
            blood_group=BloodGroup.O_POS,
            quantity=5,
            priority=RequestPriority.URGENT,
            required_datetime=now - timedelta(days=1),
            notes="Multiple vehicle collision patient replenishment.",
            status=RequestStatus.FULFILLED,
            fulfilled_quantity=5,
        ),
        BloodRequest(
            hospital_id=hospitals[2].id,
            blood_bank_id=blood_banks[1].id,
            blood_group=BloodGroup.AB_NEG,
            quantity=2,
            priority=RequestPriority.CRITICAL,
            required_datetime=now + timedelta(hours=4),
            notes="Rare blood type obstetric emergency.",
            status=RequestStatus.SUBMITTED,
        ),
    ]
    db.add_all(requests)
    db.flush()

    # 7. Demand History (4 months / ~120 days of synthetic historical usage)
    # Realistic consumption pattern: O+ and A+ highest usage, O- steady trauma usage
    demand_records = []
    random.seed(42)  # Deterministic seed for reproducible results

    # Base average daily demand per group
    base_demands = {
        BloodGroup.O_POS: 4.5,
        BloodGroup.O_NEG: 2.2,
        BloodGroup.A_POS: 3.8,
        BloodGroup.A_NEG: 1.2,
        BloodGroup.B_POS: 3.0,
        BloodGroup.B_NEG: 0.8,
        BloodGroup.AB_POS: 1.5,
        BloodGroup.AB_NEG: 0.4,
    }

    start_date = today - timedelta(days=120)
    for day_offset in range(121):
        current_day = start_date + timedelta(days=day_offset)
        # Weekday multiplier: trauma/surgeries slightly higher on Fridays/Saturdays
        day_of_week = current_day.weekday()
        multiplier = 1.25 if day_of_week in (4, 5) else 1.0

        for bg, base in base_demands.items():
            # Add Poisson-like or Gaussian variation
            variance = random.uniform(0.6, 1.4)
            units = max(0, int(round(base * multiplier * variance)))
            if units > 0:
                h_id = random.choice([h.id for h in hospitals])
                bb_id = blood_banks[0].id if random.random() < 0.7 else blood_banks[1].id
                demand_records.append(
                    DemandHistory(
                        blood_group=bg,
                        date=current_day,
                        units_used=units,
                        hospital_id=h_id,
                        blood_bank_id=bb_id,
                    )
                )

    db.add_all(demand_records)
    db.flush()

    # 8. Seed Initial Audit Logs
    audit_entries = [
        AuditLog(
            user_id=users[0].id,
            action="SYSTEM_INIT",
            entity_type="SYSTEM",
            entity_id="0",
            description="BloodBridge database initialized with seed organizations, inventory, and security policies.",
            timestamp=datetime.utcnow() - timedelta(hours=24),
        ),
        AuditLog(
            user_id=users[1].id,
            action="BATCH_ADDED",
            entity_type="INVENTORY",
            entity_id=inventory_items[0].batch_id,
            description="Logged incoming whole blood donation batch for O- blood group.",
            timestamp=datetime.utcnow() - timedelta(hours=18),
        ),
        AuditLog(
            user_id=users[2].id,
            action="REQUEST_SUBMITTED",
            entity_type="BLOOD_REQUEST",
            entity_id=str(requests[0].id),
            description="Submitted CRITICAL blood request for 3 units of O- for Trauma Bay 1.",
            timestamp=datetime.utcnow() - timedelta(hours=2),
        ),
    ]
    db.add_all(audit_entries)

    db.commit()
    print("[Seed] Successfully seeded BloodBridge with comprehensive test data.")
    return {
        "status": "success",
        "hospitals": len(hospitals),
        "blood_banks": len(blood_banks),
        "users": len(users),
        "inventory_batches": len(inventory_items),
        "blood_requests": len(requests),
        "demand_records": len(demand_records),
    }


def seed_donors_if_empty(db: Session):
    """Seed initial donors and past donation records if none exist."""
    try:
        if db.query(Donor).first():
            return

        print("[Seed] Populating initial Donor profiles & history...")
        bb = db.query(BloodBank).first()
        bb_id = bb.id if bb else 1

        donors_data = [
            Donor(
                name="Sarah Jenkins",
                blood_group=BloodGroup.O_NEG,
                gender=Gender.FEMALE,
                date_of_birth=date(1992, 4, 15),
                phone="+1-555-0321",
                email="sarah.jenkins@example.com",
                address="742 Evergreen Terrace, Downtown",
                status=DonorStatus.ACTIVE,
                last_donation_date=date.today() - timedelta(days=70),  # Eligible!
                medical_notes="Universal donor. Verified Rh-negative. Good venous access.",
            ),
            Donor(
                name="Marcus Aurelius Vance",
                blood_group=BloodGroup.O_POS,
                gender=Gender.MALE,
                date_of_birth=date(1988, 11, 23),
                phone="+1-555-0322",
                email="marcus.vance@example.com",
                address="1200 Riverside Dr, Apt 4B",
                status=DonorStatus.ACTIVE,
                last_donation_date=date.today() - timedelta(days=20),  # Deferred (36 days left)
                medical_notes="Regular donor. Hb 15.2 g/dL on last intake.",
            ),
            Donor(
                name="Amina El-Sayed",
                blood_group=BloodGroup.A_POS,
                gender=Gender.FEMALE,
                date_of_birth=date(1995, 7, 8),
                phone="+1-555-0323",
                email="amina.sayed@example.com",
                address="58 Oak Hill Blvd, North District",
                status=DonorStatus.ACTIVE,
                last_donation_date=date.today() - timedelta(days=95),  # Eligible!
                medical_notes="Platelet & whole blood volunteer. No adverse reactions.",
            ),
            Donor(
                name="David Chen",
                blood_group=BloodGroup.B_POS,
                gender=Gender.MALE,
                date_of_birth=date(1990, 2, 19),
                phone="+1-555-0324",
                email="david.chen@example.com",
                address="310 University Ave, Tech District",
                status=DonorStatus.ACTIVE,
                last_donation_date=None,  # First time, 100% Eligible!
                medical_notes="New registrant. Completed health questionnaire.",
            ),
            Donor(
                name="Elena Rostova",
                blood_group=BloodGroup.AB_NEG,
                gender=Gender.FEMALE,
                date_of_birth=date(1985, 9, 30),
                phone="+1-555-0325",
                email="elena.rostova@example.com",
                address="90 Harbor View Way, West Bay",
                status=DonorStatus.ACTIVE,
                last_donation_date=date.today() - timedelta(days=62),  # Eligible (Rare type!)
                medical_notes="Rare group donor (AB-). On priority emergency contact roster.",
            ),
            Donor(
                name="Tariq Mahmood",
                blood_group=BloodGroup.A_NEG,
                gender=Gender.MALE,
                date_of_birth=date(1993, 1, 14),
                phone="+1-555-0326",
                email="tariq.m@example.com",
                address="450 Central Market St",
                status=DonorStatus.ACTIVE,
                last_donation_date=date.today() - timedelta(days=12),  # Deferred (44 days left)
                medical_notes="Healthy donor. BP consistently 120/80.",
            ),
        ]
        db.add_all(donors_data)
        db.flush()

        # Add initial past donation records for Sarah & Marcus
        donations = [
            Donation(
                donor_id=donors_data[0].id,
                blood_bank_id=bb_id,
                blood_group=BloodGroup.O_NEG,
                units=1,
                donation_date=date.today() - timedelta(days=70),
                hemoglobin=14.1,
                blood_pressure="118/76",
                notes="Standard whole blood collection. 450 mL.",
            ),
            Donation(
                donor_id=donors_data[1].id,
                blood_bank_id=bb_id,
                blood_group=BloodGroup.O_POS,
                units=1,
                donation_date=date.today() - timedelta(days=20),
                hemoglobin=15.2,
                blood_pressure="122/80",
                notes="Routine donation. Tolerated well.",
            ),
        ]
        db.add_all(donations)
        db.commit()
        print(f"[Seed] Successfully seeded {len(donors_data)} donors and past donation records.")
    except Exception as e:
        print(f"[Seed] Note: Donor seed skipped or error: {e}")
        try:
            db.rollback()
        except Exception:
            pass
