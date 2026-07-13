"""
AFIA Health Assistant — User Model (RBAC, Admin-Provisioned)
No self-registration. Accounts created by clinic_admin or super_admin.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class UserRole(str, PyEnum):
    """Role-based access control levels."""
    SUPER_ADMIN = "super_admin"      # You: can create clinics, manage everything
    CLINIC_ADMIN = "clinic_admin"    # Clinic manager: creates staff, manages clinic
    HEALTHWORKER = "healthworker"     # Doctor/nurse: patient care, read-only KB
    VIEWER = "viewer"                 # Read-only access (auditor, trainee)


class User(BaseModel):
    """User account — admin-provisioned only."""
    __tablename__ = "users"

    # Identity
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    
    # Staff context
    staff_id = Column(String(100), nullable=True, index=True)  # Unique staff/employee ID
    department = Column(String(100), nullable=True)  # e.g., "Pediatrics", "Nurse Station 2"

    # Auth
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.HEALTHWORKER)

    # Clinic context (multi-tenant)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=True)

    # Security
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)  # Email verified
    last_login = Column(DateTime(timezone=True), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Offline sync (for PWA)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    device_fingerprint = Column(String(255), nullable=True)  # For offline device binding

    # Relationships
    clinic = relationship("Clinic", foreign_keys=[clinic_id], back_populates="users")
    encounters = relationship("Encounter", back_populates="created_by_user")
    password_history = relationship("PasswordHistory", back_populates="user", order_by="PasswordHistory.created_at.desc()")
    audit_logs = relationship("AuditLog", back_populates="user")

    def is_locked(self) -> bool:
        """Check if account is currently locked."""
        if self.locked_until and self.locked_until > datetime.now(timezone.utc):
            return True
        return False

    def can(self, permission: str) -> bool:
        """Check if user has a specific permission."""
        permissions_map = {
            UserRole.SUPER_ADMIN: ["*"],  # All permissions
            UserRole.CLINIC_ADMIN: [
                "users:create", "users:read", "users:update", "users:delete",
                "patients:create", "patients:read", "patients:update",
                "encounters:create", "encounters:read", "encounters:update",
                "clinic:read", "clinic:update",
                "knowledge:query", "sync:push", "sync:pull",
            ],
            UserRole.HEALTHWORKER: [
                "patients:create", "patients:read", "patients:update",
                "encounters:create", "encounters:read", "encounters:update",
                "knowledge:query", "sync:push", "sync:pull",
            ],
            UserRole.VIEWER: [
                "patients:read", "encounters:read", "knowledge:query",
            ],
        }
        user_perms = permissions_map.get(self.role, [])
        return "*" in user_perms or permission in user_perms


class PasswordHistory(BaseModel):
    """Track last 5 passwords to prevent reuse."""
    __tablename__ = "password_history"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    hashed_password = Column(String(255), nullable=False)

    user = relationship("User", back_populates="password_history")
