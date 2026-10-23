from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.enums import BloodGroup, RequestPriority, RequestStatus


class BloodRequestCreate(BaseModel):
    blood_group: BloodGroup
    quantity: int
    priority: RequestPriority = RequestPriority.NORMAL
    required_datetime: datetime
    notes: Optional[str] = None
    blood_bank_id: Optional[int] = None
    hospital_id: Optional[int] = None


class BloodRequestStatusUpdate(BaseModel):
    status: RequestStatus
    notes: Optional[str] = None


class BloodRequestFulfill(BaseModel):
    units_to_fulfill: Optional[int] = None  # None means fulfill full remaining quantity
    notes: Optional[str] = None


class BloodRequestRead(BaseModel):
    id: int
    hospital_id: int
    hospital_name: Optional[str] = None
    blood_bank_id: Optional[int] = None
    blood_bank_name: Optional[str] = None
    blood_group: BloodGroup
    quantity: int
    fulfilled_quantity: int
    priority: RequestPriority
    required_datetime: datetime
    notes: Optional[str] = None
    status: RequestStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
