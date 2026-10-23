from datetime import date
from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import (
    get_db,
    get_current_user,
    require_authenticated,
    require_blood_bank_staff,
    require_hospital_staff,
    require_admin,
)
from app.models.entities import (
    BloodInventory,
    BloodRequest,
    Hospital,
    BloodBank,
    User,
    AuditLog,
)
from app.models.enums import (
    InventoryStatus,
    RequestStatus,
    RequestPriority,
    BloodGroup,
    UserRole,
)
from app.services.inventory_service import get_inventory_overview, get_system_thresholds
from app.schemas.inventory import InventoryOverview

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])


@router.get("/blood-bank")
def get_blood_bank_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_blood_bank_staff),
):
    """Metrics and alerts for blood bank operational dashboard."""
    overview = get_inventory_overview(db, blood_bank_id=current_user.blood_bank_id)

    # Active requests routed to or available to this blood bank
    req_query = db.query(BloodRequest)
    if current_user.blood_bank_id:
        req_query = req_query.filter(
            (BloodRequest.blood_bank_id == current_user.blood_bank_id)
            | (BloodRequest.blood_bank_id == None)
        )

    all_reqs = req_query.order_by(BloodRequest.created_at.desc()).all()

    pending_requests = [
        r for r in all_reqs
        if r.status in (RequestStatus.SUBMITTED, RequestStatus.REVIEWING)
    ]
    emergency_requests = [
        r for r in pending_requests
        if r.priority in (RequestPriority.CRITICAL, RequestPriority.URGENT)
    ]

    recent_requests = [
        {
            "id": r.id,
            "hospital_name": r.hospital.name if r.hospital else "Hospital",
            "blood_group": r.blood_group.value,
            "quantity": r.quantity,
            "fulfilled_quantity": r.fulfilled_quantity,
            "priority": r.priority.value,
            "status": r.status.value,
            "created_at": r.created_at.isoformat(),
            "required_datetime": r.required_datetime.isoformat(),
        }
        for r in all_reqs[:8]
    ]

    return {
        "kpis": {
            "total_available_units": overview.total_available_units,
            "total_reserved_units": overview.total_reserved_units,
            "low_stock_groups_count": overview.low_stock_groups_count,
            "critical_expiry_count": overview.critical_expiry_count,
            "expiring_soon_count": overview.expiring_soon_count,
            "pending_requests_count": len(pending_requests),
            "emergency_requests_count": len(emergency_requests),
        },
        "inventory_by_group": overview.by_blood_group,
        "recent_requests": recent_requests,
        "blood_bank_name": current_user.blood_bank.name if current_user.blood_bank else "All Blood Banks",
    }


@router.get("/hospital")
def get_hospital_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hospital_staff),
):
    """Metrics and request status for hospital staff dashboard."""
    hosp_id = current_user.hospital_id

    req_query = db.query(BloodRequest)
    if hosp_id:
        req_query = req_query.filter(BloodRequest.hospital_id == hosp_id)

    all_reqs = req_query.order_by(BloodRequest.created_at.desc()).all()

    active_requests = [
        r for r in all_reqs
        if r.status in (RequestStatus.SUBMITTED, RequestStatus.REVIEWING, RequestStatus.APPROVED)
    ]
    fulfilled_requests = [
        r for r in all_reqs
        if r.status == RequestStatus.FULFILLED
    ]
    emergency_active = [
        r for r in active_requests
        if r.priority in (RequestPriority.CRITICAL, RequestPriority.URGENT)
    ]

    total_units_requested = sum(r.quantity for r in all_reqs)
    total_units_received = sum(r.fulfilled_quantity for r in all_reqs)

    # General network availability summary so hospitals can see available blood groups
    overview = get_inventory_overview(db)

    return {
        "hospital_name": current_user.hospital.name if current_user.hospital else "Hospital Center",
        "kpis": {
            "total_submitted_requests": len(all_reqs),
            "active_requests_count": len(active_requests),
            "emergency_requests_count": len(emergency_active),
            "fulfilled_requests_count": len(fulfilled_requests),
            "total_units_requested": total_units_requested,
            "total_units_received": total_units_received,
        },
        "network_availability": overview.by_blood_group,
        "my_requests": [
            {
                "id": r.id,
                "blood_group": r.blood_group.value,
                "quantity": r.quantity,
                "fulfilled_quantity": r.fulfilled_quantity,
                "priority": r.priority.value,
                "status": r.status.value,
                "created_at": r.created_at.isoformat(),
                "required_datetime": r.required_datetime.isoformat(),
                "notes": r.notes,
            }
            for r in all_reqs[:10]
        ],
    }


@router.get("/admin")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """System-wide analytics, infrastructure counts, and audit logs."""
    total_hospitals = db.query(Hospital).count()
    total_blood_banks = db.query(BloodBank).count()
    total_users = db.query(User).count()
    total_batches = db.query(BloodInventory).count()

    overview = get_inventory_overview(db)

    total_requests = db.query(BloodRequest).count()
    pending_requests = (
        db.query(BloodRequest)
        .filter(BloodRequest.status.in_([RequestStatus.SUBMITTED, RequestStatus.REVIEWING]))
        .count()
    )

    recent_logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(8)
        .all()
    )

    return {
        "kpis": {
            "total_hospitals": total_hospitals,
            "total_blood_banks": total_blood_banks,
            "total_users": total_users,
            "total_batches": total_batches,
            "total_available_units": overview.total_available_units,
            "total_expired_units": overview.total_expired_units,
            "low_stock_groups_count": overview.low_stock_groups_count,
            "total_requests": total_requests,
            "pending_requests": pending_requests,
        },
        "inventory_overview": overview,
        "recent_audit_logs": [
            {
                "id": l.id,
                "user_name": l.user.name if l.user else "System",
                "action": l.action,
                "entity_type": l.entity_type,
                "entity_id": l.entity_id,
                "description": l.description,
                "timestamp": l.timestamp.isoformat(),
            }
            for l in recent_logs
        ],
    }
