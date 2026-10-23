import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.config import settings
from app.models.entities import (
    AutomationEvent,
    Notification,
    BloodInventory,
    BloodRequest,
    AuditLog,
)
from app.models.enums import InventoryStatus, RequestPriority, BloodGroup

logger = logging.getLogger("bloodbridge.automation")

WORKFLOW_NAMES = {
    "low-inventory": "Workflow 1 — Low Inventory Alert",
    "expiry-alert": "Workflow 2 — Expiry Alert",
    "emergency-request": "Workflow 3 — Emergency Request Coordination",
    "weekly-report": "Workflow 4 — Weekly Executive Report",
    "shortage-risk": "Workflow 5 — Shortage Risk Alert",
}


def log_automation_event(
    db: Session,
    workflow_name: str,
    event_type: str,
    payload: Dict[str, Any],
    status: str = "SUCCESS",
) -> AutomationEvent:
    """Record an automation workflow execution event in the database."""
    event = AutomationEvent(
        workflow_name=workflow_name,
        event_type=event_type,
        payload=payload,
        status=status,
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def run_low_inventory_check(db: Session, threshold_units: int = 15) -> Dict[str, Any]:
    """Workflow 1: Check low inventory across blood groups and notify."""
    today = date.today()
    all_groups = [g.value for g in BloodGroup]
    low_groups = []

    for bg in all_groups:
        avail = (
            db.query(func.sum(BloodInventory.quantity))
            .filter(
                BloodInventory.blood_group == bg,
                BloodInventory.status == InventoryStatus.AVAILABLE,
                BloodInventory.expiry_date >= today,
            )
            .scalar() or 0
        )
        if avail < threshold_units:
            low_groups.append({"blood_group": bg, "available_units": avail, "threshold": threshold_units})

    if low_groups:
        # Create system notification
        notif = Notification(
            type="LOW_INVENTORY",
            recipient="blood_bank_staff@bloodbridge.org",
            message=f"Low inventory warning: {len(low_groups)} blood group(s) below threshold ({threshold_units} units). Groups: {', '.join(g['blood_group'] for g in low_groups)}",
            status="SENT",
            metadata_json={"low_groups": low_groups},
        )
        db.add(notif)
        db.commit()

    event = log_automation_event(
        db,
        workflow_name=WORKFLOW_NAMES["low-inventory"],
        event_type="LOW_STOCK_CHECK",
        payload={"low_groups": low_groups, "threshold": threshold_units},
        status="SUCCESS",
    )
    return {"event_id": event.id, "low_groups": low_groups, "triggered": len(low_groups) > 0}


def run_expiry_monitoring(db: Session, warning_days: int = 7) -> Dict[str, Any]:
    """Workflow 2: Expiry alert workflow detecting units approaching expiration."""
    today = date.today()
    limit_date = today + timedelta(days=warning_days)

    expiring_items = (
        db.query(BloodInventory)
        .filter(
            BloodInventory.status == InventoryStatus.AVAILABLE,
            BloodInventory.expiry_date >= today,
            BloodInventory.expiry_date <= limit_date,
        )
        .all()
    )

    expiring_summary = [
        {
            "id": item.id,
            "batch_id": item.batch_id,
            "blood_group": item.blood_group.value if hasattr(item.blood_group, "value") else str(item.blood_group),
            "quantity": item.quantity,
            "expiry_date": str(item.expiry_date),
            "days_left": (item.expiry_date - today).days,
        }
        for item in expiring_items
    ]

    if expiring_summary:
        notif = Notification(
            type="EXPIRY_WARNING",
            recipient="blood_bank_staff@bloodbridge.org",
            message=f"Expiry Alert: {sum(x['quantity'] for x in expiring_summary)} units across {len(expiring_summary)} batch(es) expire within {warning_days} days.",
            status="SENT",
            metadata_json={"expiring_items": expiring_summary},
        )
        db.add(notif)
        db.commit()

    event = log_automation_event(
        db,
        workflow_name=WORKFLOW_NAMES["expiry-alert"],
        event_type="EXPIRY_MONITORING",
        payload={"expiring_batches": len(expiring_summary), "total_units": sum(x['quantity'] for x in expiring_summary)},
        status="SUCCESS",
    )
    return {"event_id": event.id, "expiring_batches": expiring_summary, "total_units": sum(x['quantity'] for x in expiring_summary)}


def process_emergency_request_webhook(db: Session, request_id: int) -> Dict[str, Any]:
    """Workflow 3: Process emergency hospital request dispatch."""
    req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not req:
        return {"error": "Request not found"}

    payload = {
        "request_id": req.id,
        "hospital_id": req.hospital_id,
        "blood_group": req.blood_group.value if hasattr(req.blood_group, "value") else str(req.blood_group),
        "quantity": req.quantity,
        "priority": req.priority.value if hasattr(req.priority, "value") else str(req.priority),
        "required_time": req.required_datetime.isoformat(),
        "notes": req.notes,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Create notification for on-call personnel
    notif = Notification(
        type="EMERGENCY_REQUEST",
        recipient="oncall@bloodbridge.org",
        message=f"CRITICAL: Emergency request #{req.id} for {req.quantity} units of {payload['blood_group']} submitted with priority {payload['priority']}.",
        status="SENT",
        metadata_json=payload,
    )
    db.add(notif)
    db.commit()

    event = log_automation_event(
        db,
        workflow_name=WORKFLOW_NAMES["emergency-request"],
        event_type="EMERGENCY_DISPATCH",
        payload=payload,
        status="SUCCESS",
    )
    return {"event_id": event.id, "status": "dispatched", "request": payload}


async def run_periodic_automation(interval_seconds: int = 1800, initial_delay: int = 10):
    """
    Background worker running automated operational checks silently in background.
    Monitors low stock, batch expiry, and shortage risks.
    """
    import asyncio
    from app.database import SessionLocal
    from app.services.risk_service import compute_risk_assessments

    logger.info(f"Background automation worker scheduled. Initial run in {initial_delay}s, repeating every {interval_seconds}s.")
    try:
        await asyncio.sleep(initial_delay)
    except asyncio.CancelledError:
        return

    while True:
        try:
            logger.info("Executing periodic background automation cycle...")
            db = SessionLocal()
            try:
                # 1. Low inventory check
                low_inv = run_low_inventory_check(db)
                if low_inv.get("triggered"):
                    logger.info(f"[Background Automation] Low stock alert: {len(low_inv['low_groups'])} groups below threshold.")

                # 2. Expiry alert
                exp_res = run_expiry_monitoring(db)
                if exp_res.get("total_units", 0) > 0:
                    logger.info(f"[Background Automation] Expiry alert: {exp_res['total_units']} units expiring soon.")

                # 3. Shortage risk check
                risks = compute_risk_assessments(db)
                high = [r for r in risks if r.get("risk_level") == "HIGH"]
                log_automation_event(
                    db,
                    workflow_name=WORKFLOW_NAMES["shortage-risk"],
                    event_type="BACKGROUND_SHORTAGE_RISK_CHECK",
                    payload={"high_risk_groups": [r["blood_group"] for r in high]},
                    status="SUCCESS",
                )
            finally:
                db.close()
        except asyncio.CancelledError:
            logger.info("Background automation worker cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in background automation worker: {e}", exc_info=True)

        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            break

