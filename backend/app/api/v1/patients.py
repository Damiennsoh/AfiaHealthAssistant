"""
AFIA Health Assistant — Patients API
Encrypted PII, multi-tenant
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import require_healthworker, get_current_active_user, block_demo_clinic_writes
from app.models.user import User
from app.models.audit import AuditAction
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, PatientSearchResult
from app.services.audit_service import AuditService
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
    patients = await service.search_patients(q, current_user)
    await AuditService(db).log(
        action=AuditAction.PATIENT_SEARCHED,
        user=current_user,
        clinic=current_user.clinic,
        resource_type="patient",
        details={"results_count": len(patients)},
        ip_address=getattr(current_user, "_ip_address", None),
        user_agent=getattr(current_user, "_user_agent", None),
    )
    return patients


@router.post("/", response_model=PatientResponse)
async def create_patient(
    data: PatientCreate,
    current_user: User = Depends(require_healthworker),
    _: User = Depends(block_demo_clinic_writes),  # 🔒 Sandbox guard
    db: AsyncSession = Depends(get_db),
):
    """Create patient. Blocked for demo/sandbox accounts."""
    service = PatientService(db)
    patient = await service.create_patient(data, current_user)
    await AuditService(db).log(
        action=AuditAction.PATIENT_CREATED,
        user=current_user,
        clinic=current_user.clinic,
        resource_type="patient",
        resource_id=str(patient.id),
        ip_address=getattr(current_user, "_ip_address", None),
        user_agent=getattr(current_user, "_user_agent", None),
    )
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
    await AuditService(db).log(
        action=AuditAction.PATIENT_READ,
        user=current_user,
        clinic=current_user.clinic,
        resource_type="patient",
        resource_id=str(patient.id),
        ip_address=getattr(current_user, "_ip_address", None),
        user_agent=getattr(current_user, "_user_agent", None),
    )
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
    await AuditService(db).log(
        action=AuditAction.PATIENT_READ,
        user=current_user,
        clinic=current_user.clinic,
        resource_type="patient",
        resource_id=str(patient.id),
        ip_address=getattr(current_user, "_ip_address", None),
        user_agent=getattr(current_user, "_user_agent", None),
    )
    return await service.to_response(patient)


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: UUID,
    data: PatientUpdate,
    current_user: User = Depends(require_healthworker),
    _: User = Depends(block_demo_clinic_writes),  # 🔒 Sandbox guard
    db: AsyncSession = Depends(get_db),
):
    """Update patient. Blocked for demo/sandbox accounts."""
    service = PatientService(db)
    patient = await service.update_patient(patient_id, data, current_user)
    await AuditService(db).log(
        action=AuditAction.PATIENT_UPDATED,
        user=current_user,
        clinic=current_user.clinic,
        resource_type="patient",
        resource_id=str(patient.id),
        ip_address=getattr(current_user, "_ip_address", None),
        user_agent=getattr(current_user, "_user_agent", None),
    )
    return await service.to_response(patient)
