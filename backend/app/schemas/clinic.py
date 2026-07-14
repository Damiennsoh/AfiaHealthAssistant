"""
AFIA Health Assistant — Clinic Schemas (Multi-tenant SaaS)
"""
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.models.clinic import SubscriptionTier, SubscriptionStatus


class ClinicBase(BaseModel):
    """Base clinic fields."""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=3, max_length=50, pattern=r"^[A-Z0-9-]+$")
    country_code: str = Field(..., min_length=2, max_length=2, pattern=r"^[A-Z]{2}$")
    region: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)


class ClinicCreate(ClinicBase):
    """Create clinic (super_admin only)."""
    admin_email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,}$")
    admin_name: str = Field(..., min_length=2, max_length=255)
    admin_temp_password: str = Field(..., min_length=8, max_length=128)
    tier: SubscriptionTier = SubscriptionTier.BASIC
    require_staff_id: bool = False
    require_department: bool = False

    @field_validator("country_code")
    @classmethod
    def validate_country(cls, v):
        allowed = {"GH", "ZW"}
        if v.upper() not in allowed:
            raise ValueError(f"Country must be one of: {allowed}")
        return v.upper()

    @field_validator("admin_temp_password")
    @classmethod
    def validate_password(cls, v):
        from app.core.security import validate_password_policy
        is_valid, error = validate_password_policy(v)
        if not is_valid:
            raise ValueError(error)
        return v


class ClinicUpdate(BaseModel):
    """Update clinic (clinic_admin or super_admin)."""
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, min_length=2, max_length=255)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    require_staff_id: Optional[bool] = None
    require_department: Optional[bool] = None
    features: Optional[Dict[str, Any]] = None


class SubscriptionUpdate(BaseModel):
    """Update subscription (super_admin or Stripe webhook)."""
    model_config = ConfigDict(from_attributes=True)

    tier: Optional[SubscriptionTier] = None
    status: Optional[SubscriptionStatus] = None
    trial_ends_at: Optional[datetime] = None
    stripe_subscription_id: Optional[str] = None


class PublicClinicResponse(BaseModel):
    """Simplified clinic schema for public discovery (unauthenticated)."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    code: str
    country_code: str
    region: Optional[str] = None
    district: Optional[str] = None
    is_active: bool
    require_staff_id: bool
    require_department: bool
    features: Dict[str, Any]


class ClinicResponse(ClinicBase):
    """Clinic response with subscription info."""
    id: UUID
    tier: SubscriptionTier
    status: SubscriptionStatus
    is_active: bool
    max_users: int
    max_patients: int
    max_storage_mb: int
    offline_enabled: bool
    offline_device_limit: int
    require_staff_id: bool
    require_department: bool
    features: Dict[str, Any]
    trial_ends_at: Optional[datetime] = None
    subscription_renews_at: Optional[datetime] = None
    created_at: datetime
    user_count: int = 0
    patient_count: int = 0
