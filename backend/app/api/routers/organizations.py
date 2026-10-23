from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_admin
from app.models.entities import Hospital, BloodBank, User
from app.schemas.organization import (
    HospitalRead,
    HospitalCreate,
    BloodBankRead,
    BloodBankCreate,
)

router = APIRouter(tags=["Organizations"])


@router.get("/hospitals", response_model=List[HospitalRead])
def get_hospitals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all registered hospitals in the regional network."""
    return db.query(Hospital).all()


@router.post("/hospitals", response_model=HospitalRead, status_code=status.HTTP_201_CREATED)
def create_hospital(
    hospital_in: HospitalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: Register a new partner hospital."""
    hospital = Hospital(**hospital_in.model_dump())
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    return hospital


@router.get("/blood-banks", response_model=List[BloodBankRead])
def get_blood_banks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all regional blood bank centers."""
    return db.query(BloodBank).all()


@router.post("/blood-banks", response_model=BloodBankRead, status_code=status.HTTP_201_CREATED)
def create_blood_bank(
    blood_bank_in: BloodBankCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: Register a new blood bank facility."""
    blood_bank = BloodBank(**blood_bank_in.model_dump())
    db.add(blood_bank)
    db.commit()
    db.refresh(blood_bank)
    return blood_bank
