from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.entities import AuditLog


import logging

logger = logging.getLogger("bloodbridge.audit")


def log_action(
    db: Session,
    action: str,
    entity_type: str,
    description: str,
    user_id: Optional[int] = None,
    entity_id: Optional[str] = None,
) -> Optional[AuditLog]:
    try:
        audit_entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            description=description,
            timestamp=datetime.utcnow(),
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry
    except Exception as e:
        logger.error(f"Failed to record audit log: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return None


log_audit_event = log_action

