import json
from datetime import date, datetime
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.entities import BloodInventory, SystemSetting
from app.models.enums import BloodGroup, InventoryStatus
from app.schemas.inventory import (
    BloodInventoryRead,
    BloodGroupStockSummary,
    InventoryOverview,
)


def get_system_thresholds(db: Session) -> Tuple[Dict[str, int], int, int, int]:
    """Retrieve dynamic thresholds configured by system administrator."""
    default_stock = {
        "O+": 20,
        "O-": 10,
        "A+": 20,
        "A-": 10,
        "B+": 20,
        "B-": 10,
        "AB+": 10,
        "AB-": 5,
    }
    warn_days = 14
    urg_days = 7
    crit_days = 3

    stock_row = db.query(SystemSetting).filter(SystemSetting.key == "min_stock_thresholds").first()
    if stock_row:
        try:
            default_stock = json.loads(stock_row.value)
        except Exception:
            pass

    w_row = db.query(SystemSetting).filter(SystemSetting.key == "expiry_warning_days").first()
    if w_row:
        try:
            warn_days = int(w_row.value)
        except Exception:
            pass

    u_row = db.query(SystemSetting).filter(SystemSetting.key == "expiry_urgent_days").first()
    if u_row:
        try:
            urg_days = int(u_row.value)
        except Exception:
            pass

    c_row = db.query(SystemSetting).filter(SystemSetting.key == "expiry_critical_days").first()
    if c_row:
        try:
            crit_days = int(c_row.value)
        except Exception:
            pass

    return default_stock, warn_days, urg_days, crit_days


def calculate_expiry_metadata(
    item: BloodInventory,
    warn_days: int = 14,
    urg_days: int = 7,
    crit_days: int = 3,
) -> Tuple[int, str]:
    """Dynamically calculates days until expiry and operational urgency."""
    today = date.today()
    delta = (item.expiry_date - today).days

    if delta < 0 or item.status == InventoryStatus.EXPIRED:
        urgency = "Expired"
    elif delta <= crit_days:
        urgency = "Critical"
    elif delta <= urg_days:
        urgency = "Urgent"
    elif delta <= warn_days:
        urgency = "Warning"
    else:
        urgency = "Normal"

    return delta, urgency


def serialize_inventory_item(
    item: BloodInventory,
    warn_days: int = 14,
    urg_days: int = 7,
    crit_days: int = 3,
) -> BloodInventoryRead:
    delta, urgency = calculate_expiry_metadata(item, warn_days, urg_days, crit_days)
    bank_name = item.blood_bank.name if item.blood_bank else None
    return BloodInventoryRead(
        id=item.id,
        blood_group=item.blood_group,
        quantity=item.quantity,
        collection_date=item.collection_date,
        expiry_date=item.expiry_date,
        batch_id=item.batch_id,
        blood_bank_id=item.blood_bank_id,
        blood_bank_name=bank_name,
        storage_location=item.storage_location,
        status=item.status,
        days_until_expiry=delta,
        expiry_urgency=urgency,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def get_inventory_overview(
    db: Session,
    blood_bank_id: Optional[int] = None,
) -> InventoryOverview:
    """Calculates comprehensive inventory summary, low-stock flags, and expiry metrics."""
    min_thresholds, warn_days, urg_days, crit_days = get_system_thresholds(db)

    query = db.query(BloodInventory)
    if blood_bank_id:
        query = query.filter(BloodInventory.blood_bank_id == blood_bank_id)
    items = query.all()

    total_avail = 0
    total_res = 0
    total_exp = 0
    expiring_soon = 0
    critical_exp = 0

    group_stats: Dict[str, Dict[str, int]] = {
        bg.value: {"available": 0, "reserved": 0, "expired": 0, "total": 0}
        for bg in BloodGroup
    }

    today = date.today()

    for item in items:
        bg_str = item.blood_group.value
        days_left = (item.expiry_date - today).days

        # Auto-detect expired if still marked available
        is_expired = days_left < 0 or item.status == InventoryStatus.EXPIRED

        if is_expired:
            group_stats[bg_str]["expired"] += item.quantity
            total_exp += item.quantity
        elif item.status == InventoryStatus.RESERVED:
            group_stats[bg_str]["reserved"] += item.quantity
            total_res += item.quantity
        elif item.status == InventoryStatus.AVAILABLE:
            group_stats[bg_str]["available"] += item.quantity
            total_avail += item.quantity

            if days_left <= crit_days:
                critical_exp += item.quantity
            if days_left <= warn_days:
                expiring_soon += item.quantity

        group_stats[bg_str]["total"] += item.quantity

    by_group = []
    low_stock_count = 0

    for bg in BloodGroup:
        bg_val = bg.value
        avail = group_stats[bg_val]["available"]
        thresh = min_thresholds.get(bg_val, 10)
        is_low = avail < thresh
        if is_low:
            low_stock_count += 1

        by_group.append(
            BloodGroupStockSummary(
                blood_group=bg_val,
                available_units=avail,
                reserved_units=group_stats[bg_val]["reserved"],
                expired_units=group_stats[bg_val]["expired"],
                total_units=group_stats[bg_val]["total"],
                min_threshold=thresh,
                is_low_stock=is_low,
            )
        )

    return InventoryOverview(
        total_available_units=total_avail,
        total_reserved_units=total_res,
        total_expired_units=total_exp,
        low_stock_groups_count=low_stock_count,
        expiring_soon_count=expiring_soon,
        critical_expiry_count=critical_exp,
        by_blood_group=by_group,
    )
