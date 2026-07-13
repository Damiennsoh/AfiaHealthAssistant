"""
AFIA Health Assistant — Patient Model
Encrypted PII, multi-tenant by clinic_id
"""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Enum, Integer, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class InsuranceType(str, PyEnum):
    """Insurance types (Ghana & Zimbabwe)."""
    NHIS = "nhis"           # Ghana National Health Insurance
    PRIVATE = "private"      # Private insurance
    CASH = "cash"            # Out-of-pocket
    COMPANY = "company"      # Employer-sponsored
    GOVERNMENT = "government"  # Government scheme
    OTHER = "other"


class Gender(str, PyEnum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Patient(BaseModel):
    """Patient record — all PII encrypted at rest."""
    __tablename__ = "patients"

    # Multi-tenant
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)

    # Folder number (unique per clinic, human-readable)
    folder_number = Column(String(50), nullable=False, index=True)

    # Encrypted PII (AES-256)
    name_encrypted = Column(Text, nullable=False)  # Full name
    date_of_birth = Column(Date, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    phone_encrypted = Column(Text, nullable=True)  # Mobile number
    address_encrypted = Column(Text, nullable=True)  # Home address
    emergency_contact_encrypted = Column(Text, nullable=True)  # Name + phone

    # Non-encrypted (safe to query)
    insurance_type = Column(Enum(InsuranceType), default=InsuranceType.CASH)
    insurance_number = Column(String(100), nullable=True)  # May be encrypted if sensitive

    # Medical (non-encrypted, searchable)
    blood_type = Column(String(10), nullable=True)
    allergies = Column(JSONB, default=list)  # ["penicillin", "sulfa"]
    chronic_conditions = Column(JSONB, default=list)  # ["hypertension", "diabetes"]

    # Metadata
    registered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)

    # Offline sync
    offline_id = Column(String(100), nullable=True, index=True)  # Client-generated UUID for offline
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    sync_version = Column(Integer, default=1)  # For conflict resolution

    # Relationships
    clinic = relationship("Clinic", back_populates="patients")
    encounters = relationship("Encounter", back_populates="patient", order_by="Encounter.encounter_date.desc()")

    def get_age(self) -> int:
        """Calculate patient age from date of birth."""
        if not self.date_of_birth:
            return 0
        today = datetime.now(timezone.utc).date()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )

    def to_offline_dict(self) -> dict:
        """Serialize for offline PWA cache (includes decrypted fields)."""
        from app.core.security import decrypt_field
        return {
            "id": str(self.id),
            "offline_id": self.offline_id,
            "folder_number": self.folder_number,
            "name": decrypt_field(self.name_encrypted),
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "gender": self.gender.value if self.gender else None,
            "phone": decrypt_field(self.phone_encrypted),
            "address": decrypt_field(self.address_encrypted),
            "emergency_contact": decrypt_field(self.emergency_contact_encrypted),
            "insurance_type": self.insurance_type.value if self.insurance_type else None,
            "insurance_number": self.insurance_number,
            "blood_type": self.blood_type,
            "allergies": self.allergies,
            "chronic_conditions": self.chronic_conditions,
            "sync_version": self.sync_version,
        }
