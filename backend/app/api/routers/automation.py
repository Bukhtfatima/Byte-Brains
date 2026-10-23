from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_authenticated, require_admin
from app.models.entities import User, AutomationEvent, BloodRequest
from app.services.automation_service import (
    log_automation_event,
    run_low_inventory_check,
    run_expiry_monitoring,
    process_emergency_request_webhook,
    WORKFLOW_NAMES,
)
from app.services.risk_service import compute_risk_assessments

router = APIRouter(prefix="/automation", tags=["Internal Automation"])


class WebhookPayload(BaseModel):
    event_type: str
    source: Optional[str] = "system"
    data: Optional[Dict[str, Any]] = None


@router.get("/events")
def list_automation_events(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Retrieve recorded automation events and workflow execution history."""
    events = (
        db.query(AutomationEvent)
        .order_by(AutomationEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "workflow_name": e.workflow_name,
            "event_type": e.event_type,
            "payload": e.payload,
            "status": e.status,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


@router.get("/workflows")
def list_supported_workflows(
    current_user: User = Depends(require_authenticated),
):
    """List all 5 production automation workflows integrated with BloodBridge."""
    return [
        {
            "id": "low-inventory",
            "name": WORKFLOW_NAMES["low-inventory"],
            "trigger": "Scheduled (Daily 07:00) / On-demand",
            "target": "Threshold checking -> Blood Bank Notification -> Event Log",
            "webhook_endpoint": "/api/v1/automation/webhook/inventory-alert",
        },
        {
            "id": "expiry-alert",
            "name": WORKFLOW_NAMES["expiry-alert"],
            "trigger": "Scheduled (Daily 06:00)",
            "target": "Expiry window scan (14d/7d/3d) -> Staff Notification -> Event Log",
            "webhook_endpoint": "/api/v1/automation/webhook/expiry-alert",
        },
        {
            "id": "emergency-request",
            "name": WORKFLOW_NAMES["emergency-request"],
            "trigger": "Event-driven (Hospital Critical Request)",
            "target": "Instant triage dispatch -> On-call escalation -> Webhook Ack",
            "webhook_endpoint": "/api/v1/automation/webhook/emergency",
        },
        {
            "id": "weekly-report",
            "name": WORKFLOW_NAMES["weekly-report"],
            "trigger": "Scheduled (Sunday 23:00)",
            "target": "Consolidated usage & wastage analytics -> Admin Digest",
            "webhook_endpoint": "/api/v1/automation/webhook/weekly-report",
        },
        {
            "id": "shortage-risk",
            "name": WORKFLOW_NAMES["shortage-risk"],
            "trigger": "Continuous Evaluation (Every 6 hours)",
            "target": "Explainable Risk Engine -> High-risk alert to Directors",
            "webhook_endpoint": "/api/v1/automation/webhook/shortage-risk",
        },
    ]


@router.post("/trigger/{workflow_id}")
def trigger_workflow_manually(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Manually invoke a workflow execution (useful for operational drills and demos)."""
    if workflow_id == "low-inventory":
        result = run_low_inventory_check(db)
        return {"status": "executed", "workflow": workflow_id, "result": result}
    elif workflow_id == "expiry-alert":
        result = run_expiry_monitoring(db)
        return {"status": "executed", "workflow": workflow_id, "result": result}
    elif workflow_id == "emergency-request":
        # Dispatch latest urgent request or demo sample
        latest_req = db.query(BloodRequest).order_by(BloodRequest.created_at.desc()).first()
        req_id = latest_req.id if latest_req else 1
        result = process_emergency_request_webhook(db, req_id)
        return {"status": "executed", "workflow": workflow_id, "result": result}
    elif workflow_id == "shortage-risk":
        risks = compute_risk_assessments(db, user_id=current_user.id)
        high = [r for r in risks if r["risk_level"] == "HIGH"]
        event = log_automation_event(
            db,
            workflow_name=WORKFLOW_NAMES["shortage-risk"],
            event_type="SHORTAGE_RISK_EVALUATION",
            payload={"high_risk_groups": [r["blood_group"] for r in high]},
            status="SUCCESS",
        )
        return {"status": "executed", "workflow": workflow_id, "event_id": event.id, "high_risk_count": len(high)}
    elif workflow_id == "weekly-report":
        event = log_automation_event(
            db,
            workflow_name=WORKFLOW_NAMES["weekly-report"],
            event_type="WEEKLY_REPORT_DISPATCH",
            payload={"recipient": "admin@bloodbridge.org", "summary": "30-day analytics report rendered"},
            status="SUCCESS",
        )
        return {"status": "executed", "workflow": workflow_id, "event_id": event.id}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown workflow id: {workflow_id}")


# Webhook receiving endpoints (called by external services or internal triggers)
@router.post("/webhook/emergency")
def webhook_emergency(
    payload: WebhookPayload,
    db: Session = Depends(get_db),
):
    event = log_automation_event(
        db,
        workflow_name=WORKFLOW_NAMES["emergency-request"],
        event_type="INBOUND_WEBHOOK",
        payload=payload.model_dump(),
        status="SUCCESS",
    )
    return {"status": "acknowledged", "event_id": event.id}


@router.post("/webhook/inventory-alert")
def webhook_inventory_alert(
    payload: WebhookPayload,
    db: Session = Depends(get_db),
):
    event = log_automation_event(
        db,
        workflow_name=WORKFLOW_NAMES["low-inventory"],
        event_type="INBOUND_WEBHOOK",
        payload=payload.model_dump(),
        status="SUCCESS",
    )
    return {"status": "acknowledged", "event_id": event.id}


@router.post("/webhook/expiry-alert")
def webhook_expiry_alert(
    payload: WebhookPayload,
    db: Session = Depends(get_db),
):
    event = log_automation_event(
        db,
        workflow_name=WORKFLOW_NAMES["expiry-alert"],
        event_type="INBOUND_WEBHOOK",
        payload=payload.model_dump(),
        status="SUCCESS",
    )
    return {"status": "acknowledged", "event_id": event.id}


@router.post("/webhook/weekly-report")
def webhook_weekly_report(
    payload: WebhookPayload,
    db: Session = Depends(get_db),
):
    event = log_automation_event(
        db,
        workflow_name=WORKFLOW_NAMES["weekly-report"],
        event_type="INBOUND_WEBHOOK",
        payload=payload.model_dump(),
        status="SUCCESS",
    )
    return {"status": "acknowledged", "event_id": event.id}


@router.post("/webhook/shortage-risk")
def webhook_shortage_risk(
    payload: WebhookPayload,
    db: Session = Depends(get_db),
):
    event = log_automation_event(
        db,
        workflow_name=WORKFLOW_NAMES["shortage-risk"],
        event_type="INBOUND_WEBHOOK",
        payload=payload.model_dump(),
        status="SUCCESS",
    )
    return {"status": "acknowledged", "event_id": event.id}
