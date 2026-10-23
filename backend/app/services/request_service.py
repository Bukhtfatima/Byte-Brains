import logging
from datetime import datetime, date
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.entities import (
    BloodRequest,
    BloodInventory,
    User,
    Hospital,
    BloodBank,
    Notification,
)
from app.models.enums import (
    RequestStatus,
    RequestPriority,
    InventoryStatus,
    UserRole,
)
from app.schemas.request import BloodRequestCreate, BloodRequestFulfill
from app.services.audit_service import log_action
from app.services.websocket_manager import ws_manager
from app.config import settings
import asyncio

logger = logging.getLogger("bloodbridge.requests")


async def trigger_emergency_notification(request_data: dict, db: Session):
    """Creates internal emergency notification for on-call staff."""
    notification_entry = Notification(
        type="EMERGENCY_REQUEST",
        recipient="Blood Bank On-Call Emergency Dispatcher",
        message=(
            f"EMERGENCY REQUEST: {request_data.get('quantity')} units of {request_data.get('blood_group')} "
            f"requested with priority {request_data.get('priority')} by hospital {request_data.get('hospital_name')}."
        ),
        status="SENT",
        metadata_json=request_data,
        created_at=datetime.utcnow(),
    )
    db.add(notification_entry)
    db.commit()
    logger.info(f"Emergency notification created for request #{request_data.get('request_id')}")


def create_blood_request(
    db: Session,
    request_in: BloodRequestCreate,
    current_user: User,
) -> BloodRequest:
    """Creates a new blood request submitted by hospital staff."""
    # Determine hospital
    hospital_id = current_user.hospital_id or getattr(request_in, "hospital_id", None)
    if not hospital_id:
        hosp = db.query(Hospital).first()
        hospital_id = hosp.id if hosp else 1

    # If blood bank not explicitly selected, assign to first active blood bank
    target_bb_id = request_in.blood_bank_id
    if not target_bb_id:
        first_bb = db.query(BloodBank).first()
        target_bb_id = first_bb.id if first_bb else 1

    blood_req = BloodRequest(
        hospital_id=hospital_id,
        blood_bank_id=target_bb_id,
        blood_group=request_in.blood_group,
        quantity=request_in.quantity,
        priority=request_in.priority,
        required_datetime=request_in.required_datetime,
        notes=request_in.notes,
        status=RequestStatus.SUBMITTED,
        fulfilled_quantity=0,
    )
    db.add(blood_req)
    db.commit()
    db.refresh(blood_req)

    log_action(
        db=db,
        action="REQUEST_SUBMITTED",
        entity_type="BLOOD_REQUEST",
        entity_id=str(blood_req.id),
        description=(
            f"Submitted {blood_req.priority.value} blood request #{blood_req.id} "
            f"for {blood_req.quantity} units of {blood_req.blood_group.value}"
        ),
        user_id=current_user.id,
    )

    # Real-time WebSocket push
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            severity = "critical" if blood_req.priority == RequestPriority.CRITICAL else ("warning" if blood_req.priority == RequestPriority.URGENT else "info")
            asyncio.create_task(
                ws_manager.broadcast({
                    "type": "NEW_BLOOD_REQUEST",
                    "priority": blood_req.priority.value,
                    "title": f"🚨 {blood_req.priority.value.upper()} Blood Request",
                    "message": f"{blood_req.quantity} unit(s) of {blood_req.blood_group.value} requested.",
                    "severity": severity,
                    "request_id": blood_req.id,
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
                })
            )
    except Exception:
        pass

    # Background emergency automation dispatch
    if blood_req.priority == RequestPriority.CRITICAL:
        try:
            from app.services.automation_service import process_emergency_request_webhook
            process_emergency_request_webhook(db, blood_req.id)
        except Exception as e:
            logger.warning(f"Background emergency automation dispatch skipped: {e}")

    return blood_req


def fulfill_blood_request(
    db: Session,
    request_id: int,
    fulfill_data: BloodRequestFulfill,
    current_user: User,
) -> BloodRequest:
    """
    Authorized fulfillment of blood request by blood bank staff.
    Performs atomic FEFO (First-Expiry-First-Out) deduction on blood inventory.
    """
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Blood request not found")

    if req.status in (RequestStatus.FULFILLED, RequestStatus.CANCELLED, RequestStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot fulfill request with status '{req.status.value}'",
        )

    needed = req.quantity - req.fulfilled_quantity
    to_fulfill = fulfill_data.units_to_fulfill if fulfill_data.units_to_fulfill else needed

    if to_fulfill <= 0:
        raise HTTPException(status_code=400, detail="Units to fulfill must be greater than 0")

    if to_fulfill > needed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot fulfill {to_fulfill} units. Only {needed} units remaining on request.",
        )

    # Query available batches for this blood group, ordered by expiry date (FEFO)
    today = date.today()
    query = (
        db.query(BloodInventory)
        .filter(
            BloodInventory.blood_group == req.blood_group,
            BloodInventory.status == InventoryStatus.AVAILABLE,
            BloodInventory.expiry_date >= today,
            BloodInventory.quantity > 0,
        )
        .order_by(BloodInventory.expiry_date.asc())
    )

    if current_user.blood_bank_id:
        query = query.filter(BloodInventory.blood_bank_id == current_user.blood_bank_id)

    available_batches = query.all()
    total_available = sum(b.quantity for b in available_batches)

    if total_available < to_fulfill:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient inventory. Required: {to_fulfill} units of {req.blood_group.value}, "
                f"but only {total_available} units currently available."
            ),
        )

    # Perform atomic deduction
    remaining_to_deduct = to_fulfill
    deducted_batches_info = []

    for batch in available_batches:
        if remaining_to_deduct == 0:
            break

        take = min(batch.quantity, remaining_to_deduct)
        batch.quantity -= take
        remaining_to_deduct -= take

        if batch.quantity == 0:
            batch.status = InventoryStatus.ISSUED

        deducted_batches_info.append(f"{take} units from batch {batch.batch_id}")

    req.fulfilled_quantity += to_fulfill
    if req.fulfilled_quantity >= req.quantity:
        req.status = RequestStatus.FULFILLED
    else:
        req.status = RequestStatus.PARTIALLY_FULFILLED

    if fulfill_data.notes:
        req.notes = f"{req.notes or ''} [Fulfillment Note: {fulfill_data.notes}]".strip()

    db.commit()
    db.refresh(req)

    log_action(
        db=db,
        action="REQUEST_FULFILLED",
        entity_type="BLOOD_REQUEST",
        entity_id=str(req.id),
        description=(
            f"Fulfilled {to_fulfill} units of {req.blood_group.value} for Request #{req.id}. "
            f"Batches deducted: {', '.join(deducted_batches_info)}. New request status: {req.status.value}"
        ),
        user_id=current_user.id,
    )

    # Real-time WebSocket push
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(
                ws_manager.broadcast({
                    "type": "REQUEST_FULFILLED",
                    "title": "Blood Request Fulfilled",
                    "message": f"Request #{req.id} for {req.blood_group.value} has been fulfilled ({to_fulfill} units dispensed).",
                    "severity": "success",
                    "request_id": req.id,
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
                })
            )
    except Exception:
        pass

    return req
