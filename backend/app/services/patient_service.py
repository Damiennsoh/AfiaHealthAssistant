"""
AFIA Health Assistant — Patient Service
Encrypted PII, folder number generation, multi-tenant
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_

from app.core.security import encrypt_field, decrypt_field, generate_folder_number
from app.core.exceptions import PatientNotFoundError, AuthorizationError, DuplicateResourceError
from app.core.logging import audit_logger
from app.models.patient import Patient
from app.models.clinic import Clinic
from app.models.user import User, UserRole
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, PatientSearchResult


class PatientService:
    """Manage patient records with encrypted PII."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_patient(self, patient_data: PatientCreate, creator: User) -> Patient:
        """Create a new patient record."""
        clinic_result = await self.db.execute(select(Clinic).where(Clinic.id == creator.clinic_id))
        clinic = clinic_result.scalar_one_or_none()

        if not clinic:
            raise AuthorizationError("Clinic not found")

        # Check patient limit
        count_result = await self.db.execute(
            select(func.count(Patient.id)).where(Patient.clinic_id == creator.clinic_id)
        )
        patient_count = count_result.scalar()
        if patient_count >= clinic.max_patients:
            raise AuthorizationError(f"Clinic patient limit reached ({clinic.max_patients})")

        # Generate folder number if not provided
        folder_number = patient_data.folder_number
        if not folder_number:
            # Get next sequence for this clinic
            seq_result = await self.db.execute(
                select(func.count(Patient.id)).where(Patient.clinic_id == creator.clinic_id)
            )
            sequence = seq_result.scalar() + 1
            folder_number = generate_folder_number(clinic.country_code, clinic.code, sequence)

        # Check folder number uniqueness
        existing = await self.db.execute(
            select(Patient).where(Patient.folder_number == folder_number)
        )
        if existing.scalar_one_or_none():
            raise DuplicateResourceError(f"Folder number {folder_number} already exists")

        # Encrypt PII
        patient = Patient(
            clinic_id=creator.clinic_id,
            folder_number=folder_number,
            name_encrypted=encrypt_field(patient_data.name),
            date_of_birth=patient_data.date_of_birth,
            gender=patient_data.gender,
            phone_encrypted=encrypt_field(patient_data.phone),
            address_encrypted=encrypt_field(patient_data.address),
            emergency_contact_encrypted=encrypt_field(patient_data.emergency_contact),
            insurance_type=patient_data.insurance_type,
            insurance_number=patient_data.insurance_number,
            blood_type=patient_data.blood_type,
            allergies=patient_data.allergies,
            chronic_conditions=patient_data.chronic_conditions,
            offline_id=patient_data.offline_id,
            sync_version=1,
        )

        self.db.add(patient)
        await self.db.flush()

        audit_logger.info(
            "Patient created",
            action="patient_created",
            user_id=str(creator.id),
            clinic_id=str(creator.clinic_id),
            patient_id=str(patient.id),
            folder_number=folder_number
        )

        await self.db.commit()
        return patient

    async def get_patient(self, patient_id: UUID, requesting_user: User) -> Patient:
        """Get patient by ID (with clinic isolation)."""
        result = await self.db.execute(
            select(Patient).where(
                and_(Patient.id == patient_id, Patient.clinic_id == requesting_user.clinic_id)
            )
        )
        patient = result.scalar_one_or_none()

        if not patient:
            raise PatientNotFoundError()

        audit_logger.info(
            "Patient accessed",
            action="patient_read",
            user_id=str(requesting_user.id),
            patient_id=str(patient_id),
            folder_number=patient.folder_number
        )

        return patient

    async def get_patient_by_folder(self, folder_number: str, requesting_user: User) -> Patient:
        """Get patient by folder number."""
        result = await self.db.execute(
            select(Patient).where(
                and_(
                    Patient.folder_number == folder_number.upper(),
                    Patient.clinic_id == requesting_user.clinic_id
                )
            )
        )
        patient = result.scalar_one_or_none()

        if not patient:
            raise PatientNotFoundError()

        return patient

    async def search_patients(self, query: str, requesting_user: User, limit: int = 20) -> List[PatientSearchResult]:
        """Search patients by name (decrypted) or folder number."""
        # For encrypted fields, we do a broad fetch and filter in Python
        # In production, consider using PostgreSQL pgcrypto or trigram indexes
        result = await self.db.execute(
            select(Patient).where(
                and_(
                    Patient.clinic_id == requesting_user.clinic_id,
                    Patient.is_active == True
                )
            ).limit(1000)  # Fetch clinic's patients, then filter
        )
        patients = result.scalars().all()

        query_lower = query.lower()
        results = []

        for patient in patients:
            name = decrypt_field(patient.name_encrypted) or ""
            phone = decrypt_field(patient.phone_encrypted) or ""

            if (query_lower in name.lower() or 
                query_lower in patient.folder_number.lower() or
                query_lower in phone.lower()):

                results.append(PatientSearchResult(
                    id=patient.id,
                    folder_number=patient.folder_number,
                    name=name,
                    age=patient.get_age(),
                    gender=patient.gender.value if patient.gender else None,
                    phone=phone,
                    last_encounter_date=None,  # Would need join
                ))

                if len(results) >= limit:
                    break

        audit_logger.info(
            "Patient search",
            action="patient_searched",
            user_id=str(requesting_user.id),
            query=query,
            results_count=len(results)
        )

        return results

    async def update_patient(self, patient_id: UUID, update_data: PatientUpdate, requesting_user: User) -> Patient:
        """Update patient record."""
        patient = await self.get_patient(patient_id, requesting_user)

        # Track changes for audit
        changes = {}

        for field, value in update_data.model_dump(exclude_unset=True).items():
            if field == "name":
                changes["name"] = value
                patient.name_encrypted = encrypt_field(value)
            elif field == "phone":
                changes["phone"] = value
                patient.phone_encrypted = encrypt_field(value)
            elif field == "address":
                changes["address"] = value
                patient.address_encrypted = encrypt_field(value)
            elif field == "emergency_contact":
                changes["emergency_contact"] = value
                patient.emergency_contact_encrypted = encrypt_field(value)
            else:
                changes[field] = value
                setattr(patient, field, value)

        patient.sync_version += 1
        patient.updated_at = datetime.now(timezone.utc)

        audit_logger.info(
            "Patient updated",
            action="patient_updated",
            user_id=str(requesting_user.id),
            patient_id=str(patient_id),
            changes=changes
        )

        await self.db.commit()
        return patient

    async def to_response(self, patient: Patient) -> PatientResponse:
        """Convert patient model to response (with decrypted fields)."""
        from sqlalchemy import select
        from app.models.encounter import Encounter

        # Get encounter stats
        encounter_result = await self.db.execute(
            select(func.count(Encounter.id), func.max(Encounter.encounter_date))
            .where(Encounter.patient_id == patient.id)
        )
        total_encounters, last_encounter = encounter_result.first()

        return PatientResponse(
            id=patient.id,
            clinic_id=patient.clinic_id,
            folder_number=patient.folder_number,
            name=decrypt_field(patient.name_encrypted),
            date_of_birth=patient.date_of_birth,
            gender=patient.gender,
            phone=decrypt_field(patient.phone_encrypted),
            address=decrypt_field(patient.address_encrypted),
            emergency_contact=decrypt_field(patient.emergency_contact_encrypted),
            insurance_type=patient.insurance_type,
            insurance_number=patient.insurance_number,
            blood_type=patient.blood_type,
            allergies=patient.allergies or [],
            chronic_conditions=patient.chronic_conditions or [],
            age=patient.get_age(),
            registered_at=patient.registered_at,
            is_active=patient.is_active,
            sync_version=patient.sync_version,
            last_encounter_date=last_encounter,
            total_encounters=total_encounters or 0,
        )
