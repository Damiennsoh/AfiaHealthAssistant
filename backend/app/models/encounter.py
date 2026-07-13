"""
AFIA Health Assistant — Encounter Model (SOAP Notes)
Patient visit records, multi-tenant
"""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Enum, Integer, Date, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class EncounterType(str, PyEnum):
    """Types of patient encounters."""
    CONSULTATION = "consultation"
    FOLLOW_UP = "follow_up"
    EMERGENCY = "emergency"
    REFERRAL = "referral"
    LAB_REVIEW = "lab_review"
    PHARMACY = "pharmacy"


class EncounterStatus(str, PyEnum):
    """Encounter status."""
    DRAFT = "draft"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Encounter(BaseModel):
    """Patient encounter/visit — SOAP format."""
    __tablename__ = "encounters"

    # Multi-tenant
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)

    # Visit identification
    encounter_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    visit_number = Column(Integer, nullable=False)  # Sequential per patient
    encounter_type = Column(Enum(EncounterType), default=EncounterType.CONSULTATION)
    status = Column(Enum(EncounterStatus), default=EncounterStatus.DRAFT)

    # Vitals
    vitals = Column(JSONB, default=dict)  # {
    #     "temperature": 37.2,
    #     "blood_pressure": {"systolic": 120, "diastolic": 80},
    #     "heart_rate": 72,
    #     "respiratory_rate": 16,
    #     "oxygen_saturation": 98,
    #     "weight_kg": 65.0,
    #     "height_cm": 170.0,
    #     "bmi": 22.5,
    # }

    # SOAP Notes
    subjective = Column(Text, nullable=True)  # Chief complaint, history
    objective = Column(Text, nullable=True)   # Physical exam, findings
    assessment = Column(Text, nullable=True)  # Diagnosis, differential
    plan = Column(Text, nullable=True)        # Treatment, follow-up, referrals

    # Diagnosis (ICD-10 codes)
    primary_diagnosis = Column(String(20), nullable=True)  # e.g., "A00.0"
    primary_diagnosis_name = Column(String(255), nullable=True)
    secondary_diagnoses = Column(JSONB, default=list)  # [{"code": "E11.9", "name": "Type 2 diabetes"}]

    # Prescriptions
    prescriptions = Column(JSONB, default=list)  # [{
    #     "drug": "Artemether-lumefantrine",
    #     "dose": "1x2 tablets",
    #     "frequency": "twice daily",
    #     "duration": "3 days",
    #     "route": "oral",
    #     "instructions": "Take with food",
    #     "source": "EDLIZ 2020, Ch.13, p.210",  # Knowledge base citation
    # }]

    # Lab orders
    lab_orders = Column(JSONB, default=list)  # [{"test": "Malaria RDT", "status": "pending", "result": null}]

    # Referrals
    referral_to = Column(String(255), nullable=True)  # Facility name
    referral_reason = Column(Text, nullable=True)

    # Knowledge base queries made during this encounter
    kb_queries = Column(JSONB, default=list)  # [{
    #     "query": "first line malaria treatment children",
    #     "results_count": 5,
    #     "top_result_citation": "EDLIZ 2020, Ch.13, p.210",
    #     "timestamp": "2024-06-15T10:30:00Z"
    # }]

    # Creator
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Offline sync
    offline_id = Column(String(100), nullable=True, index=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    sync_version = Column(Integer, default=1)

    # Relationships
    clinic = relationship("Clinic", back_populates="encounters")
    patient = relationship("Patient", back_populates="encounters")
    created_by_user = relationship("User", back_populates="encounters")

    def get_soap_summary(self) -> dict:
        """Return a clean SOAP summary for display."""
        return {
            "subjective": self.subjective,
            "objective": self.objective,
            "assessment": self.assessment,
            "plan": self.plan,
            "vitals": self.vitals,
            "diagnosis": {
                "primary": self.primary_diagnosis_name,
                "secondary": [d["name"] for d in (self.secondary_diagnoses or [])],
            },
            "prescriptions": self.prescriptions,
        }
