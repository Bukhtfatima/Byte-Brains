from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import logging

from app.api.deps import get_db, get_current_user
from app.models.entities import User, Hospital, BloodBank
from app.models.enums import UserRole, OrgType
from app.schemas.auth import LoginRequest, Token
from app.schemas.user import UserRead, UserCreate
from app.services.auth_service import verify_password, create_access_token, hash_password
from app.services.audit_service import log_action

logger = logging.getLogger("bloodbridge.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/organizations")
def get_public_organizations(db: Session = Depends(get_db)):
    """Retrieve list of hospitals and blood banks for user registration dropdowns."""
    hospitals = db.query(Hospital.id, Hospital.name, Hospital.location).all()
    blood_banks = db.query(BloodBank.id, BloodBank.name, BloodBank.location).all()
    return {
        "hospitals": [{"id": h.id, "name": h.name, "location": h.location} for h in hospitals],
        "blood_banks": [{"id": b.id, "name": b.name, "location": b.location} for b in blood_banks],
    }


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account with role-based association and return JWT token."""
    try:
        existing = db.query(User).filter(User.email == user_in.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists.",
            )

        # Set default organization if omitted based on role
        hosp_id = user_in.hospital_id
        bb_id = user_in.blood_bank_id
        org_type = user_in.organization_type

        if user_in.role == UserRole.HOSPITAL_STAFF and not hosp_id:
            hosp = db.query(Hospital).first()
            hosp_id = hosp.id if hosp else 1
            org_type = OrgType.HOSPITAL
        elif user_in.role == UserRole.BLOOD_BANK_STAFF and not bb_id:
            bb = db.query(BloodBank).first()
            bb_id = bb.id if bb else 1
            org_type = OrgType.BLOOD_BANK

        user = User(
            name=user_in.name,
            email=user_in.email,
            password_hash=hash_password(user_in.password),
            role=user_in.role,
            organization_type=org_type,
            hospital_id=hosp_id,
            blood_bank_id=bb_id,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        log_action(
            db=db,
            action="USER_REGISTERED",
            entity_type="USER",
            entity_id=str(user.id),
            description=f"New user {user.email} registered with role {user.role.value}.",
            user_id=user.id,
        )

        org_name = None
        org_id = None
        if user.hospital:
            org_name = user.hospital.name
            org_id = user.hospital_id
        elif user.blood_bank:
            org_name = user.blood_bank.name
            org_id = user.blood_bank_id

        access_token = create_access_token(
            data={
                "sub": user.email,
                "user_id": user.id,
                "role": user.role.value,
                "name": user.name,
                "org_type": user.organization_type.value if user.organization_type else None,
                "org_id": org_id,
            }
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            role=user.role.value,
            name=user.name,
            email=user.email,
            organization_type=user.organization_type.value if user.organization_type else None,
            organization_id=org_id,
            organization_name=org_name,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during registration: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user. Please try again.",
        )


@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with email and password, returning JWT access token."""
    try:
        user = db.query(User).filter(User.email == login_data.email).first()
        if not user or not verify_password(login_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive. Contact system administrator.",
            )

        # Determine organization details
        org_name = None
        org_id = None
        if user.hospital:
            org_name = user.hospital.name
            org_id = user.hospital_id
        elif user.blood_bank:
            org_name = user.blood_bank.name
            org_id = user.blood_bank_id

        access_token = create_access_token(
            data={
                "sub": user.email,
                "user_id": user.id,
                "role": user.role.value,
                "name": user.name,
                "org_type": user.organization_type.value if user.organization_type else None,
                "org_id": org_id,
            }
        )

        log_action(
            db=db,
            action="USER_LOGIN",
            entity_type="USER",
            entity_id=str(user.id),
            description=f"User {user.email} logged in successfully.",
            user_id=user.id,
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            role=user.role.value,
            name=user.name,
            email=user.email,
            organization_type=user.organization_type.value if user.organization_type else None,
            organization_id=org_id,
            organization_name=org_name,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service encountered an error.",
        )


@router.post("/token", response_model=Token, include_in_schema=False)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """OAuth2 password flow compatible endpoint for OpenAPI docs."""
    login_data = LoginRequest(email=form_data.username, password=form_data.password)
    return login(login_data=login_data, db=db)


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    """Return currently authenticated user details."""
    try:
        org_name = None
        if current_user.hospital:
            org_name = current_user.hospital.name
        elif current_user.blood_bank:
            org_name = current_user.blood_bank.name

        user_read = UserRead.model_validate(current_user)
        user_read.organization_name = org_name
        return user_read
    except Exception as e:
        logger.error(f"Error reading current user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile.",
        )


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Logout current user session and record audit trace."""
    try:
        log_action(
            db=db,
            action="USER_LOGOUT",
            entity_type="USER",
            entity_id=str(current_user.id),
            description=f"User {current_user.email} logged out.",
            user_id=current_user.id,
        )
    except Exception as e:
        logger.warning(f"Error logging logout event: {e}")
    return {"message": "Successfully logged out", "success": True}
