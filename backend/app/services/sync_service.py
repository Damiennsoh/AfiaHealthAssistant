"""
AFIA Health Assistant — Sync Service
Offline-first sync: queue, retry, conflict resolution
"""
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.core.exceptions import SyncConflictError, AuthorizationError
from app.core.logging import audit_logger
from app.models.sync import SyncQueue, SyncStatus, SyncEntityType
from app.models.patient import Patient
from app.models.encounter import Encounter
from app.models.user import User
from app.schemas.sync import (
    SyncPushRequest, SyncPullResponse, SyncItem, SyncResult,
    SyncAckRequest, SyncConflict
)


class SyncService:
    """Handle offline sync queue."""

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
        """Sync a patient record."""
        from app.core.security import encrypt_field

        # Check if patient exists by offline_id
        result = await self.db.execute(
            select(Patient).where(
                and_(
                    Patient.clinic_id == user.clinic_id,
                    or_(
                        Patient.offline_id == item.offline_id,
                        Patient.id == item.entity_server_id,
                    )
                )
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Check version conflict
            if existing.sync_version > item.payload_version:
                # Server has newer version
                return SyncResult(
                    offline_id=item.offline_id,
                    status="conflict",
                    server_id=existing.id,
                    server_version=existing.sync_version,
                    server_payload=existing.to_offline_dict(),
                )

            # Update existing
            payload = item.payload
            existing.name_encrypted = encrypt_field(payload.get("name"))
            existing.phone_encrypted = encrypt_field(payload.get("phone"))
            existing.address_encrypted = encrypt_field(payload.get("address"))
            existing.emergency_contact_encrypted = encrypt_field(payload.get("emergency_contact"))
            existing.sync_version += 1
            existing.last_sync_at = datetime.now(timezone.utc)

            await self.db.commit()

            return SyncResult(
                offline_id=item.offline_id,
                status="acknowledged",
                server_id=existing.id,
                server_version=existing.sync_version,
            )
        else:
            # Create new patient
            from app.schemas.patient import PatientCreate
            from app.services.patient_service import PatientService

            patient_data = PatientCreate(
                name=item.payload.get("name"),
                date_of_birth=item.payload.get("date_of_birth"),
                gender=item.payload.get("gender"),
                phone=item.payload.get("phone"),
                address=item.payload.get("address"),
                emergency_contact=item.payload.get("emergency_contact"),
                insurance_type=item.payload.get("insurance_type", "cash"),
                insurance_number=item.payload.get("insurance_number"),
                blood_type=item.payload.get("blood_type"),
                allergies=item.payload.get("allergies", []),
                chronic_conditions=item.payload.get("chronic_conditions", []),
                offline_id=item.offline_id,
            )

            patient_service = PatientService(self.db)
            patient = await patient_service.create_patient(patient_data, user)

            return SyncResult(
                offline_id=item.offline_id,
                status="acknowledged",
                server_id=patient.id,
                server_version=patient.sync_version,
            )

    async def pull_changes(self, device_id: str, user: User, last_sync_at: Optional[datetime] = None) -> SyncPullResponse:
        """Get changes from server for client."""
        # Get patients modified since last sync
        patient_query = select(Patient).where(
            and_(
                Patient.clinic_id == user.clinic_id,
                Patient.updated_at > last_sync_at if last_sync_at else True,
            )
        )

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
                created_at=patient.updated_at,
            ))

        return SyncPullResponse(
            device_id=device_id,
            server_time=datetime.now(timezone.utc),
            items=items,
            deleted_ids=[],
            has_more=False,
        )
