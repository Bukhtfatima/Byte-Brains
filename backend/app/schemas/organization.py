from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class HospitalBase(BaseModel):
    name: str
    location: str
    contact_information: str


class HospitalCreate(HospitalBase):
    pass


class HospitalRead(HospitalBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BloodBankBase(BaseModel):
    name: str
    location: str
    contact_information: str


class BloodBankCreate(BloodBankBase):
    pass


class BloodBankRead(BloodBankBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
