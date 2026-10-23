from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict
from app.models.enums import UserRole, OrgType


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    organization_type: Optional[OrgType] = None
    hospital_id: Optional[int] = None
    blood_bank_id: Optional[int] = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    organization_type: Optional[OrgType] = None
    hospital_id: Optional[int] = None
    blood_bank_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserRead(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime
    organization_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
