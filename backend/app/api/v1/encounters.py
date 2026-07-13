"""
AFIA Health Assistant — Encounters API (SOAP Notes)
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import require_healthworker, get_current_active_user
from app.models.user import User
from app.schemas.encounter import EncounterCreate, EncounterUpdate, EncounterResponse
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
    return [await service.to_response(e, current_user) for e in encounters]


@router.post("/", response_model=EncounterResponse)
async def create_encounter(
    data: EncounterCreate,
    current_user: User = Depends(require_healthworker),
    db: AsyncSession = Depends(get_db),
):
    """Create encounter."""
    service = EncounterService(db)
    encounter = await service.create_encounter(data, current_user)
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
    return await service.to_response(encounter, current_user)


@router.put("/{encounter_id}", response_model=EncounterResponse)
async def update_encounter(
    encounter_id: UUID,
    data: EncounterUpdate,
    current_user: User = Depends(require_healthworker),
    db: AsyncSession = Depends(get_db),
):
    """Update encounter."""
    service = EncounterService(db)
    encounter = await service.update_encounter(encounter_id, data, current_user)
    return await service.to_response(encounter, current_user)
