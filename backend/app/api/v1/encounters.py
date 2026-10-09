"""
AFIA Health Assistant — Encounters API (SOAP Notes)
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import require_healthworker, get_current_active_user, block_demo_clinic_writes
from app.models.user import User
from app.models.audit import AuditAction
from app.schemas.encounter import EncounterCreate, EncounterUpdate, EncounterResponse
from app.services.audit_service import AuditService
from app.services.encounter_service import EncounterService

router = APIRouter()


@router.get("/patient/{patient_id}", response_model=List[EncounterResponse])
async def list_encounters(
    patient_id: UUID,
    current_user: User = Depends(require_healthworker),
    db: AsyncSession = Depends(get_db),
):
    """List encounters for a patient."""
    service = EncounterService(db)
    encounters = await service.get_encounters_by_patient(patient_id, current_user)
    await AuditService(db).log(
        action=AuditAction.ENCOUNTER_READ,
        user=current_user,
        clinic=current_user.clinic,
        resource_type="patient",
        resource_id=str(patient_id),
        details={"results_count": len(encounters)},
        ip_address=getattr(current_user, "_ip_address", None),
        user_agent=getattr(current_user, "_user_agent", None),
    )
    return [await service.to_response(e, current_user) for e in encounters]


@router.post("/", response_model=EncounterResponse)
async def create_encounter(
    data: EncounterCreate,
    current_user: User = Depends(require_healthworker),
    _: User = Depends(block_demo_clinic_writes),  # 🔒 Sandbox guard
    db: AsyncSession = Depends(get_db),
):
    """Create encounter. Blocked for demo/sandbox accounts."""
    service = EncounterService(db)
    encounter = await service.create_encounter(data, current_user)
    await AuditService(db).log(
        action=AuditAction.ENCOUNTER_CREATED,
        user=current_user,
        clinic=current_user.clinic,
        resource_type="encounter",
        resource_id=str(encounter.id),
        ip_address=getattr(current_user, "_ip_address", None),
        user_agent=getattr(current_user, "_user_agent", None),
    )
    return await service.to_response(encounter, current_user)


@router.get("/{encounter_id}", response_model=EncounterResponse)
async def get_encounter(
    encounter_id: UUID,
    current_user: User = Depends(require_healthworker),
    db: AsyncSession = Depends(get_db),
):
    """Get encounter by ID."""
    service = EncounterService(db)
    encounter = await service.get_encounter(encounter_id, current_user)
    await AuditService(db).log(
        action=AuditAction.ENCOUNTER_READ,
        user=current_user,
        clinic=current_user.clinic,
        resource_type="encounter",
        resource_id=str(encounter.id),
        ip_address=getattr(current_user, "_ip_address", None),
        user_agent=getattr(current_user, "_user_agent", None),
    )
    return await service.to_response(encounter, current_user)


@router.put("/{encounter_id}", response_model=EncounterResponse)
async def update_encounter(
    encounter_id: UUID,
    data: EncounterUpdate,
    current_user: User = Depends(require_healthworker),
    _: User = Depends(block_demo_clinic_writes),  # 🔒 Sandbox guard
    db: AsyncSession = Depends(get_db),
):
    """Update encounter. Blocked for demo/sandbox accounts."""
    service = EncounterService(db)
    encounter = await service.update_encounter(encounter_id, data, current_user)
    await AuditService(db).log(
        action=AuditAction.ENCOUNTER_UPDATED,
        user=current_user,
        clinic=current_user.clinic,
        resource_type="encounter",
        resource_id=str(encounter.id),
        ip_address=getattr(current_user, "_ip_address", None),
        user_agent=getattr(current_user, "_user_agent", None),
    )
    return await service.to_response(encounter, current_user)
