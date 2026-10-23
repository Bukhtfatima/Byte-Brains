from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_authenticated
from app.models.entities import User
from app.services.analytics_service import compute_scoped_analytics

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("")
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """
    Get RBAC-scoped analytics:
      - Hospital Staff: Hospital-only request, fulfillment & clinical transfusion metrics
      - Blood Bank Staff: Blood bank-only inventory, donor collection, expiring stock & wastage metrics
      - Admin: Comprehensive views containing both Hospital and Blood Bank analytics
    """
    return compute_scoped_analytics(db, current_user)
