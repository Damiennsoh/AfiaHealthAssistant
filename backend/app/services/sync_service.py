"""
AFIA Health Assistant — Sync Service
Offline-first sync: queue, retry, conflict resolution, lossless multi-device sync
"""
from datetime import datetime, timezone, date
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.core.exceptions import SyncConflictError, AuthorizationError, DuplicateResourceError
from app.core.logging import audit_logger
from app.core.security import encrypt_field
from app.models.sync import SyncQueue, SyncStatus, SyncEntityType
from app.models.patient import Patient, InsuranceType, Gender
from app.models.encounter import Encounter, EncounterStatus, EncounterType
from app.models.user import User
from app.schemas.sync import (
    SyncPushRequest, SyncPullResponse, SyncItem, SyncResult,
    SyncAckRequest, SyncConflict
)
from app.schemas.patient import PatientCreate
from app.services.patient_service import PatientService


def parse_iso_datetime(dt_str: Any) -> Optional[datetime]:
    """Parse ISO formatted datetime string safely with UTC timezone."""
    if not dt_str:
        return None
    if isinstance(dt_str, datetime):
        return dt_str if dt_str.tzinfo else dt_str.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(dt_str).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except (ValueError, TypeError):
        return None


def parse_iso_date(d_str: Any) -> Optional[date]:
    """Parse date from ISO string or date instance."""
    if not d_str:
        return None
    if isinstance(d_str, date) and not isinstance(d_str, datetime):
        return d_str
    if isinstance(d_str, datetime):
        return d_str.date()
    try:
        return date.fromisoformat(str(d_str)[:10])
    except (ValueError, TypeError):
        return None


def parse_insurance(payload: Dict[str, Any]) -> tuple[InsuranceType, Optional[str]]:
    """Extract and normalize insurance type and identifier from payload."""
    has_nhis = payload.get("hasNHIS") or payload.get("insurance_type") == "nhis"
    has_insurance = payload.get("hasInsurance") or (
        payload.get("insurance_type") and payload.get("insurance_type") != "cash"
    )
    if has_nhis:
        ins_type = InsuranceType.NHIS
        ins_num = payload.get("nhisNumber") or payload.get("insurance_number")
    elif has_insurance:
        raw_type = payload.get("insurance_type")
        try:
            ins_type = InsuranceType(str(raw_type).lower()) if raw_type else InsuranceType.PRIVATE
        except ValueError:
            ins_type = InsuranceType.PRIVATE
        ins_num = payload.get("medicalAidNumber") or payload.get("insurance_number")
    else:
        ins_type = InsuranceType.CASH
        ins_num = None
    return ins_type, ins_num


def parse_gender(payload: Dict[str, Any]) -> Optional[Gender]:
    """Parse gender from sex/gender field."""
    raw = payload.get("sex") or payload.get("gender")
    if not raw:
        return None
    try:
        return Gender(str(raw).lower())
    except ValueError:
        return Gender.OTHER


