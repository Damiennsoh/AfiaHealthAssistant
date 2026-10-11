import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearClinicalLocalData, encounterDB, initializeActiveCacheKey, patientDB } from '../lib/db';
import { setActiveKey } from '../lib/crypto';
import { activateClinicDB, setActiveDB } from '../lib/guest-mode';
import { syncService } from '../lib/afia-sync';
import { afiaAPI } from '../lib/afia-api';

Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });

describe('cross-device sync & reconciliation', () => {
  const clinicId = 'test-facility-01';

  beforeEach(async () => {
    setActiveDB(`afia_clinic_${clinicId}`);
    setActiveKey(null);
    await clearClinicalLocalData();
    await initializeActiveCacheKey();
    syncService.setClinicScope(clinicId);
    syncService.clearQueue();
    vi.restoreAllMocks();
  });

  it('pulls clinic patients and encounters created on desktop when mobile device logs in', async () => {
    // Desktop created patient and encounter in cloud
    const cloudPatient = {
      id: 'patient-desktop-1',
      folderNumber: '0001-A7B',
      name: 'Amara Boateng',
      age: 28,
      sex: 'female' as const,
      locality: 'Accra',
      region: 'Greater Accra',
      community: 'Osu',
      phone: '+233201234567',
      hasInsurance: true,
      hasNHIS: true,
      nhisNumber: '99887766',
      createdAt: '2026-10-11T09:00:00.000Z',
      updatedAt: '2026-10-11T09:00:00.000Z',
      syncVersion: 1,
      isDeleted: false,
    };

    const cloudEncounter = {
      id: 'encounter-desktop-1',
      patientId: 'patient-desktop-1',
      date: '2026-10-11T09:30:00.000Z',
      vitals: { temperature: '37.1', bloodPressureSystolic: '118', bloodPressureDiastolic: '76' },
      symptoms: ['Headache'],
      history: 'Headache for 1 day',
      diagnosis: 'Tension headache',
      treatment: 'Paracetamol 500mg',
      status: 'completed' as const,
      createdAt: '2026-10-11T09:30:00.000Z',
      updatedAt: '2026-10-11T09:30:00.000Z',
      syncVersion: 1,
      isDeleted: false,
    };

    // Mock pull response from backend
    vi.spyOn(afiaAPI, 'pullSyncChanges').mockResolvedValue({
      data: {
        device_id: 'device-mobile',
        server_time: new Date().toISOString(),
        items: [
          {
            offline_id: 'patient-desktop-1',
            entity_type: 'patient',
            payload: cloudPatient,
            payload_version: 1,
            created_at: cloudPatient.createdAt,
          },
          {
            offline_id: 'encounter-desktop-1',
            entity_type: 'encounter',
            payload: cloudEncounter,
            payload_version: 1,
            created_at: cloudEncounter.createdAt,
          },
        ],
      },
    } as any);

    // Initial pull on login
    const result = await syncService.pullAndReconcile();

    expect(result.pulledPatients).toBe(1);
    expect(result.pulledEncounters).toBe(1);

    // Verify records exist in local mobile cache
    const storedPatient = await patientDB.getById('patient-desktop-1');
    expect(storedPatient).not.toBeNull();
    expect(storedPatient?.name).toBe('Amara Boateng');
    expect(storedPatient?.nhisNumber).toBe('99887766');

    const storedEncounter = await encounterDB.getById('encounter-desktop-1');
    expect(storedEncounter).not.toBeNull();
    expect(storedEncounter?.patientId).toBe('patient-desktop-1');
    expect(storedEncounter?.diagnosis).toBe('Tension headache');
  });

  it('protects newer local edits from being overwritten by stale cloud data', async () => {
    // Local device edited the patient locally at 11:00 AM
    const localPatient = {
      id: 'patient-local-1',
      folderNumber: '0002-XYZ',
      name: 'Local Updated Name',
      age: 40,
      sex: 'male' as const,
      locality: 'Kumasi',
      region: 'Ashanti',
      community: 'Bantama',
      phone: '+233241112233',
      hasInsurance: false,
      hasNHIS: false,
      createdAt: '2026-10-11T08:00:00.000Z',
      updatedAt: '2026-10-11T11:00:00.000Z',
      syncVersion: 2,
    };
    await patientDB.save(localPatient);

    // Queue the local change as pending in syncService
    syncService.queueChange('update', 'patient', localPatient.id, localPatient);

    // Server sends older data (from 09:00 AM)
    const olderCloudPatient = {
      ...localPatient,
      name: 'Older Server Name',
      updatedAt: '2026-10-11T09:00:00.000Z',
      syncVersion: 1,
    };

    vi.spyOn(afiaAPI, 'pullSyncChanges').mockResolvedValue({
      data: {
        device_id: 'device-mobile',
        server_time: new Date().toISOString(),
        items: [
          {
            offline_id: localPatient.id,
            entity_type: 'patient',
            payload: olderCloudPatient,
            payload_version: 1,
            created_at: olderCloudPatient.updatedAt,
          },
        ],
      },
    } as any);

    const result = await syncService.pullAndReconcile();

    // Conflict protection prevented overwrite
    expect(result.conflicts).toBe(1);
    expect(result.pulledPatients).toBe(0);

    const currentLocal = await patientDB.getById(localPatient.id);
    expect(currentLocal?.name).toBe('Local Updated Name');
  });

  it('updates local record when server has a newer authoritative update', async () => {
    const localPatient = {
      id: 'patient-sync-3',
      folderNumber: '0003-DEF',
      name: 'Original Name',
      age: 22,
      sex: 'female' as const,
      locality: 'Tamale',
      region: 'Northern',
      community: 'Central',
      phone: '+233200000000',
      hasInsurance: false,
      hasNHIS: false,
      createdAt: '2026-10-11T08:00:00.000Z',
      updatedAt: '2026-10-11T08:00:00.000Z',
      syncVersion: 1,
    };
    await patientDB.save(localPatient);

    const newerServerPatient = {
      ...localPatient,
      name: 'Newer Name From Cloud',
      updatedAt: '2026-10-11T12:00:00.000Z',
      syncVersion: 2,
    };

    vi.spyOn(afiaAPI, 'pullSyncChanges').mockResolvedValue({
      data: {
        device_id: 'device-mobile',
        server_time: new Date().toISOString(),
        items: [
          {
            offline_id: localPatient.id,
            entity_type: 'patient',
            payload: newerServerPatient,
            payload_version: 2,
            created_at: newerServerPatient.updatedAt,
          },
        ],
      },
    } as any);

    const result = await syncService.pullAndReconcile();

    expect(result.pulledPatients).toBe(1);
    const updatedLocal = await patientDB.getById(localPatient.id);
    expect(updatedLocal?.name).toBe('Newer Name From Cloud');
    expect(updatedLocal?.syncVersion).toBe(2);
  });
});
