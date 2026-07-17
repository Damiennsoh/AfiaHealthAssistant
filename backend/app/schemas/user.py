"""
AFIA Health Assistant — User Schemas
Admin-provisioned accounts only. No self-registration.
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict

from app.models.user import UserRole


class UserBase(BaseModel):
    """Base user fields."""
    model_config = ConfigDict(from_attributes=True)

    email: EmailStr
    name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    role: UserRole = UserRole.HEALTHWORKER
    is_active: bool = True


class UserCreate(UserBase):
    """Schema for creating a new user (admin only)."""
    clinic_id: UUID
    temp_password: Optional[str] = Field(None, min_length=12, max_length=128)
    staff_id: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)

    @field_validator("temp_password")
    @classmethod
    def validate_temp_password(cls, v):
        if v is None:
            return v
        from app.core.security import validate_password_policy
        is_valid, error = validate_password_policy(v)
        if not is_valid:
            raise ValueError(error)
        return v


class UserUpdate(BaseModel):
    """Schema for updating user (admin or self)."""
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    staff_id: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """User response (sensitive fields excluded)."""
    id: UUID
    clinic_id: Optional[UUID] = None
    country_code: str = "GH"
    staff_id: Optional[str] = None
    department: Optional[str] = None
    last_login: Optional[datetime] = None
    is_verified: bool
    created_at: datetime
    permissions: List[str] = []

    @field_validator("country_code", mode="before")
    @classmethod
    def set_country_code(cls, v, info):
        """Set country code based on clinic or default to 'GH'."""
        # Check if clinic exists in the model instance
        if hasattr(info.context, "clinic") and info.context.clinic:
            return info.context.clinic.country_code
        return "GH"


class LoginRequest(BaseModel):
    """Login credentials with clinic, staff, and department context."""
    email: EmailStr
    password: str = Field(..., min_length=1)
    clinic_id: Optional[UUID] = None  # Optional for super_admin
    role: Optional[UserRole] = None  # Specify role for super_admin login
    staff_id: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    device_fingerprint: Optional[str] = None


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class PasswordChange(BaseModel):
    """Password change request."""
    current_password: str
    new_password: str = Field(..., min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        from app.core.security import validate_password_policy
        is_valid, error = validate_password_policy(v)
        if not is_valid:
            raise ValueError(error)
        return v


class PasswordResetRequest(BaseModel):
    """Admin-initiated password reset."""
    user_id: Optional[UUID] = None
    new_password: str = Field(..., min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        from app.core.security import validate_password_policy
        is_valid, error = validate_password_policy(v)
        if not is_valid:
            raise ValueError(error)
        return v
