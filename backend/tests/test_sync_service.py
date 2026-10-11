"""
AFIA Health Assistant — Cross-Device Sync Tests
Validates patient & encounter persistence, LWW conflict resolution, and multi-device pull.
"""
import asyncio
import unittest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.patient import Patient, InsuranceType, Gender
from app.models.encounter import Encounter, EncounterStatus, EncounterType
from app.models.sync import SyncEntityType
from app.models.user import User
from app.schemas.sync import SyncItem, SyncPushRequest
from app.services.sync_service import SyncService, parse_iso_datetime, parse_insurance, parse_gender


class CrossDeviceSyncTests(unittest.TestCase):
    def setUp(self):
        self.clinic_id = uuid4()
        self.user_id = uuid4()
        self.user = SimpleNamespace(
            id=self.user_id,
            clinic_id=self.clinic_id,
            role="healthworker",
        )
        self.mock_db = AsyncMock()
        self.mock_db.add = MagicMock()

    def test_parse_helpers(self):
        # DateTime helper
        dt = parse_iso_datetime("2026-10-11T12:00:00Z")
        self.assertIsNotNone(dt)
        self.assertEqual(dt.tzinfo, timezone.utc)

        # Insurance helper - NHIS
        nhis_type, nhis_num = parse_insurance({"hasNHIS": True, "nhisNumber": "12345678"})
        self.assertEqual(nhis_type, InsuranceType.NHIS)
        self.assertEqual(nhis_num, "12345678")

        # Insurance helper - Private
        priv_type, priv_num = parse_insurance({"hasInsurance": True, "medicalAidNumber": "MED-99"})
        self.assertEqual(priv_type, InsuranceType.PRIVATE)
        self.assertEqual(priv_num, "MED-99")

        # Insurance helper - Cash
        cash_type, cash_num = parse_insurance({"hasInsurance": False})
        self.assertEqual(cash_type, InsuranceType.CASH)
        self.assertIsNone(cash_num)

        # Gender helper
        self.assertEqual(parse_gender({"sex": "female"}), Gender.FEMALE)
        self.assertEqual(parse_gender({"gender": "male"}), Gender.MALE)

    def test_sync_new_patient_persists_full_record(self):
        service = SyncService(self.mock_db)
        offline_id = f"patient_{uuid4()}"
        item = SyncItem(
            offline_id=offline_id,
            entity_type=SyncEntityType.PATIENT,
            entity_server_id=None,
            payload={
                "id": offline_id,
                "folderNumber": "0001-A7B",
                "name": "Kofi Mensah",
                "age": 34,
                "sex": "male",
                "phone": "+233240000000",
                "region": "Greater Accra",
                "community": "Tema",
                "locality": "Tema, Greater Accra",
                "hasNHIS": True,
                "nhisNumber": "55667788",
                "createdAt": "2026-10-11T10:00:00Z",
                "updatedAt": "2026-10-11T10:00:00Z",
            },
            payload_version=1,
            created_at=datetime.now(timezone.utc),
        )

        # Mock: patient does not exist yet
        mock_scalar = MagicMock()
        mock_scalar.scalar_one_or_none.return_value = None
        self.mock_db.execute.return_value = mock_scalar

        created_patient = Patient(
            id=uuid4(),
            clinic_id=self.clinic_id,
            folder_number="0001-A7B",
            name_encrypted="enc_name",
            gender=Gender.MALE,
            age_years=34,
            offline_id=offline_id,
            sync_version=1,
        )

        with patch("app.services.patient_service.PatientService.create_patient", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = created_patient
            result = asyncio.run(service._sync_patient(item, self.user, "device-desktop"))

            self.assertEqual(result.status, "acknowledged")
            self.assertEqual(result.offline_id, offline_id)
            self.assertEqual(result.server_id, created_patient.id)
            self.mock_db.commit.assert_awaited()

    def test_sync_existing_patient_conflict_resolution_server_wins(self):
        service = SyncService(self.mock_db)
        patient_id = uuid4()
        server_updated = datetime.now(timezone.utc)
        client_stale = server_updated - timedelta(hours=2)

        existing_patient = Patient(
            id=patient_id,
            clinic_id=self.clinic_id,
            folder_number="0001-A7B",
            name_encrypted="enc_name",
            offline_id="patient-123",
            sync_version=3,
            updated_at=server_updated,
        )

        mock_scalar = MagicMock()
        mock_scalar.scalar_one_or_none.return_value = existing_patient
        self.mock_db.execute.return_value = mock_scalar

        item = SyncItem(
            offline_id="patient-123",
            entity_type=SyncEntityType.PATIENT,
            entity_server_id=patient_id,
            payload={
                "id": "patient-123",
                "name": "Stale Name",
                "updatedAt": client_stale.isoformat(),
            },
            payload_version=2,  # Stale version
            created_at=client_stale,
        )

        with patch.object(existing_patient, "to_offline_dict", return_value={"id": "patient-123", "name": "Authoritative Server Name"}):
            result = asyncio.run(service._sync_patient(item, self.user, "device-mobile"))
            self.assertEqual(result.status, "conflict_resolved_server_wins")
            self.assertEqual(result.server_version, 3)
            self.assertEqual(result.server_payload["name"], "Authoritative Server Name")

    def test_sync_new_encounter_persists_offline_payload_linked_to_patient(self):
        service = SyncService(self.mock_db)
        patient_id = uuid4()
        encounter_offline_id = f"enc_{uuid4()}"

        existing_patient = Patient(
            id=patient_id,
            clinic_id=self.clinic_id,
            folder_number="0001-A7B",
            offline_id="patient-offline-1",
            name_encrypted="enc",
        )

        # Mock query calls:
        # 1. Look for existing encounter -> returns None
        # 2. Look for patient -> returns existing_patient
        # 3. Count encounters for patient -> returns 0
        call_count = 0
        def execute_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.scalar_one_or_none.return_value = None  # No existing encounter
            elif call_count == 2:
                mock_res.scalar_one_or_none.return_value = existing_patient  # Found patient
            else:
                mock_res.scalar.return_value = 0  # Visit count 0
            return mock_res

        self.mock_db.execute.side_effect = execute_side_effect

        encounter_payload = {
            "id": encounter_offline_id,
            "patientId": "patient-offline-1",
            "date": "2026-10-11T11:00:00Z",
            "vitals": {"temperature": "38.5", "bloodPressureSystolic": "120", "bloodPressureDiastolic": "80"},
            "history": "Fever and chills for 3 days",
            "diagnosis": "Suspected Malaria (RDT +)",
            "treatment": "Artemether-lumefantrine 20/120mg",
            "status": "completed",
            "createdAt": "2026-10-11T11:00:00Z",
            "updatedAt": "2026-10-11T11:00:00Z",
        }

        item = SyncItem(
            offline_id=encounter_offline_id,
            entity_type=SyncEntityType.ENCOUNTER,
            entity_server_id=None,
            payload=encounter_payload,
            payload_version=1,
            created_at=datetime.now(timezone.utc),
        )

        result = asyncio.run(service._sync_encounter(item, self.user, "device-desktop"))

        self.assertEqual(result.status, "acknowledged")
        self.assertEqual(result.offline_id, encounter_offline_id)
        self.mock_db.add.assert_called()
        self.mock_db.commit.assert_awaited()

    def test_pull_changes_returns_both_patients_and_encounters(self):
        service = SyncService(self.mock_db)
        patient_id = uuid4()
        encounter_id = uuid4()

        p = Patient(
            id=patient_id,
            clinic_id=self.clinic_id,
            folder_number="0001-A7B",
            offline_id="patient-1",
            name_encrypted="enc",
            sync_version=1,
        )
        p.to_offline_dict = MagicMock(return_value={"id": "patient-1", "folderNumber": "0001-A7B"})

        enc = Encounter(
            id=encounter_id,
            clinic_id=self.clinic_id,
            patient_id=patient_id,
            offline_id="enc-1",
            sync_version=1,
        )
        enc.to_offline_dict = MagicMock(return_value={"id": "enc-1", "patientId": "patient-1"})

        # Mock patient query then encounter query
        query_idx = 0
        def exec_side_effect(*args, **kwargs):
            nonlocal query_idx
            query_idx += 1
            mock_res = MagicMock()
            if query_idx == 1:
                mock_res.scalars.return_value.all.return_value = [p]
            else:
                mock_res.scalars.return_value.all.return_value = [enc]
            return mock_res

        self.mock_db.execute.side_effect = exec_side_effect

        pull_res = asyncio.run(service.pull_changes("device-mobile", self.user, last_sync_at=None))

        self.assertEqual(len(pull_res.items), 2)
        patient_item = next(it for it in pull_res.items if it.entity_type == SyncEntityType.PATIENT)
        encounter_item = next(it for it in pull_res.items if it.entity_type == SyncEntityType.ENCOUNTER)

        self.assertEqual(patient_item.offline_id, "patient-1")
        self.assertEqual(encounter_item.offline_id, "enc-1")
        self.assertEqual(encounter_item.payload["patientId"], "patient-1")


if __name__ == "__main__":
    unittest.main()
