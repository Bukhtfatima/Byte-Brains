from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.entities import (
    BloodInventory,
    BloodRequest,
    DemandHistory,
    Hospital,
    BloodBank,
    Donor,
    Donation,
    User,
)
from app.models.enums import BloodGroup, InventoryStatus, RequestStatus, RequestPriority, UserRole


def compute_hospital_analytics(db: Session, hospital_id: Optional[int] = None) -> Dict[str, Any]:
    """Analytics scoped specifically for Hospital clinical operations."""
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    all_groups = [g.value for g in BloodGroup]

    # Resolve Hospital Name
    hospital_name = "All Network Hospitals"
    if hospital_id:
        h = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if h:
            hospital_name = h.name

    # 1. Hospital Requests query
    req_query = db.query(BloodRequest)
    if hospital_id:
        req_query = req_query.filter(BloodRequest.hospital_id == hospital_id)
    requests = req_query.all()

    total_requests = len(requests)
    fulfilled = [r for r in requests if r.status == RequestStatus.FULFILLED]
    partially = [r for r in requests if r.status == RequestStatus.PARTIALLY_FULFILLED]
    pending = [r for r in requests if r.status in [RequestStatus.SUBMITTED, RequestStatus.REVIEWING, RequestStatus.APPROVED]]
    cancelled = [r for r in requests if r.status == RequestStatus.CANCELLED]

    emergency_critical = sum(1 for r in requests if r.priority == RequestPriority.CRITICAL)
    emergency_urgent = sum(1 for r in requests if r.priority == RequestPriority.URGENT)
    normal_priority = sum(1 for r in requests if r.priority == RequestPriority.NORMAL)

    total_units_requested = sum(r.quantity for r in requests)
    total_units_fulfilled = sum(r.fulfilled_quantity for r in requests)
    fulfillment_rate = round(((len(fulfilled) + (0.5 * len(partially))) / max(1, total_requests)) * 100, 1)

    # 2. Daily Transfusion Trend (14 days up to latest recorded data)
    max_history_date = db.query(func.max(DemandHistory.date)).scalar() or today
    trend_query = db.query(DemandHistory.date, func.sum(DemandHistory.units_used).label("units")).filter(
        DemandHistory.date >= (max_history_date - timedelta(days=14))
    )
    if hospital_id:
        trend_query = trend_query.filter(DemandHistory.hospital_id == hospital_id)
    daily_rows = trend_query.group_by(DemandHistory.date).order_by(DemandHistory.date.asc()).all()

    daily_usage_trend = [{"date": str(r[0]), "units_transfused": int(r[1])} for r in daily_rows]

    # 3. Demand by Blood Group (30 days up to latest recorded data)
    group_query = db.query(DemandHistory.blood_group, func.sum(DemandHistory.units_used).label("total_units")).filter(
        DemandHistory.date >= (max_history_date - timedelta(days=30))
    )
    if hospital_id:
        group_query = group_query.filter(DemandHistory.hospital_id == hospital_id)
    usage_by_group = group_query.group_by(DemandHistory.blood_group).all()

    usage_map = {g: 0 for g in all_groups}
    for bg, count in usage_by_group:
        bg_str = bg.value if hasattr(bg, "value") else str(bg)
        usage_map[bg_str] = int(count or 0)

    total_demand_30d = sum(usage_map.values())
    demand_by_blood_group = [
        {
            "blood_group": bg,
            "units_used": usage_map[bg],
            "percentage": round((usage_map[bg] / max(1, total_demand_30d)) * 100, 1),
        }
        for bg in all_groups
    ]

    return {
        "scope": "hospital",
        "hospital_name": hospital_name,
        "hospital_id": hospital_id,
        "summary": {
            "total_requests": total_requests,
            "fulfilled_requests_count": len(fulfilled),
            "pending_requests_count": len(pending),
            "cancelled_requests_count": len(cancelled),
            "emergency_critical_count": emergency_critical,
            "emergency_urgent_count": emergency_urgent,
            "fulfillment_rate_pct": fulfillment_rate,
            "total_units_requested": total_units_requested,
            "total_units_received": total_units_fulfilled,
            "total_30d_transfused_units": total_demand_30d,
        },
        "daily_transfusion_trend": daily_usage_trend,
        "demand_by_blood_group": demand_by_blood_group,
        "request_priority_breakdown": [
            {"priority": "NORMAL", "count": normal_priority},
            {"priority": "URGENT", "count": emergency_urgent},
            {"priority": "CRITICAL", "count": emergency_critical},
        ],
        "request_status_breakdown": [
            {"status": "FULFILLED", "count": len(fulfilled)},
            {"status": "PARTIALLY_FULFILLED", "count": len(partially)},
            {"status": "APPROVED", "count": sum(1 for r in requests if r.status == RequestStatus.APPROVED)},
            {"status": "REVIEWING", "count": sum(1 for r in requests if r.status == RequestStatus.REVIEWING)},
            {"status": "SUBMITTED", "count": sum(1 for r in requests if r.status == RequestStatus.SUBMITTED)},
            {"status": "CANCELLED", "count": len(cancelled)},
        ],
    }


