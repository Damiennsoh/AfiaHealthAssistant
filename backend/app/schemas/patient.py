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
    age_years: Optional[int] = Field(None, ge=0, le=130)
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    region: Optional[str] = Field(None, max_length=120)
    community: Optional[str] = Field(None, max_length=160)
    locality: Optional[str] = Field(None, max_length=255)
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
        v = v.strip().upper()
        if not v:
            return None
        return v


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
    region: Optional[str] = None
    community: Optional[str] = None
    locality: Optional[str] = None
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
