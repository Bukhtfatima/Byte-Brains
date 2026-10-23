from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_authenticated
from app.models.entities import User
from app.services.risk_service import compute_risk_assessments, get_latest_risk_assessments

router = APIRouter(tags=["Shortage Risk"])


@router.get("/risks")
def get_risks(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """
    Retrieve latest explainable shortage risk assessments.
    Each blood group includes risk level (LOW/MEDIUM/HIGH) and human-readable reasons.
    """
    assessments = get_latest_risk_assessments(db)
    return {
        "disclaimer": "Risk assessments are operational indicators. They do not constitute clinical recommendations.",
        "assessments": assessments,
    }


@router.get("/risks/{blood_group}")
def get_risk_for_group(
    blood_group: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Get risk assessment for a specific blood group with explanation."""
    assessments = get_latest_risk_assessments(db)
    match = next((a for a in assessments if a["blood_group"] == blood_group), None)
    if not match:
        return {"blood_group": blood_group, "risk_level": "UNKNOWN", "reasons": ["No risk assessment available. Generate one first."]}
    return match


@router.post("/risks/generate")
def trigger_risk_generation(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """Run the explainable risk engine across all blood groups."""
    results = compute_risk_assessments(db, user_id=current_user.id)
    high_count = sum(1 for r in results if r["risk_level"] == "HIGH")
    return {
        "status": "generated",
        "total_groups": len(results),
        "high_risk_count": high_count,
        "assessments": results,
    }
