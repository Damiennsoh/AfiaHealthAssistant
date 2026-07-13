"""
AFIA Health Assistant — Encounter Service (SOAP Notes)
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.exceptions import AuthorizationError
from app.core.logging import audit_logger
from app.models.encounter import Encounter, EncounterStatus
from app.models.patient import Patient
from app.models.user import User
from app.schemas.encounter import EncounterCreate, EncounterUpdate, EncounterResponse


class EncounterService:
    """Manage patient encounters/visits."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_encounter(self, data: EncounterCreate, creator: User) -> Encounter:
        """Create a new patient encounter."""
        # Verify patient belongs to creator's clinic
        patient_result = await self.db.execute(
            select(Patient).where(
                and_(Patient.id == data.patient_id, Patient.clinic_id == creator.clinic_id)
            )
        )
        patient = patient_result.scalar_one_or_none()
        if not patient:
            raise AuthorizationError("Patient not found or not in your clinic")

        # Get next visit number for this patient
        visit_result = await self.db.execute(
            select(func.count(Encounter.id)).where(Encounter.patient_id == data.patient_id)
        )
        visit_number = visit_result.scalar() + 1

        encounter = Encounter(
            clinic_id=creator.clinic_id,
            patient_id=data.patient_id,
            encounter_date=datetime.now(timezone.utc),
            visit_number=visit_number,
            encounter_type=data.encounter_type,
            status=EncounterStatus.DRAFT,
            vitals=data.vitals.model_dump() if data.vitals else None,
            subjective=data.subjective,
            objective=data.objective,
            assessment=data.assessment,
            plan=data.plan,
            primary_diagnosis=data.primary_diagnosis.code if data.primary_diagnosis else None,
            primary_diagnosis_name=data.primary_diagnosis.name if data.primary_diagnosis else None,
            secondary_diagnoses=[d.model_dump() for d in data.secondary_diagnoses] if data.secondary_diagnoses else [],
            prescriptions=[p.model_dump() for p in data.prescriptions] if data.prescriptions else [],
            lab_orders=[l.model_dump() for l in data.lab_orders] if data.lab_orders else [],
            referral_to=data.referral_to,
            referral_reason=data.referral_reason,
            kb_queries=[q.model_dump() for q in data.kb_queries] if data.kb_queries else [],
            created_by=creator.id,
            offline_id=data.offline_id,
            sync_version=1,
        )

        self.db.add(encounter)
        await self.db.flush()

        audit_logger.info(
            "Encounter created",
            action="encounter_created",
            user_id=str(creator.id),
            patient_id=str(data.patient_id),
            encounter_id=str(encounter.id),
            visit_number=visit_number
        )

        await self.db.commit()
        return encounter

    async def get_encounters_by_patient(self, patient_id: UUID, requesting_user: User) -> List[Encounter]:
        """Get all encounters for a patient."""
        result = await self.db.execute(
            select(Encounter).where(
                and_(
                    Encounter.patient_id == patient_id,
                    Encounter.clinic_id == requesting_user.clinic_id
                )
            ).order_by(Encounter.encounter_date.desc())
        )
        return result.scalars().all()

    async def get_encounter(self, encounter_id: UUID, requesting_user: User) -> Encounter:
        """Get encounter by ID."""
        result = await self.db.execute(
            select(Encounter).where(
                and_(
                    Encounter.id == encounter_id,
                    Encounter.clinic_id == requesting_user.clinic_id
                )
            )
        )
        encounter = result.scalar_one_or_none()
        if not encounter:
            raise AuthorizationError("Encounter not found")
        return encounter

    async def update_encounter(self, encounter_id: UUID, data: EncounterUpdate, requesting_user: User) -> Encounter:
        """Update encounter."""
        encounter = await self.get_encounter(encounter_id, requesting_user)

        # Only creator or admin can update
        if encounter.created_by != requesting_user.id and requesting_user.role.value not in ["super_admin", "clinic_admin"]:
            raise AuthorizationError("Only the creator or admin can update this encounter")

        update_dict = data.model_dump(exclude_unset=True)

        for field, value in update_dict.items():
            if field in ["vitals", "secondary_diagnoses", "prescriptions", "lab_orders", "kb_queries"] and value is not None:
                if hasattr(value, "model_dump"):
                    value = value.model_dump()
                elif isinstance(value, list):
                    value = [v.model_dump() if hasattr(v, "model_dump") else v for v in value]
            setattr(encounter, field, value)

        encounter.sync_version += 1
        encounter.updated_at = datetime.now(timezone.utc)

        audit_logger.info(
            "Encounter updated",
            action="encounter_updated",
            user_id=str(requesting_user.id),
            encounter_id=str(encounter_id)
        )

        await self.db.commit()
        return encounter

    async def to_response(self, encounter: Encounter, requesting_user: User) -> EncounterResponse:
        """Convert encounter to response with patient name."""
        from app.core.security import decrypt_field
        from app.schemas.encounter import VitalSigns, Diagnosis, Prescription, LabOrder, KBQueryRecord

        patient_result = await self.db.execute(select(Patient).where(Patient.id == encounter.patient_id))
        patient = patient_result.scalar_one_or_none()
        patient_name = decrypt_field(patient.name_encrypted) if patient else "Unknown"

        creator_result = await self.db.execute(select(User).where(User.id == encounter.created_by))
        creator = creator_result.scalar_one_or_none()
        creator_name = creator.name if creator else "Unknown"

        return EncounterResponse(
            id=encounter.id,
            clinic_id=encounter.clinic_id,
            patient_id=encounter.patient_id,
            patient_name=patient_name,
            encounter_date=encounter.encounter_date,
            visit_number=encounter.visit_number,
            encounter_type=encounter.encounter_type,
            status=encounter.status,
            vitals=VitalSigns(**encounter.vitals) if encounter.vitals else None,
            subjective=encounter.subjective,
            objective=encounter.objective,
            assessment=encounter.assessment,
            plan=encounter.plan,
            primary_diagnosis=Diagnosis(code=encounter.primary_diagnosis, name=encounter.primary_diagnosis_name) if encounter.primary_diagnosis else None,
            secondary_diagnoses=[Diagnosis(**d) for d in (encounter.secondary_diagnoses or [])],
            prescriptions=[Prescription(**p) for p in (encounter.prescriptions or [])],
            lab_orders=[LabOrder(**l) for l in (encounter.lab_orders or [])],
            referral_to=encounter.referral_to,
            referral_reason=encounter.referral_reason,
            kb_queries=[KBQueryRecord(**q) for q in (encounter.kb_queries or [])],
            created_by=encounter.created_by,
            created_by_name=creator_name,
            sync_version=encounter.sync_version,
        )