class SyncService:
    """Handle offline sync queue and cross-device reconciliation."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def push_changes(self, request: SyncPushRequest, user: User) -> List[SyncResult]:
        """Process client push of offline changes."""
        results = []

        for item in request.items:
            try:
                result = await self._process_sync_item(item, user, request.device_id)
                results.append(result)
            except Exception as e:
                results.append(SyncResult(
                    offline_id=item.offline_id,
                    status="failed",
                    error=str(e),
                ))

        return results

    async def _process_sync_item(self, item: SyncItem, user: User, device_id: str) -> SyncResult:
        """Process a single sync item."""
        if item.entity_type == SyncEntityType.PATIENT:
            return await self._sync_patient(item, user, device_id)
        elif item.entity_type == SyncEntityType.ENCOUNTER:
            return await self._sync_encounter(item, user, device_id)
        else:
            raise ValueError(f"Unknown entity type: {item.entity_type}")

    async def _sync_patient(self, item: SyncItem, user: User, device_id: str) -> SyncResult:
        """Sync a patient record preserving all demographic and PWA fields."""
        payload = dict(item.payload or {})
        folder_num = payload.get("folderNumber") or payload.get("folder_number")
        offline_id = item.offline_id or payload.get("id") or payload.get("offlineId")

        # Find existing patient by offline_id, server ID, or folder number within clinic
        or_clauses = []
        if offline_id:
            or_clauses.append(Patient.offline_id == offline_id)
        if item.entity_server_id:
            or_clauses.append(Patient.id == item.entity_server_id)
        if payload.get("id"):
            or_clauses.append(Patient.offline_id == str(payload.get("id")))
        if folder_num:
            or_clauses.append(Patient.folder_number == folder_num)

        existing = None
        if or_clauses:
            result = await self.db.execute(
                select(Patient).where(
                    and_(
                        Patient.clinic_id == user.clinic_id,
                        or_(*or_clauses),
                    )
                )
            )
            existing = result.scalar_one_or_none()

        client_updated_at = parse_iso_datetime(payload.get("updatedAt") or item.created_at)

        if existing:
            # Check version conflict with Last-Write-Wins (LWW)
            if existing.sync_version > item.payload_version:
                if not client_updated_at or (existing.updated_at and existing.updated_at.tzinfo and client_updated_at <= existing.updated_at):
                    return SyncResult(
                        offline_id=item.offline_id,
                        status="conflict_resolved_server_wins",
                        server_id=existing.id,
                        server_version=existing.sync_version,
                        server_payload=existing.to_offline_dict(),
                    )

            # Update existing record
            name = payload.get("name")
            if name:
                existing.name_encrypted = encrypt_field(name)
            if "phone" in payload:
                existing.phone_encrypted = encrypt_field(payload.get("phone"))
            if "address" in payload or "locality" in payload:
                existing.address_encrypted = encrypt_field(payload.get("address") or payload.get("locality"))
            if "emergencyContact" in payload or "emergency_contact" in payload:
                existing.emergency_contact_encrypted = encrypt_field(payload.get("emergencyContact") or payload.get("emergency_contact"))

            age = payload.get("age") or payload.get("age_years")
            if age is not None:
                try:
                    existing.age_years = int(age)
                except (ValueError, TypeError):
                    pass
            dob = parse_iso_date(payload.get("dateOfBirth") or payload.get("date_of_birth"))
            if dob:
                existing.date_of_birth = dob
            gender = parse_gender(payload)
            if gender:
                existing.gender = gender
            if "region" in payload:
                existing.region = payload.get("region")
            if "community" in payload:
                existing.community = payload.get("community")
            if "locality" in payload:
                existing.locality = payload.get("locality")

            ins_type, ins_num = parse_insurance(payload)
            existing.insurance_type = ins_type
            existing.insurance_number = ins_num

            if "bloodType" in payload or "blood_type" in payload:
                existing.blood_type = payload.get("bloodType") or payload.get("blood_type")
            if "allergies" in payload:
                existing.allergies = payload.get("allergies") or []
            if "chronicConditions" in payload or "chronic_conditions" in payload:
                existing.chronic_conditions = payload.get("chronicConditions") or payload.get("chronic_conditions") or []

            if "isDeleted" in payload or "deleted" in payload:
                existing.is_active = not bool(payload.get("isDeleted") or payload.get("deleted", False))

            existing.sync_version = max(existing.sync_version, item.payload_version or 1) + 1
            existing.last_sync_at = datetime.now(timezone.utc)
            if client_updated_at:
                existing.updated_at = client_updated_at

            await self.db.commit()

            return SyncResult(
                offline_id=item.offline_id,
                status="acknowledged",
                server_id=existing.id,
                server_version=existing.sync_version,
            )
        else:
            # Create new patient
            ins_type, ins_num = parse_insurance(payload)
            age_val = payload.get("age") or payload.get("age_years")
            age_int = int(age_val) if age_val is not None else None

            patient_data = PatientCreate(
                name=payload.get("name") or "Unnamed Patient",
                folder_number=folder_num,
                date_of_birth=parse_iso_date(payload.get("dateOfBirth") or payload.get("date_of_birth")),
                gender=parse_gender(payload),
                age_years=age_int,
                phone=payload.get("phone"),
                address=payload.get("address") or payload.get("locality"),
                emergency_contact=payload.get("emergencyContact") or payload.get("emergency_contact"),
                region=payload.get("region"),
                community=payload.get("community"),
                locality=payload.get("locality"),
                insurance_type=ins_type,
                insurance_number=ins_num,
                blood_type=payload.get("bloodType") or payload.get("blood_type"),
                allergies=payload.get("allergies") or [],
                chronic_conditions=payload.get("chronicConditions") or payload.get("chronic_conditions") or [],
                offline_id=offline_id,
            )

            patient_service = PatientService(self.db)
            try:
                patient = await patient_service.create_patient(patient_data, user)
            except DuplicateResourceError:
                # In case folder number was already allocated, fetch and reconcile
                res = await self.db.execute(
                    select(Patient).where(
                        and_(
                            Patient.clinic_id == user.clinic_id,
                            Patient.folder_number == folder_num,
                        )
                    )
                )
                patient = res.scalar_one_or_none()
                if not patient:
                    raise
                if offline_id and not patient.offline_id:
                    patient.offline_id = offline_id
                    await self.db.commit()

            if item.payload_version and item.payload_version > 1:
                patient.sync_version = item.payload_version

            created_at_dt = parse_iso_datetime(payload.get("createdAt"))
            if created_at_dt:
                patient.created_at = created_at_dt
                patient.registered_at = created_at_dt
            if client_updated_at:
                patient.updated_at = client_updated_at

            if payload.get("isDeleted") or payload.get("deleted"):
                patient.is_active = False

            await self.db.commit()

            return SyncResult(
                offline_id=item.offline_id,
                status="acknowledged",
                server_id=patient.id,
                server_version=patient.sync_version,
            )

    async def _sync_encounter(self, item: SyncItem, user: User, device_id: str) -> SyncResult:
        """Sync an encounter record with complete offline payload persistence."""
        payload = dict(item.payload or {})
        offline_id = item.offline_id or payload.get("id") or payload.get("offlineId")

        # Check if encounter exists by offline_id or server ID within clinic
        or_clauses = []
        if offline_id:
            or_clauses.append(Encounter.offline_id == offline_id)
        if item.entity_server_id:
            or_clauses.append(Encounter.id == item.entity_server_id)
        if payload.get("id"):
            or_clauses.append(Encounter.offline_id == str(payload.get("id")))

        existing = None
        if or_clauses:
            result = await self.db.execute(
                select(Encounter).where(
                    and_(
                        Encounter.clinic_id == user.clinic_id,
                        or_(*or_clauses),
                    )
                )
            )
            existing = result.scalar_one_or_none()

        client_updated_at = parse_iso_datetime(payload.get("updatedAt") or item.created_at)

        if existing:
            # Check version conflict with Last-Write-Wins (LWW)
            if existing.sync_version > item.payload_version:
                if not client_updated_at or (existing.updated_at and existing.updated_at.tzinfo and client_updated_at <= existing.updated_at):
                    return SyncResult(
                        offline_id=item.offline_id,
                        status="conflict_resolved_server_wins",
                        server_id=existing.id,
                        server_version=existing.sync_version,
                        server_payload=existing.to_offline_dict(),
                    )

            # Update existing
            existing.offline_payload = payload
            if payload.get("vitals"):
                existing.vitals = payload.get("vitals")
            if payload.get("history") or payload.get("presentingComplaint"):
                existing.subjective = payload.get("history") or payload.get("presentingComplaint")
            if payload.get("notes"):
                existing.objective = payload.get("notes")
            if payload.get("diagnosis"):
                existing.assessment = payload.get("diagnosis")
                existing.primary_diagnosis_name = payload.get("diagnosis")
            if payload.get("treatment"):
                existing.plan = payload.get("treatment")
            if payload.get("drugs"):
                existing.prescriptions = payload.get("drugs")
            if payload.get("labResults"):
                existing.lab_orders = payload.get("labResults")
            if payload.get("status"):
                existing.status = EncounterStatus.COMPLETED if payload.get("status") == "completed" else EncounterStatus.DRAFT

            existing.sync_version = max(existing.sync_version, item.payload_version or 1) + 1
            existing.last_sync_at = datetime.now(timezone.utc)
            if client_updated_at:
                existing.updated_at = client_updated_at

            await self.db.commit()

            return SyncResult(
                offline_id=item.offline_id,
                status="acknowledged",
                server_id=existing.id,
                server_version=existing.sync_version,
            )
        else:
            # Resolve patient reference within clinic
            patient_ref = payload.get("patientId") or payload.get("patient_id")
            patient = None
            if patient_ref:
                p_res = await self.db.execute(
                    select(Patient).where(
                        and_(
                            Patient.clinic_id == user.clinic_id,
                            Patient.offline_id == str(patient_ref),
                        )
                    )
                )
                patient = p_res.scalar_one_or_none()
                if not patient:
                    try:
                        p_uuid = UUID(str(patient_ref))
                        p_res = await self.db.execute(
                            select(Patient).where(
                                and_(
                                    Patient.clinic_id == user.clinic_id,
                                    Patient.id == p_uuid,
                                )
                            )
                        )
                        patient = p_res.scalar_one_or_none()
                    except (ValueError, TypeError):
                        pass

            if not patient:
                return SyncResult(
                    offline_id=item.offline_id,
                    status="failed",
                    error=f"Patient reference '{patient_ref}' not found in clinic.",
                )

            # Sequential visit number per patient
            visit_result = await self.db.execute(
                select(func.count(Encounter.id)).where(Encounter.patient_id == patient.id)
            )
            visit_number = (visit_result.scalar() or 0) + 1

            encounter_date = parse_iso_datetime(payload.get("date") or payload.get("createdAt")) or datetime.now(timezone.utc)
            enc_status = EncounterStatus.COMPLETED if payload.get("status") == "completed" else EncounterStatus.DRAFT

            encounter = Encounter(
                clinic_id=user.clinic_id,
                patient_id=patient.id,
                encounter_date=encounter_date,
                visit_number=visit_number,
                encounter_type=EncounterType.CONSULTATION,
                status=enc_status,
                vitals=payload.get("vitals") or {},
                subjective=payload.get("history") or payload.get("presentingComplaint"),
                objective=payload.get("notes"),
                assessment=payload.get("diagnosis"),
                plan=payload.get("treatment"),
                primary_diagnosis_name=payload.get("diagnosis"),
                prescriptions=payload.get("drugs") or [],
                lab_orders=payload.get("labResults") or [],
                created_by=user.id,
                offline_id=offline_id,
                sync_version=max(item.payload_version or 1, 1),
                offline_payload=payload,
                last_sync_at=datetime.now(timezone.utc),
            )
            self.db.add(encounter)
            await self.db.flush()

            client_created_at = parse_iso_datetime(payload.get("createdAt"))
            if client_created_at:
                encounter.created_at = client_created_at
            if client_updated_at:
                encounter.updated_at = client_updated_at

            await self.db.commit()

            return SyncResult(
                offline_id=item.offline_id,
                status="acknowledged",
                server_id=encounter.id,
                server_version=encounter.sync_version,
            )

    async def pull_changes(self, device_id: str, user: User, last_sync_at: Optional[datetime] = None) -> SyncPullResponse:
        """Get changes from server for client (both patients and encounters)."""
        # 1. Patients modified since last sync
        patient_conditions = [Patient.clinic_id == user.clinic_id]
        if last_sync_at:
            patient_conditions.append(Patient.updated_at > last_sync_at)
        patient_query = select(Patient).where(and_(*patient_conditions)).order_by(Patient.updated_at.asc())

        patient_result = await self.db.execute(patient_query)
        patients = patient_result.scalars().all()

        items = []
        for patient in patients:
            items.append(SyncItem(
                offline_id=patient.offline_id or str(patient.id),
                entity_type=SyncEntityType.PATIENT,
                entity_server_id=patient.id,
                payload=patient.to_offline_dict(),
                payload_version=patient.sync_version,
                created_at=patient.updated_at or patient.created_at or datetime.now(timezone.utc),
            ))

        # 2. Encounters modified since last sync
        encounter_conditions = [Encounter.clinic_id == user.clinic_id]
        if last_sync_at:
            encounter_conditions.append(Encounter.updated_at > last_sync_at)
        encounter_query = (
            select(Encounter)
            .options(selectinload(Encounter.patient))
            .where(and_(*encounter_conditions))
            .order_by(Encounter.updated_at.asc())
        )

        encounter_result = await self.db.execute(encounter_query)
        encounters = encounter_result.scalars().all()

        for encounter in encounters:
            items.append(SyncItem(
                offline_id=encounter.offline_id or str(encounter.id),
                entity_type=SyncEntityType.ENCOUNTER,
                entity_server_id=encounter.id,
                payload=encounter.to_offline_dict(),
                payload_version=encounter.sync_version,
                created_at=encounter.updated_at or encounter.created_at or datetime.now(timezone.utc),
            ))

        return SyncPullResponse(
            device_id=device_id,
            server_time=datetime.now(timezone.utc),
            items=items,
            deleted_ids=[],
            has_more=False,
        )
