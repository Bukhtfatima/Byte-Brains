"""
BloodBridge Explainable Shortage Risk Engine
Computes LOW / MEDIUM / HIGH risk per blood group with human-readable reasons.
Inputs: current inventory, predicted demand, expiring units, active requests, thresholds.
"""

import json
from datetime import date, timedelta, datetime
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.entities import (
    BloodInventory,
    BloodRequest,
    RiskAssessment,
    SystemSetting,
)
from app.models.enums import (
    BloodGroup,
    InventoryStatus,
    RequestStatus,
    RequestPriority,
    RiskLevel,
)
from app.services.inventory_service import get_system_thresholds
from app.services.audit_service import log_action
from app.services.demand_service import estimate_demand


def compute_risk_assessments(
    db: Session,
    user_id: Optional[int] = None,
) -> List[dict]:
    """
    Compute explainable shortage risk for all 8 blood groups.
    Returns risk level with structured reasoning.
    """
    min_thresholds, warn_days, urg_days, crit_days = get_system_thresholds(db)
    today = date.today()
    results = []

    for bg in BloodGroup:
        bg_val = bg.value

        # 1. Current available inventory
        available_units = (
            db.query(func.coalesce(func.sum(BloodInventory.quantity), 0))
            .filter(
                BloodInventory.blood_group == bg,
                BloodInventory.status == InventoryStatus.AVAILABLE,
                BloodInventory.expiry_date >= today,
            )
            .scalar()
        ) or 0

        # 2. Units expiring within 7 days
        exp_cutoff = today + timedelta(days=7)
        expiring_units = (
            db.query(func.coalesce(func.sum(BloodInventory.quantity), 0))
            .filter(
                BloodInventory.blood_group == bg,
                BloodInventory.status == InventoryStatus.AVAILABLE,
                BloodInventory.expiry_date >= today,
                BloodInventory.expiry_date <= exp_cutoff,
            )
            .scalar()
        ) or 0

        # 3. Active unfulfilled requests
        active_requests = (
            db.query(BloodRequest)
            .filter(
                BloodRequest.blood_group == bg,
                BloodRequest.status.in_([
                    RequestStatus.SUBMITTED,
                    RequestStatus.REVIEWING,
                    RequestStatus.APPROVED,
                    RequestStatus.PARTIALLY_FULFILLED,
                ]),
            )
            .all()
        )
        active_request_count = len(active_requests)
        active_request_units = sum(
            r.quantity - r.fulfilled_quantity for r in active_requests
        )
        urgent_request_count = sum(
            1 for r in active_requests
            if r.priority in (RequestPriority.CRITICAL, RequestPriority.URGENT)
        )

        # 4. Estimated 7-day demand from recent usage history
        predicted_demand = estimate_demand(db, bg, horizon_days=7)

        # 5. Min threshold
        threshold = min_thresholds.get(bg_val, 10)

        # --- Risk calculation with explanations ---
        reasons = []
        risk_score = 0  # 0-100 scale

        # Factor 1: Below safety threshold
        if available_units < threshold:
            deficit_pct = (threshold - available_units) / threshold
            score_add = min(30, int(deficit_pct * 30))
            risk_score += score_add
            reasons.append(
                f"Current available inventory ({available_units} units) is below "
                f"the configured safety threshold ({threshold} units)."
            )

        # Factor 2: Predicted demand exceeds available
        if predicted_demand > 0 and predicted_demand > available_units:
            shortage = predicted_demand - available_units
            risk_score += min(25, int((shortage / max(predicted_demand, 1)) * 25))
            reasons.append(
                f"Predicted 7-day demand ({predicted_demand:.0f} units) exceeds "
                f"current available inventory ({available_units} units). "
                f"Potential shortage of ~{shortage:.0f} units."
            )

        # Factor 3: Expiring units reducing effective supply
        if expiring_units > 0:
            exp_pct = expiring_units / max(available_units, 1)
            risk_score += min(20, int(exp_pct * 20))
            reasons.append(
                f"{expiring_units} unit(s) are expected to expire within 7 days, "
                f"reducing effective supply."
            )

        # Factor 4: Active unfulfilled requests
        if active_request_units > 0:
            req_pct = active_request_units / max(available_units, 1)
            risk_score += min(15, int(req_pct * 15))
            reasons.append(
                f"{active_request_count} active request(s) pending for "
                f"{active_request_units} total units."
            )

        # Factor 5: Urgent/Critical requests
        if urgent_request_count > 0:
            risk_score += min(10, urgent_request_count * 5)
            reasons.append(
                f"{urgent_request_count} urgent/critical request(s) currently active."
            )

        # Classify risk level
        if risk_score >= 50:
            risk_level = RiskLevel.HIGH
        elif risk_score >= 25:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        if not reasons:
            reasons.append(
                f"Inventory levels ({available_units} units) are above the safety "
                f"threshold ({threshold} units) with no significant shortage indicators."
            )

        # Persist assessment
        assessment = RiskAssessment(
            blood_group=bg,
            risk_level=risk_level,
            current_inventory=int(available_units),
            predicted_demand=float(predicted_demand),
            expiring_units=int(expiring_units),
            active_requests=active_request_count,
            reasons=reasons,
            created_at=datetime.utcnow(),
        )
        db.add(assessment)

        results.append({
            "blood_group": bg_val,
            "risk_level": risk_level.value,
            "risk_score": risk_score,
            "current_inventory": int(available_units),
            "predicted_demand": round(predicted_demand, 1),
            "expiring_units": int(expiring_units),
            "active_requests": active_request_count,
            "active_request_units": active_request_units,
            "urgent_requests": urgent_request_count,
            "threshold": threshold,
            "reasons": reasons,
        })

    db.commit()

    if user_id:
        high_count = sum(1 for r in results if r["risk_level"] == "HIGH")
        log_action(
            db=db,
            action="RISK_ASSESSMENT_GENERATED",
            entity_type="RISK_ASSESSMENT",
            entity_id="all",
            description=f"Generated risk assessments: {high_count} HIGH risk groups detected",
            user_id=user_id,
        )

    return results


def get_latest_risk_assessments(db: Session) -> List[dict]:
    """Retrieve the most recent risk assessment for each blood group. Auto-computes if empty."""
    results = []
    for bg in BloodGroup:
        latest = (
            db.query(RiskAssessment)
            .filter(RiskAssessment.blood_group == bg)
            .order_by(RiskAssessment.created_at.desc())
            .first()
        )
        if latest:
            results.append({
                "blood_group": bg.value,
                "risk_level": latest.risk_level.value,
                "current_inventory": latest.current_inventory,
                "predicted_demand": latest.predicted_demand,
                "expiring_units": latest.expiring_units,
                "active_requests": latest.active_requests,
                "reasons": latest.reasons,
                "created_at": latest.created_at.isoformat(),
            })
    if not results:
        results = compute_risk_assessments(db)
    return results

