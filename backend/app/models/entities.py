from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Date,
    Text,
    Boolean,
    ForeignKey,
    Enum as SQLEnum,
    JSON,
)
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import (
    UserRole,
    OrgType,
    BloodGroup,
    InventoryStatus,
    RequestStatus,
    RequestPriority,
    RiskLevel,
    DonorStatus,
    Gender,
)


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    location = Column(String(255), nullable=False)
    contact_information = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    users = relationship("User", back_populates="hospital")
    requests = relationship("BloodRequest", back_populates="hospital")


class BloodBank(Base):
    __tablename__ = "blood_banks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    location = Column(String(255), nullable=False)
    contact_information = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    users = relationship("User", back_populates="blood_bank")
    inventory_items = relationship("BloodInventory", back_populates="blood_bank")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.HOSPITAL_STAFF)
    
    # Organization binding
    organization_type = Column(SQLEnum(OrgType), nullable=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True)
    blood_bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="SET NULL"), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hospital = relationship("Hospital", back_populates="users")
    blood_bank = relationship("BloodBank", back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="user")


class BloodInventory(Base):
    __tablename__ = "blood_inventory"

    id = Column(Integer, primary_key=True, index=True)
    blood_group = Column(SQLEnum(BloodGroup), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=1)
    collection_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False, index=True)
    batch_id = Column(String(100), nullable=False, index=True)
    blood_bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="CASCADE"), nullable=False)
    storage_location = Column(String(100), nullable=False, default="Refrigerator-A1")
    status = Column(SQLEnum(InventoryStatus), nullable=False, default=InventoryStatus.AVAILABLE, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    blood_bank = relationship("BloodBank", back_populates="inventory_items")


class BloodRequest(Base):
    __tablename__ = "blood_requests"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    blood_bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="SET NULL"), nullable=True)
    blood_group = Column(SQLEnum(BloodGroup), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    priority = Column(SQLEnum(RequestPriority), nullable=False, default=RequestPriority.NORMAL, index=True)
    required_datetime = Column(DateTime, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(SQLEnum(RequestStatus), nullable=False, default=RequestStatus.SUBMITTED, index=True)
    fulfilled_quantity = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hospital = relationship("Hospital", back_populates="requests")


class DemandHistory(Base):
    __tablename__ = "demand_history"

    id = Column(Integer, primary_key=True, index=True)
    blood_group = Column(SQLEnum(BloodGroup), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    units_used = Column(Integer, nullable=False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True)
    blood_bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="SET NULL"), nullable=True)


class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(Integer, primary_key=True, index=True)
    blood_group = Column(SQLEnum(BloodGroup), nullable=False, index=True)
    forecast_date = Column(Date, nullable=False, index=True)
    predicted_demand = Column(Float, nullable=False)
    horizon_days = Column(Integer, default=7, nullable=False)
    model_version = Column(String(50), default="linear-moving-avg-v1", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    blood_group = Column(SQLEnum(BloodGroup), nullable=False, index=True)
    risk_level = Column(SQLEnum(RiskLevel), nullable=False, index=True)
    current_inventory = Column(Integer, nullable=False)
    predicted_demand = Column(Float, nullable=False)
    expiring_units = Column(Integer, default=0, nullable=False)
    active_requests = Column(Integer, default=0, nullable=False)
    reasons = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(100), nullable=False, index=True)
    recipient = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(String(100), nullable=True)
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="audit_logs")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AutomationEvent(Base):
    __tablename__ = "automation_events"

    id = Column(Integer, primary_key=True, index=True)
    workflow_name = Column(String(100), nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    payload = Column(JSON, nullable=True)
    status = Column(String(50), default="TRIGGERED", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class Donor(Base):
    __tablename__ = "donors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    blood_group = Column(SQLEnum(BloodGroup), nullable=False, index=True)
    gender = Column(SQLEnum(Gender), nullable=False, default=Gender.MALE)
    date_of_birth = Column(Date, nullable=True)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)
    address = Column(String(255), nullable=True)
    status = Column(SQLEnum(DonorStatus), nullable=False, default=DonorStatus.ACTIVE, index=True)
    last_donation_date = Column(Date, nullable=True)
    medical_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    donations = relationship("Donation", back_populates="donor", cascade="all, delete-orphan")


class Donation(Base):
    __tablename__ = "donations"

    id = Column(Integer, primary_key=True, index=True)
    donor_id = Column(Integer, ForeignKey("donors.id", ondelete="CASCADE"), nullable=False, index=True)
    blood_bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="CASCADE"), nullable=False, index=True)
    blood_inventory_id = Column(Integer, ForeignKey("blood_inventory.id", ondelete="SET NULL"), nullable=True)
    blood_group = Column(SQLEnum(BloodGroup), nullable=False)
    units = Column(Integer, nullable=False, default=1)
    donation_date = Column(Date, nullable=False, default=date.today)
    hemoglobin = Column(Float, nullable=True)
    blood_pressure = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    donor = relationship("Donor", back_populates="donations")
    blood_bank = relationship("BloodBank")
    inventory_batch = relationship("BloodInventory")


