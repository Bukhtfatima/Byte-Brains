import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    get_current_user,
    require_authenticated,
    require_hospital_staff,
    require_blood_bank_staff,
)
from app.models.entities import BloodRequest, User
from app.models.enums import RequestStatus, RequestPriority, BloodGroup, UserRole
from app.schemas.request import (
    BloodRequestCreate,
    BloodRequestStatusUpdate,
    BloodRequestFulfill,
    BloodRequestRead,
)
from app.services.request_service import (
    create_blood_request,
    fulfill_blood_request,
    trigger_emergency_notification,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/requests", tags=["Blood Requests"])


def serialize_request(req: BloodRequest) -> BloodRequestRead:
    return BloodRequestRead(
        id=req.id,
        hospital_id=req.hospital_id,
        hospital_name=req.hospital.name if req.hospital else None,
        blood_bank_id=req.blood_bank_id,
        blood_bank_name=req.blood_bank.name if getattr(req, "blood_bank", None) else None,
        blood_group=req.blood_group,
        quantity=req.quantity,
        fulfilled_quantity=req.fulfilled_quantity,
        priority=req.priority,
        required_datetime=req.required_datetime,
        notes=req.notes,
        status=req.status,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


@router.get("", response_model=List[BloodRequestRead])
def list_requests(
    status_filter: Optional[RequestStatus] = Query(None, alias="status"),
    priority: Optional[RequestPriority] = None,
    blood_group: Optional[BloodGroup] = None,
    hospital_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """
    List blood requests with RBAC scoping:
    - Hospital staff: restricted to their hospital
    - Blood bank staff: requests routed to their blood bank or network
    - Admin: all
    """
    query = db.query(BloodRequest)

    if current_user.role == UserRole.HOSPITAL_STAFF:
        query = query.filter(BloodRequest.hospital_id == current_user.hospital_id)
    elif hospital_id:
        query = query.filter(BloodRequest.hospital_id == hospital_id)

    if current_user.role == UserRole.BLOOD_BANK_STAFF and current_user.blood_bank_id:
        query = query.filter(
            (BloodRequest.blood_bank_id == current_user.blood_bank_id)
            | (BloodRequest.blood_bank_id == None)
        )

    if status_filter:
        query = query.filter(BloodRequest.status == status_filter)
    if priority:
        query = query.filter(BloodRequest.priority == priority)
    if blood_group:
        query = query.filter(BloodRequest.blood_group == blood_group)

    requests = query.order_by(BloodRequest.created_at.desc()).all()
    return [serialize_request(r) for r in requests]


@router.post("", response_model=BloodRequestRead, status_code=status.HTTP_201_CREATED)
async def submit_blood_request(
    request_in: BloodRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hospital_staff),
):
    """
    Hospital Staff: Submit a new emergency or standard blood request.
    Dispatches internal notification for urgent/critical requests.
    """
    req = create_blood_request(db, request_in, current_user)

    # Trigger emergency notification asynchronously
    if req.priority in (RequestPriority.CRITICAL, RequestPriority.URGENT):
        payload = {
            "event": "EMERGENCY_REQUEST_SUBMITTED",
            "request_id": req.id,
            "hospital_name": req.hospital.name if req.hospital else "Hospital",
            "blood_group": req.blood_group.value,
            "quantity": req.quantity,
            "priority": req.priority.value,
            "required_datetime": req.required_datetime.isoformat(),
            "notes": req.notes,
        }
        asyncio.create_task(trigger_emergency_notification(payload, db))

    return serialize_request(req)


@router.get("/{request_id}", response_model=BloodRequestRead)
def get_request_details(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Get single blood request details with authorization check."""
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Blood request not found")

    if (
        current_user.role == UserRole.HOSPITAL_STAFF
        and req.hospital_id != current_user.hospital_id
    ):
        raise HTTPException(status_code=403, detail="Not authorized to view other hospital requests")

    return serialize_request(req)


@router.put("/{request_id}/status", response_model=BloodRequestRead)
def update_request_status(
    request_id: int,
    status_update: BloodRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_blood_bank_staff),
):
    """Blood Bank Staff: Review, Approve, Reject, or Cancel request."""
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Blood request not found")

    prev_status = req.status.value
    req.status = status_update.status
    if status_update.notes:
        req.notes = f"{req.notes or ''} [Status Note: {status_update.notes}]".strip()

    db.commit()
    db.refresh(req)

    log_action(
        db=db,
        action="REQUEST_STATUS_UPDATED",
        entity_type="BLOOD_REQUEST",
        entity_id=str(req.id),
        description=f"Request #{req.id} status changed: {prev_status} -> {req.status.value}",
        user_id=current_user.id,
    )

    return serialize_request(req)


@router.post("/{request_id}/fulfill", response_model=BloodRequestRead)
def fulfill_request(
    request_id: int,
    fulfill_data: BloodRequestFulfill,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_blood_bank_staff),
):
    """
    Blood Bank Staff: Authorized fulfillment of blood request.
    Performs atomic FEFO inventory deduction and records audit log.
    """
    req = fulfill_blood_request(db, request_id, fulfill_data, current_user)
    return serialize_request(req)
