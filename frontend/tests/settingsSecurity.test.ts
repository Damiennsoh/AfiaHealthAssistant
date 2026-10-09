import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearClinicalLocalData, encounterDB, initializeActiveCacheKey, patientDB } from '../lib/db';
import { setActiveKey } from '../lib/crypto';
import { activateClinicDB, getActiveDB, setActiveDB } from '../lib/guest-mode';

Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });

const testPatient = {
  id: 'settings-test-patient',
  folderNumber: 'DHL-001',
  name: 'Test Patient',
  hasNHIS: false,
  age: 30,
  sex: 'female' as const,
  locality: 'Test locality',
  region: 'Test region',
  community: 'Test community',
  phone: '555-0100',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('settings account security workflows', () => {
  beforeEach(async () => {
    setActiveDB('afia-settings-test-db');
    setActiveKey(null);
    await clearClinicalLocalData();
  });

  it('keeps the facility cache key stable independently of staff reauthentication', async () => {
    await initializeActiveCacheKey();
    const { getActiveKey } = await import('../lib/crypto');
    const originalCacheKey = getActiveKey();
    expect(originalCacheKey?.extractable).toBe(false);
    await patientDB.save(testPatient);

    setActiveKey(null);
    await initializeActiveCacheKey();
    expect(getActiveKey()).toBe(originalCacheKey);
    expect(await patientDB.getById(testPatient.id)).toMatchObject({ name: 'Test Patient', phone: '555-0100' });
  });

  it('keeps the facility cache isolated when another clinic signs into the same browser', async () => {
    activateClinicDB('clinic-one');
    await clearClinicalLocalData();
    await initializeActiveCacheKey();
    await patientDB.save(testPatient);

    activateClinicDB('clinic-two');
    await clearClinicalLocalData();
    setActiveKey(null);
    await initializeActiveCacheKey();
    expect(await patientDB.getById(testPatient.id)).toBeNull();

    activateClinicDB('clinic-one');
    setActiveKey(null);
    await initializeActiveCacheKey();
    expect(await patientDB.getById(testPatient.id)).toMatchObject({ name: 'Test Patient', phone: '555-0100' });
  });

  it('repairs the patientId index when upgrading an existing facility cache', async () => {
    const legacyDbName = 'afia-legacy-clinic-cache-test';
    setActiveDB(legacyDbName);

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(legacyDbName, 7);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('patients', { keyPath: 'id' });
        db.createObjectStore('encounters', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    await expect(encounterDB.getByPatient('patient-with-no-encounters')).resolves.toEqual([]);

    const upgradedDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(legacyDbName, 8);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(upgradedDb.transaction('encounters').objectStore('encounters').indexNames.contains('patientId')).toBe(true);
    upgradedDb.close();
  });

  it('uses a dedicated admin cache and never aliases production clinic storage', () => {
    activateClinicDB('clinic-123');
    const clinicDatabase = getActiveDB();
    activateClinicDB('clinic-456');
    expect(getActiveDB()).not.toBe(clinicDatabase);
    expect(clinicDatabase).toContain('clinic-123');
  });
});
