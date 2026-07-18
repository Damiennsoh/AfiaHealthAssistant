"""
AFIA Health Assistant — Clinic Model (Multi-tenant SaaS)
Each clinic subscribes to the service. Data is isolated by clinic_id.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import BaseModel, SoftDeleteMixin


class SubscriptionTier(str, PyEnum):
    """Subscription tiers for clinics."""
    BASIC = "basic"           # SaaS only, urban clinics
    PRO = "pro"               # SaaS + offline PWA, rural clinics
    ENTERPRISE = "enterprise"  # Self-hosted option for hospital groups


class SubscriptionStatus(str, PyEnum):
    """Subscription status."""
    ACTIVE = "active"
    TRIAL = "trial"
    EXPIRED = "expired"
    SUSPENDED = "suspended"


class Clinic(BaseModel, SoftDeleteMixin):
    """Clinic/Health facility — the tenant unit."""
    __tablename__ = "clinics"

    # Identity
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)  # e.g., "ACCRA-001"
    
    # Country context (determines knowledge base)
    country_code = Column(String(2), nullable=False, index=True)  # "GH" or "ZW"
    region = Column(String(100), nullable=True)  # Region/province
    district = Column(String(100), nullable=True)  # District
    
    # Contact
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    
    # Subscription (SaaS billing)
    tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.BASIC)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.TRIAL)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    subscription_renews_at = Column(DateTime(timezone=True), nullable=True)
    
    # Usage limits
    max_users = Column(Integer, default=5)  # Staff accounts
    max_patients = Column(Integer, default=10000)
    max_storage_mb = Column(Integer, default=1024)  # MinIO storage
    
    # Offline PWA config (for PRO tier)
    offline_enabled = Column(Boolean, default=False)
    offline_device_limit = Column(Integer, default=3)  # Max devices for offline sync
    last_offline_sync = Column(DateTime(timezone=True), nullable=True)
    
    # Features
    features = Column(JSONB, default=dict)  # {"analytics": true, "custom_reports": false}
    
    # Validation requirements for login
    require_staff_id = Column(Boolean, default=False)
    require_department = Column(Boolean, default=False)
    
    # Admin
    admin_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Suspension & Archival (for subscription management)
    is_suspended = Column(Boolean, default=False)
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    suspended_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # ✅ ADDED: Explicit archive flag matching DB migration
    is_archived = Column(Boolean, default=False, nullable=False, server_default="false")
    archived_at = Column(DateTime(timezone=True), nullable=True)
    archived_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    is_demo_clinic = Column(Boolean, default=False)
    
    # Soft delete — row is hidden but never destroyed (preserves audit trails and FK integrity)
    # NOTE: The `is_deleted` column is inherited from SoftDeleteMixin

    # Relationships
    users = relationship("User", foreign_keys="User.clinic_id", back_populates="clinic", cascade="all, delete-orphan")
    patients = relationship("Patient", back_populates="clinic", cascade="all, delete-orphan")
    encounters = relationship("Encounter", back_populates="clinic")
    audit_logs = relationship("AuditLog", back_populates="clinic")

    def get_knowledge_base(self) -> str:
        """Return the knowledge base identifier for this clinic's country."""
        country_kb = {
            "GH": "ghana_stg_2025",
            "ZW": "edliz_2020",
        }
        return country_kb.get(self.country_code.upper(), "ghana_stg_2025")

    def is_trial_active(self) -> bool:
        """Check if trial period is still active."""
        if self.status == SubscriptionStatus.TRIAL and self.trial_ends_at:
            return self.trial_ends_at > datetime.now(timezone.utc)
        return False

    def can_use_offline(self) -> bool:
        """Check if clinic has offline PWA enabled."""
        return self.tier in [SubscriptionTier.PRO, SubscriptionTier.ENTERPRISE] and self.offline_enabled

    def suspend(self, user_id: uuid.UUID) -> None:
        """Suspend clinic (reversible). Blocks access due to non-payment/admin hold."""
        self.is_suspended = True
        self.suspended_at = datetime.now(timezone.utc)
        self.suspended_by = user_id
        self.is_active = False

    def unsuspend(self) -> None:
        """Unsuspend clinic (reactivate). Restores access upon payment/resolution."""
        self.is_suspended = False
        self.suspended_at = None
        self.suspended_by = None
        self.is_active = True

    def archive(self, user_id: uuid.UUID) -> None:
        """Archive clinic (end-of-life). Hides from UI, preserves data for compliance."""
        # ✅ FIXED: Now sets is_archived = True so frontend/backend filters work
        self.is_archived = True
        self.archived_at = datetime.now(timezone.utc)
        self.archived_by = user_id
        self.is_active = False
        # Note: We do NOT touch is_deleted here. Archiving ≠ Deletion.

    def soft_delete(self) -> None:
        """
        Full soft-delete: hides the clinic from ALL queries and UI.
        Row is never destroyed — preserves audit logs and FK integrity.
        """
        self.is_deleted = True
        self.is_active = False