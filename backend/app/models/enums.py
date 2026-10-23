import enum


class UserRole(str, enum.Enum):
    HOSPITAL_STAFF = "hospital_staff"
    BLOOD_BANK_STAFF = "blood_bank_staff"
    ADMIN = "admin"


class OrgType(str, enum.Enum):
    HOSPITAL = "hospital"
    BLOOD_BANK = "blood_bank"


class BloodGroup(str, enum.Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"


class InventoryStatus(str, enum.Enum):
    AVAILABLE = "Available"
    RESERVED = "Reserved"
    ISSUED = "Issued"
    EXPIRED = "Expired"
    QUARANTINED = "Quarantined"


class RequestStatus(str, enum.Enum):
    SUBMITTED = "Submitted"
    REVIEWING = "Reviewing"
    APPROVED = "Approved"
    PARTIALLY_FULFILLED = "Partially Fulfilled"
    FULFILLED = "Fulfilled"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"


class RequestPriority(str, enum.Enum):
    NORMAL = "Normal"
    URGENT = "Urgent"
    CRITICAL = "Critical"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class DonorStatus(str, enum.Enum):
    ACTIVE = "Active"
    DEFERRED = "Deferred"
    INACTIVE = "Inactive"


class Gender(str, enum.Enum):
    MALE = "Male"
    FEMALE = "Female"
    OTHER = "Other"
