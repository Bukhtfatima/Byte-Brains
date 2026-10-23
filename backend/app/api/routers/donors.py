from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_admin
from app.models.entities import User
from app.schemas.donor import (
    DonorResponse,
    DonorDetailResponse,
    DonorCreate,
    DonorUpdate,
    DonationRecordCreate,
    DonationResponse,
)
from app.services import donor_service

router = APIRouter(prefix="/donors", tags=["Donors"])


@router.get("", response_model=List[DonorResponse])
def list_donors(
    blood_group: Optional[str] = None,
    status: Optional[str] = None,
    eligible_only: bool = False,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all donors with eligibility calculation."""
    return donor_service.get_donors(
        db,
        blood_group=blood_group,
        status=status,
        eligible_only=eligible_only,
        search=search,
    )


@router.get("/quick-match/{blood_group}", response_model=List[DonorResponse])
def quick_match_donors(
    blood_group: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Find immediately eligible donors matching a specific blood group for emergency calls."""
    return donor_service.get_donors(
        db,
        blood_group=blood_group,
        eligible_only=True,
    )


@router.post("", response_model=DonorResponse, status_code=status.HTTP_201_CREATED)
def register_donor(
    donor_in: DonorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Register a new donor profile."""
    donor = donor_service.create_donor(db, donor_in, user_id=current_user.id)
    return donor_service.enrich_donor_data(donor)


@router.get("/{donor_id}", response_model=DonorDetailResponse)
def get_donor(
    donor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get full donor details and past donation history."""
    donor = donor_service.get_donor_by_id(db, donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    data = donor_service.enrich_donor_data(donor)
    data["donations"] = donor.donations
    return data


@router.put("/{donor_id}", response_model=DonorResponse)
def update_donor_profile(
    donor_id: int,
    donor_in: DonorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update donor details or status."""
    donor = donor_service.get_donor_by_id(db, donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    updated = donor_service.update_donor(db, donor, donor_in, user_id=current_user.id)
    return donor_service.enrich_donor_data(updated)


@router.post("/{donor_id}/donate", response_model=DonationResponse, status_code=status.HTTP_201_CREATED)
def record_donor_donation(
    donor_id: int,
    donation_in: DonationRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Record a new blood donation.
    Automatically checks eligibility, creates inventory batch, and resets cooldown.
    """
    donor = donor_service.get_donor_by_id(db, donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    try:
        donation, _ = donor_service.record_donation(
            db=db,
            donor=donor,
            donation_in=donation_in,
            user_id=current_user.id,
        )
        return donation
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
