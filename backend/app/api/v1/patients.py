"""
AFIA Health Assistant — Patients API
Encrypted PII, multi-tenant
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import require_healthworker, get_current_active_user
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, PatientSearchResult
from app.services.patient_service import PatientService

router = APIRouter()


@router.get("/search", response_model=List[PatientSearchResult])
async def search_patients(
    q: str = Query(..., min_length=2, description="Search query (name, folder number, phone)"),
    current_user: User = Depends(require_healthworker),
    db: AsyncSession = Depends(get_db),
):
    """Search patients."""
    service = PatientService(db)
    return await service.search_patients(q, current_user)


@router.post("/", response_model=PatientResponse)
async def create_patient(
    data: PatientCreate,
    current_user: User = Depends(require_healthworker),
    db: AsyncSession = Depends(get_db),
):
    """Create patient."""
    service = PatientService(db)
    patient = await service.create_patient(data, current_user)
    return await service.to_response(patient)


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: UUID,
    current_user: User = Depends(require_healthworker),
    db: AsyncSession = Depends(get_db),
):
    """Get patient by ID."""
    service = PatientService(db)
    patient = await service.get_patient(patient_id, current_user)
    return await service.to_response(patient)


@router.get("/by-folder/{folder_number}", response_model=PatientResponse)
async def get_patient_by_folder(
    folder_number: str,
    current_user: User = Depends(require_healthworker),
    db: AsyncSession = Depends(get_db),
):
    """Get patient by folder number."""
    service = PatientService(db)
    patient = await service.get_patient_by_folder(folder_number, current_user)
    return await service.to_response(patient)


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: UUID,
    data: PatientUpdate,
    current_user: User = Depends(require_healthworker),
    db: AsyncSession = Depends(get_db),
):
    """Update patient."""
    service = PatientService(db)
    patient = await service.update_patient(patient_id, data, current_user)
    return await service.to_response(patient)
