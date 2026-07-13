"""
AFIA Health Assistant — Encounter Schemas (SOAP Notes)
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.models.encounter import EncounterType, EncounterStatus


class VitalSigns(BaseModel):
    """Patient vital signs."""
    model_config = ConfigDict(from_attributes=True)

    temperature: Optional[float] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    heart_rate: Optional[int] = None
    respiratory_rate: Optional[int] = None
    oxygen_saturation: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    bmi: Optional[float] = None


class Prescription(BaseModel):
    """Medication prescription."""
    model_config = ConfigDict(from_attributes=True)

    drug: str = Field(..., min_length=1)
    dose: str = Field(..., min_length=1)
    frequency: str = Field(..., min_length=1)
    duration: str = Field(..., min_length=1)
    route: str = "oral"
    instructions: Optional[str] = None
    source: Optional[str] = None


class LabOrder(BaseModel):
    """Laboratory test order."""
    model_config = ConfigDict(from_attributes=True)

    test: str = Field(..., min_length=1)
    status: str = "pending"
    result: Optional[str] = None
    ordered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class Diagnosis(BaseModel):
    """Diagnosis entry."""
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = None
    name: str = Field(..., min_length=1)
    type: str = "primary"


class KBQueryRecord(BaseModel):
    """Knowledge base query made during encounter."""
    model_config = ConfigDict(from_attributes=True)

    query: str
    results_count: int = 0
    top_result_citation: Optional[str] = None
    timestamp: datetime


class EncounterCreate(BaseModel):
    """Create new encounter."""
    model_config = ConfigDict(from_attributes=True)

    patient_id: UUID
    encounter_type: EncounterType = EncounterType.CONSULTATION
    vitals: Optional[VitalSigns] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    primary_diagnosis: Optional[Diagnosis] = None
    secondary_diagnoses: List[Diagnosis] = Field(default_factory=list)
    prescriptions: List[Prescription] = Field(default_factory=list)
    lab_orders: List[LabOrder] = Field(default_factory=list)
    referral_to: Optional[str] = None
    referral_reason: Optional[str] = None
    kb_queries: List[KBQueryRecord] = Field(default_factory=list)
    offline_id: Optional[str] = None


class EncounterUpdate(BaseModel):
    """Update existing encounter."""
    model_config = ConfigDict(from_attributes=True)

    vitals: Optional[VitalSigns] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    primary_diagnosis: Optional[Diagnosis] = None
    secondary_diagnoses: Optional[List[Diagnosis]] = None
    prescriptions: Optional[List[Prescription]] = None
    lab_orders: Optional[List[LabOrder]] = None
    referral_to: Optional[str] = None
    referral_reason: Optional[str] = None
    status: Optional[EncounterStatus] = None


class EncounterResponse(BaseModel):
    """Encounter response."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clinic_id: UUID
    patient_id: UUID
    patient_name: str
    encounter_date: datetime
    visit_number: int
    encounter_type: EncounterType
    status: EncounterStatus
    vitals: Optional[VitalSigns] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    primary_diagnosis: Optional[Diagnosis] = None
    secondary_diagnoses: List[Diagnosis] = Field(default_factory=list)
    prescriptions: List[Prescription] = Field(default_factory=list)
    lab_orders: List[LabOrder] = Field(default_factory=list)
    referral_to: Optional[str] = None
    referral_reason: Optional[str] = None
    kb_queries: List[KBQueryRecord] = Field(default_factory=list)
    created_by: UUID
    created_by_name: str
    sync_version: int = 1


class SOAPSummary(BaseModel):
    """Clean SOAP summary for display."""
    model_config = ConfigDict(from_attributes=True)

    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    vitals: Optional[VitalSigns] = None
    diagnosis: Dict[str, Any] = Field(default_factory=dict)
    prescriptions: List[Prescription] = Field(default_factory=list)
