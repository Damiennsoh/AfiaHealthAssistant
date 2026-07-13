"""
AFIA Health Assistant — Audit Log Model
HIPAA/GDPR compliance: every data access logged for 7 years
"""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class AuditAction(str, PyEnum):
    """Types of auditable actions."""
    # Auth
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PASSWORD_CHANGED = "password_changed"
    ACCOUNT_LOCKED = "account_locked"

    # Patient data
    PATIENT_CREATED = "patient_created"
    PATIENT_READ = "patient_read"
    PATIENT_UPDATED = "patient_updated"
    PATIENT_SEARCHED = "patient_searched"

    # Encounters
    ENCOUNTER_CREATED = "encounter_created"
    ENCOUNTER_READ = "encounter_read"
    ENCOUNTER_UPDATED = "encounter_updated"

    # Knowledge base
    KB_QUERIED = "kb_queried"
    KB_RESULT_CLICKED = "kb_result_clicked"

    # Sync
    SYNC_PUSHED = "sync_pushed"
    SYNC_PULLED = "sync_pulled"
    SYNC_CONFLICT = "sync_conflict"

    # Admin
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    CLINIC_UPDATED = "clinic_updated"


class AuditLog(BaseModel):
    """Immutable audit log — 7-year retention required."""
    __tablename__ = "audit_logs"

    # Who
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)  # Denormalized for immutability
    user_role = Column(String(50), nullable=True)

    # Where
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    clinic_name = Column(String(255), nullable=True)  # Denormalized
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(Text, nullable=True)

    # What
    action = Column(Enum(AuditAction), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True)  # "patient", "encounter", "user"
    resource_id = Column(String(100), nullable=True)  # UUID or folder_number

    # Details (structured, searchable)
    details = Column(JSONB, default=dict)  # {
    #     "patient_folder_number": "GH-ACCRA-2024000001",
    #     "query": "malaria treatment",
    #     "results_count": 5,
    #     "changes": {"field": "phone", "old": "xxx", "new": "yyy"},
    # }

    # For knowledge base queries
    kb_query = Column(Text, nullable=True)
    kb_country = Column(String(2), nullable=True)
    kb_results_count = Column(Integer, nullable=True)
    kb_top_citation = Column(String(255), nullable=True)

    # Sync events
    sync_device_id = Column(String(255), nullable=True)
    sync_records_count = Column(Integer, nullable=True)

    # Retention (for automated cleanup after 7 years)
    retention_until = Column(DateTime(timezone=True), nullable=False)

    # Relationships (optional, for queries)
    user = relationship("User", back_populates="audit_logs")
    clinic = relationship("Clinic", back_populates="audit_logs")
