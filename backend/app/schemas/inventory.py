from datetime import date, datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict
from app.models.enums import BloodGroup, InventoryStatus


class BloodInventoryBase(BaseModel):
    blood_group: BloodGroup
    quantity: int
    collection_date: date
    expiry_date: date
    batch_id: str
    blood_bank_id: int
    storage_location: str = "Refrigerator-A1"
    status: InventoryStatus = InventoryStatus.AVAILABLE


class BloodInventoryCreate(BloodInventoryBase):
    # Optional on create: the endpoint falls back to the current user's blood bank
    blood_bank_id: Optional[int] = None


class BloodInventoryUpdate(BaseModel):
    quantity: Optional[int] = None
    storage_location: Optional[str] = None
    status: Optional[InventoryStatus] = None
    expiry_date: Optional[date] = None


class BloodInventoryRead(BloodInventoryBase):
    id: int
    blood_bank_name: Optional[str] = None
    days_until_expiry: int
    expiry_urgency: str  # "Normal", "Warning", "Urgent", "Critical", "Expired"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BloodGroupStockSummary(BaseModel):
    blood_group: str
    available_units: int
    reserved_units: int
    expired_units: int
    total_units: int
    min_threshold: int
    is_low_stock: bool


class InventoryOverview(BaseModel):
    total_available_units: int
    total_reserved_units: int
    total_expired_units: int
    low_stock_groups_count: int
    expiring_soon_count: int  # <= 14 days
    critical_expiry_count: int  # <= 3 days
    by_blood_group: List[BloodGroupStockSummary]
