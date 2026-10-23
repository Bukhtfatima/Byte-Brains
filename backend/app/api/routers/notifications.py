from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user, require_authenticated
from app.models.entities import Notification, User
from app.services.audit_service import log_action

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationLogRequest(BaseModel):
    type: str
    recipient: str
    message: str


@router.post("/log")
def log_notification(
    payload: NotificationLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Record automation notification event in BloodBridge notification ledger."""
    entry = Notification(
        type=payload.type,
        recipient=payload.recipient,
        message=payload.message,
        status="DELIVERED",
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    log_action(
        db=db,
        action="AUTOMATION_NOTIFICATION_LOGGED",
        entity_type="NOTIFICATION",
        entity_id=str(entry.id),
        description=f"Automation event: [{payload.type}] → {payload.recipient[:60]}",
        user_id=current_user.id,
    )

    return {"id": entry.id, "status": "logged", "type": entry.type}


@router.get("")
def list_notifications(
    limit: int = Query(30, ge=1, le=200),
    notification_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Retrieve recent automation notifications and internal alerts."""
    query = db.query(Notification)
    if notification_type:
        query = query.filter(Notification.type == notification_type)
    entries = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return [
        {
            "id": n.id,
            "type": n.type,
            "recipient": n.recipient,
            "message": n.message,
            "status": n.status,
            "created_at": n.created_at.isoformat(),
        }
        for n in entries
    ]
