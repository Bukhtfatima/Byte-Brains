from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    email: str
    organization_type: Optional[str] = None
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None


class TokenPayload(BaseModel):
    sub: str  # User ID or Email
    role: str
    org_type: Optional[str] = None
    org_id: Optional[int] = None
    exp: Optional[int] = None