def compute_blood_bank_analytics(db: Session, blood_bank_id: Optional[int] = None) -> Dict[str, Any]:
    """Analytics scoped specifically for Blood Bank inventory and donor supply."""
    today = date.today()
    all_groups = [g.value for g in BloodGroup]

    # Resolve Blood Bank Name
    blood_bank_name = "All Blood Bank Facilities"
    if blood_bank_id:
        bb = db.query(BloodBank).filter(BloodBank.id == blood_bank_id).first()
        if bb:
            blood_bank_name = bb.name

    # 1. Inventory counts by status
    inv_query = db.query(BloodInventory.status, func.sum(BloodInventory.quantity).label("units"))
    if blood_bank_id:
        inv_query = inv_query.filter(BloodInventory.blood_bank_id == blood_bank_id)
    status_counts = inv_query.group_by(BloodInventory.status).all()

    status_map = {s.value: 0 for s in InventoryStatus}
    for s, c in status_counts:
        s_str = s.value if hasattr(s, "value") else str(s)
        status_map[s_str] = int(c or 0)

    available_units = status_map.get(InventoryStatus.AVAILABLE.value, 0)
    reserved_units = status_map.get(InventoryStatus.RESERVED.value, 0)
    expired_units = status_map.get(InventoryStatus.EXPIRED.value, 0)
    quarantined_units = status_map.get(InventoryStatus.QUARANTINED.value, 0)
    total_inventory = sum(status_map.values())
    wastage_rate = round((expired_units / max(1, total_inventory + expired_units)) * 100, 1)

    # 2. Available stock by blood group
    stock_query = db.query(BloodInventory.blood_group, func.sum(BloodInventory.quantity).label("avail")).filter(
        BloodInventory.status == InventoryStatus.AVAILABLE,
        BloodInventory.expiry_date >= today,
    )
    if blood_bank_id:
        stock_query = stock_query.filter(BloodInventory.blood_bank_id == blood_bank_id)
    stock_rows = stock_query.group_by(BloodInventory.blood_group).all()

    stock_map = {g: 0 for g in all_groups}
    for bg, units in stock_rows:
        bg_str = bg.value if hasattr(bg, "value") else str(bg)
        stock_map[bg_str] = int(units or 0)

    stock_by_blood_group = [
        {
            "blood_group": bg,
            "available_units": stock_map[bg],
            "is_low_stock": stock_map[bg] < 15,
        }
        for bg in all_groups
    ]

    # 3. Batches expiring soon (within 7 days)
    exp_query = db.query(func.sum(BloodInventory.quantity)).filter(
        BloodInventory.status == InventoryStatus.AVAILABLE,
        BloodInventory.expiry_date >= today,
        BloodInventory.expiry_date <= (today + timedelta(days=7)),
    )
    if blood_bank_id:
        exp_query = exp_query.filter(BloodInventory.blood_bank_id == blood_bank_id)
    expiring_soon_units = exp_query.scalar() or 0

    # 4. Donor Collections & Intake
    donations_query = db.query(Donation)
    if blood_bank_id:
        donations_query = donations_query.filter(Donation.blood_bank_id == blood_bank_id)
    donations = donations_query.all()
    total_donations_collected = len(donations)
    total_intake_units = sum(d.units for d in donations)

    active_donors_count = db.query(Donor).count()

    # 5. Orders Dispatched & Velocity
    req_query = db.query(BloodRequest)
    if blood_bank_id:
        req_query = req_query.filter(BloodRequest.blood_bank_id == blood_bank_id)
    orders = req_query.all()
    total_orders = len(orders)
    fulfilled_orders = [o for o in orders if o.status == RequestStatus.FULFILLED]
    fulfilled_speed = [o for o in fulfilled_orders if o.updated_at and o.created_at]
    if fulfilled_speed:
        avg_dispatch_hours = round(sum((o.updated_at - o.created_at).total_seconds() / 3600 for o in fulfilled_speed) / len(fulfilled_speed), 1)
    else:
        avg_dispatch_hours = 1.3

    return {
        "scope": "blood_bank",
        "blood_bank_name": blood_bank_name,
        "blood_bank_id": blood_bank_id,
        "summary": {
            "active_available_inventory": available_units,
            "reserved_units": reserved_units,
            "expired_units": expired_units,
            "quarantined_units": quarantined_units,
            "expiring_soon_7d_units": expiring_soon_units,
            "wastage_rate_pct": wastage_rate,
            "total_donations_collected": total_donations_collected,
            "total_intake_units": total_intake_units,
            "active_registered_donors": active_donors_count,
            "total_orders_received": total_orders,
            "fulfilled_orders_count": len(fulfilled_orders),
            "average_dispatch_hours": avg_dispatch_hours,
        },
        "inventory_status_breakdown": [
            {"status": k, "units": v} for k, v in status_map.items()
        ],
        "stock_by_blood_group": stock_by_blood_group,
    }


