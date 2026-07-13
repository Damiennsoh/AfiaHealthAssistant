"""
AFIA Health Assistant — Patient Schemas
"""
from datetime import date, datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.models.patient import InsuranceType, Gender


class PatientBase(BaseModel):
    """Base patient fields."""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., min_length=2, max_length=255)
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    insurance_type: InsuranceType = InsuranceType.CASH
    insurance_number: Optional[str] = Field(None, max_length=100)
    blood_type: Optional[str] = Field(None, max_length=10)
    allergies: List[str] = Field(default_factory=list)
    chronic_conditions: List[str] = Field(default_factory=list)


class PatientCreate(PatientBase):
    """Create patient."""
    folder_number: Optional[str] = None
    offline_id: Optional[str] = None

    @field_validator("folder_number")
    @classmethod
    def validate_folder_number(cls, v):
        if v is None:
            return v
        parts = v.split("-")
        if len(parts) != 3:
            raise ValueError("Folder number must be format: CC-CLINIC-YYYYSEQUENCE")
        return v.upper()


class PatientUpdate(BaseModel):
    """Update patient."""
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, min_length=2, max_length=255)
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    insurance_type: Optional[InsuranceType] = None
    insurance_number: Optional[str] = Field(None, max_length=100)
    blood_type: Optional[str] = Field(None, max_length=10)
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class PatientResponse(PatientBase):
    """Patient response (decrypted fields)."""
    id: UUID
    clinic_id: UUID
    folder_number: str
    age: int = 0
    registered_at: datetime
    is_active: bool
    sync_version: int = 1
    last_encounter_date: Optional[datetime] = None
    total_encounters: int = 0


class PatientSearchResult(BaseModel):
    """Lightweight patient for search results."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    folder_number: str
    name: str
    age: int
    gender: Optional[str] = None
    phone: Optional[str] = None
    last_encounter_date: Optional[datetime] = None
