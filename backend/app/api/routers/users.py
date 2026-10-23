from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_admin
from app.models.entities import User
from app.models.enums import UserRole
from app.schemas.user import UserRead, UserCreate, UserUpdate
from app.services.auth_service import hash_password
from app.services.audit_service import log_action

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserRead])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: List all registered system users."""
    users = db.query(User).all()
    results = []
    for u in users:
        org_name = None
        if u.hospital:
            org_name = u.hospital.name
        elif u.blood_bank:
            org_name = u.blood_bank.name
        ur = UserRead.model_validate(u)
        ur.organization_name = org_name
        results.append(ur)
    return results


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: Create a new hospital staff, blood bank staff, or administrator."""
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        role=user_in.role,
        organization_type=user_in.organization_type,
        hospital_id=user_in.hospital_id,
        blood_bank_id=user_in.blood_bank_id,
        is_active=user_in.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(
        db=db,
        action="USER_CREATED",
        entity_type="USER",
        entity_id=str(user.id),
        description=f"Created user account {user.email} with role {user.role.value}",
        user_id=current_user.id,
    )

    return UserRead.model_validate(user)