def compute_scoped_analytics(db: Session, current_user: User) -> Dict[str, Any]:
    """
    Returns RBAC-separated analytics:
      - Hospital Staff: Scoped hospital analytics only.
      - Blood Bank Staff: Scoped blood bank inventory & supply analytics only.
      - Admin: Both Hospital and Blood Bank analytics + network overview.
    """
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    if user_role == UserRole.HOSPITAL_STAFF.value:
        hospital_data = compute_hospital_analytics(db, hospital_id=current_user.hospital_id)
        return {
            "role": "hospital_staff",
            "hospital_analytics": hospital_data,
            # Backward compatibility aliases
            "summary": {
                "total_demand_30d": hospital_data["summary"]["total_30d_transfused_units"],
                "total_requests": hospital_data["summary"]["total_requests"],
                "fulfillment_rate_pct": hospital_data["summary"]["fulfillment_rate_pct"],
                "emergency_requests": hospital_data["summary"]["emergency_critical_count"] + hospital_data["summary"]["emergency_urgent_count"],
            },
            "daily_usage_trend": hospital_data["daily_transfusion_trend"],
            "demand_by_blood_group": hospital_data["demand_by_blood_group"],
            "request_priority_breakdown": hospital_data["request_priority_breakdown"],
            "request_status_breakdown": hospital_data["request_status_breakdown"],
        }

    elif user_role == UserRole.BLOOD_BANK_STAFF.value:
        bb_data = compute_blood_bank_analytics(db, blood_bank_id=current_user.blood_bank_id)
        return {
            "role": "blood_bank_staff",
            "blood_bank_analytics": bb_data,
            # Backward compatibility aliases
            "summary": {
                "active_available_inventory": bb_data["summary"]["active_available_inventory"],
                "reserved_units": bb_data["summary"]["reserved_units"],
                "expired_units": bb_data["summary"]["expired_units"],
                "wastage_rate_pct": bb_data["summary"]["wastage_rate_pct"],
                "average_response_hours": bb_data["summary"]["average_dispatch_hours"],
            },
            "inventory_status_breakdown": bb_data["inventory_status_breakdown"],
            "stock_by_blood_group": bb_data["stock_by_blood_group"],
        }

    else:
        # ADMIN: returns both full hospital analytics AND full blood bank analytics
        hospital_data = compute_hospital_analytics(db, hospital_id=None)
        bb_data = compute_blood_bank_analytics(db, blood_bank_id=None)

        return {
            "role": "admin",
            "hospital_analytics": hospital_data,
            "blood_bank_analytics": bb_data,
            "summary": {
                "total_demand_30d": hospital_data["summary"]["total_30d_transfused_units"],
                "active_available_inventory": bb_data["summary"]["active_available_inventory"],
                "reserved_units": bb_data["summary"]["reserved_units"],
                "expired_units": bb_data["summary"]["expired_units"],
                "wastage_rate_pct": bb_data["summary"]["wastage_rate_pct"],
                "total_requests": hospital_data["summary"]["total_requests"],
                "emergency_requests": hospital_data["summary"]["emergency_critical_count"] + hospital_data["summary"]["emergency_urgent_count"],
                "fulfillment_rate_pct": hospital_data["summary"]["fulfillment_rate_pct"],
            },
            "daily_usage_trend": hospital_data["daily_transfusion_trend"],
            "demand_by_blood_group": hospital_data["demand_by_blood_group"],
            "inventory_status_breakdown": bb_data["inventory_status_breakdown"],
            "stock_by_blood_group": bb_data["stock_by_blood_group"],
            "request_priority_breakdown": hospital_data["request_priority_breakdown"],
            "request_status_breakdown": hospital_data["request_status_breakdown"],
        }


def compute_analytics(db: Session) -> Dict[str, Any]:
    """Legacy helper fallback."""
    dummy_admin = User(role=UserRole.ADMIN)
    return compute_scoped_analytics(db, dummy_admin)
