from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.enums import BloodGroup, DonorStatus, Gender


class DonorBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    blood_group: BloodGroup
    gender: Gender = Gender.MALE
    date_of_birth: Optional[date] = None
    phone: str = Field(..., min_length=5, max_length=50)
    email: Optional[str] = None
    address: Optional[str] = None
    medical_notes: Optional[str] = None


class DonorCreate(DonorBase):
    pass


class DonorUpdate(BaseModel):
    name: Optional[str] = None
    blood_group: Optional[BloodGroup] = None
    gender: Optional[Gender] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    status: Optional[DonorStatus] = None
    medical_notes: Optional[str] = None


class DonationRecordCreate(BaseModel):
    blood_bank_id: int
    units: int = Field(default=1, ge=1, le=2)
    donation_date: Optional[date] = None
    hemoglobin: Optional[float] = Field(default=None, ge=5.0, le=20.0)
    blood_pressure: Optional[str] = None
    notes: Optional[str] = None


class DonationResponse(BaseModel):
    id: int
    donor_id: int
    blood_bank_id: int
    blood_inventory_id: Optional[int] = None
    blood_group: BloodGroup
    units: int
    donation_date: date
    hemoglobin: Optional[float] = None
    blood_pressure: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DonorResponse(DonorBase):
    id: int
    status: DonorStatus
    last_donation_date: Optional[date] = None
    is_eligible: bool = True
    days_until_eligible: int = 0
    next_eligible_date: Optional[date] = None
    total_donations: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DonorDetailResponse(DonorResponse):
    donations: List[DonationResponse] = []
