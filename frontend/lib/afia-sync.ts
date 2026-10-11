/**
 * AFIA Health Assistant - Offline Sync Service
 * For intermittent connectivity (rural clinics, mobile networks)
 * Updated to use new sync-manager for IndexedDB-based queue
 */

import { afiaAPI } from './afia-api';
import { OfflineSyncManager } from '@/lib/sync-manager';
import { patientDB, encounterDB } from './db';

interface SyncChange {
  id: string;
  action: 'create' | 'update' | 'delete';
  resourceType: 'patient' | 'encounter';
  resourceId: string;
  payload: Record<string, any>;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  error?: string;
}

interface SyncQueue {
  changes: SyncChange[];
  lastSync: number | null;
  deviceId: string;
}

class SyncService {
  private queue: SyncQueue;
  private queueStorageKey = 'afia_sync_queue:unassigned';
  private deviceStorageKey = 'afia_device_id:unassigned';
  private clinicScopeReady = false;
  private syncInterval: number = 30000; // 30 seconds
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isOnline: boolean = true;

  constructor() {
    this.queue = this.loadQueue();
    this.setupNetworkListener();
    this.generateDeviceId();
  }

  /**
   * Generate or retrieve persistent device ID
   */
  private generateDeviceId(): void {
    if (!this.queue.deviceId) {
      this.queue.deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.saveQueue();
    }
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return this.queue.deviceId;
  }

  /** Switch offline mutation queues when the authenticated facility changes. */
  setClinicScope(clinicId: string): void {
    const normalizedClinicId = clinicId.trim().toLowerCase();
    if (!normalizedClinicId) throw new Error('Clinic scope is required for clinical sync.');
    const nextQueueKey = `afia_sync_queue:${normalizedClinicId}`;
    this.clinicScopeReady = true;
    if (nextQueueKey === this.queueStorageKey) return;

    this.queueStorageKey = nextQueueKey;
    this.deviceStorageKey = `afia_device_id:${normalizedClinicId}`;
    this.queue = this.loadQueue();
    this.generateDeviceId();
  }

  clearClinicScope(): void {
    this.clinicScopeReady = false;
    this.queueStorageKey = 'afia_sync_queue:unassigned';
    this.deviceStorageKey = 'afia_device_id:unassigned';
    this.queue = { changes: [], lastSync: null, deviceId: '' };
  }

  /**
   * Load sync queue from localStorage
   */
  private loadQueue(): SyncQueue {
    if (typeof window === 'undefined') {
      return { changes: [], lastSync: null, deviceId: '' };
    }

    try {
      const stored = localStorage.getItem(this.queueStorageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load sync queue:', e);
    }

    return { changes: [], lastSync: null, deviceId: '' };
  }

  /**
   * Save sync queue to localStorage
   */
  private saveQueue(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.queueStorageKey, JSON.stringify(this.queue));
    } catch (e) {
      console.error('Failed to save sync queue:', e);
    }
  }

  /**
   * Setup network status listener
   */
  private setupNetworkListener(): void {
    if (typeof window === 'undefined') return;

    this.isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Network online - triggering sync');
      this.sync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Network offline - queueing changes');
    });
  }

  /**
   * Check if currently online
   */
  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Queue a change for sync
   */
  queueChange(
    action: 'create' | 'update' | 'delete',
    resourceType: 'patient' | 'encounter',
    resourceId: string,
    payload: Record<string, any>
  ): SyncChange {
    // Prevent duplicate queuing — if a pending/failed entry for the same
    // resource already exists, update it in-place instead of appending.
    const existing = this.queue.changes.find(
      c => c.resourceType === resourceType &&
           c.resourceId === resourceId &&
           (c.status === 'pending' || c.status === 'failed')
    );
    if (existing) {
      existing.payload = payload;
      existing.timestamp = Date.now();
      existing.status = 'pending';
      existing.retryCount = 0;
      this.saveQueue();
      if (this.isOnline) {
        this.sync();
      }
      return existing;
    }

    const change: SyncChange = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action,
      resourceType,
      resourceId,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    this.queue.changes.push(change);
    this.saveQueue();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.sync();
    }

    return change;
  }

  /**
   * Queue patient creation
   */
  queuePatientCreate(patientData: Record<string, any>): SyncChange {
    // Generate temporary local ID
    const tempId = `local_patient_${Date.now()}`;
    return this.queueChange('create', 'patient', tempId, patientData);
  }

  /**
   * Queue patient update
   */
  queuePatientUpdate(patientId: string, updates: Record<string, any>): SyncChange {
    return this.queueChange('update', 'patient', patientId, updates);
  }

  /**
   * Queue encounter creation
   */
  queueEncounterCreate(encounterData: Record<string, any>): SyncChange {
    const tempId = `local_encounter_${Date.now()}`;
    return this.queueChange('create', 'encounter', tempId, encounterData);
  }

  /**
   * Queue encounter update
   */
  queueEncounterUpdate(encounterId: string, updates: Record<string, any>): SyncChange {
    return this.queueChange('update', 'encounter', encounterId, updates);
  }

  /**
   * Get pending changes count
   */
  getPendingCount(): number {
    return this.queue.changes.filter(c => c.status === 'pending' || c.status === 'failed').length;
  }

  /**
   * Get all queued changes
   */
  getQueuedChanges(): SyncChange[] {
    return [...this.queue.changes];
  }

  /**
   * Get changes by status
   */
  getChangesByStatus(status: SyncChange['status']): SyncChange[] {
    return this.queue.changes.filter(c => c.status === status);
  }

  /**
   * Remove synced changes from queue
   */
  cleanupSynced(): void {
    this.queue.changes = this.queue.changes.filter(c => c.status !== 'synced');
    this.saveQueue();
  }

  /**
   * Clear all changes (use with caution)
   */
  clearQueue(): void {
    this.queue.changes = [];
    this.saveQueue();
  }

  /**
   * Start automatic sync
   */
  startAutoSync(intervalMs?: number): void {
    if (intervalMs) {
      this.syncInterval = intervalMs;
    }

    this.stopAutoSync();
    this.intervalId = setInterval(() => {
      if (this.isOnline) {
        // Always run a full sync cycle (push pending + pull from server)
        // so that records created on other devices are pulled even when
        // this device has nothing pending to push.
        this.sync();
      }
    }, this.syncInterval);

    console.log(`Auto-sync started (${this.syncInterval}ms interval)`);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Auto-sync stopped');
    }
  }

  /**
   * Perform sync with server (push pending changes, then pull and reconcile remote changes)
   */
  async sync(): Promise<{ synced: number; failed: number; conflicts: number }> {
    if (!this.clinicScopeReady || !this.isOnline) {
      console.log('Cannot sync: clinic scope is not set or device is offline');
      return { synced: 0, failed: 0, conflicts: 0 };
    }

    const pending = this.queue.changes.filter(
      c => c.status === 'pending' || (c.status === 'failed' && c.retryCount < 3)
    );

    if (pending.length === 0) {
      const pullRes = await this.pullAndReconcile();
      return { synced: pullRes.pulledPatients + pullRes.pulledEncounters, failed: 0, conflicts: pullRes.conflicts };
    }

    console.log(`Syncing ${pending.length} changes...`);

    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    // Mark as syncing
    pending.forEach(change => {
      change.status = 'syncing';
    });
    this.saveQueue();

    try {
      // Push changes to server using correct backend schema
      const itemsToPush = pending.map(c => ({
        offline_id: c.resourceId,
        entity_type: (c.resourceType === 'patient' ? 'patient' : 'encounter') as 'patient' | 'encounter',
        entity_server_id: null, // Will be assigned by server
        payload: c.payload,
        payload_version: c.payload?.syncVersion || 1,
        created_at: new Date(c.timestamp).toISOString(),
      }));

      const response = await afiaAPI.pushSyncChanges({
        device_id: this.queue.deviceId,
        items: itemsToPush,
        last_sync_at: this.queue.lastSync ? new Date(this.queue.lastSync).toISOString() : null,
      });

      if (response.data && Array.isArray(response.data)) {
        // Process results
        for (let index = 0; index < response.data.length; index++) {
          const result = response.data[index];
          const change = pending[index];
          if (result.status === 'acknowledged') {
            change.status = 'synced';
            synced++;
          } else if (result.status === 'conflict_resolved_server_wins') {
            change.status = 'synced';
            conflicts++;
            if (result.server_payload) {
              if (change.resourceType === 'patient') {
                await patientDB.save(result.server_payload as any);
              } else if (change.resourceType === 'encounter') {
                await encounterDB.save(result.server_payload as any);
              }
            }
          } else {
            change.status = 'failed';
            change.retryCount++;
            change.error = result.error || 'Sync failed';
            failed++;
          }
        }

        this.queue.lastSync = Date.now();
        console.log(`Sync push complete: ${synced} changes synced`);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Sync failed:', error);

      // Mark as failed and increment retry
      pending.forEach(change => {
        change.status = 'failed';
        change.retryCount++;
        change.error = error instanceof Error ? error.message : 'Unknown error';

        if (change.retryCount >= 3) {
          change.status = 'conflict';
          conflicts++;
        } else {
          failed++;
        }
      });
    }

    this.saveQueue();

    // Pull any new changes created or modified by other devices
    try {
      const pullResult = await this.pullAndReconcile();
      synced += pullResult.pulledPatients + pullResult.pulledEncounters;
      conflicts += pullResult.conflicts;
    } catch (pullError) {
      console.error('Post-push pull error:', pullError);
    }

    return { synced, failed, conflicts };
  }

  getLegacyUnscopedPendingCount(): number {
    if (typeof window === 'undefined') return 0;
    try {
      const legacyQueue = JSON.parse(localStorage.getItem('afia_sync_queue') || '{"changes":[]}');
      return Array.isArray(legacyQueue.changes)
        ? legacyQueue.changes.filter((change: SyncChange) => change.status !== 'synced').length
        : 0;
    } catch {
      return 1;
    }
  }

  /**
   * Pull pending changes from server and reconcile with local IndexedDB.
   * Ensures data from another device does not overwrite newer local edits,
   * while populating missing or updated records on this device.
   */
  async pullAndReconcile(): Promise<{ pulledPatients: number; pulledEncounters: number; conflicts: number }> {
    if (!this.clinicScopeReady || !this.isOnline) {
      return { pulledPatients: 0, pulledEncounters: 0, conflicts: 0 };
    }

    let pulledPatients = 0;
    let pulledEncounters = 0;
    let conflicts = 0;

    try {
      const lastSyncAt = this.queue.lastSync ? new Date(this.queue.lastSync).toISOString() : null;
      const response = await afiaAPI.pullSyncChanges(this.queue.deviceId, lastSyncAt);

      if (!response.data || !Array.isArray((response.data as any).items)) {
        return { pulledPatients: 0, pulledEncounters: 0, conflicts: 0 };
      }

      const items: any[] = (response.data as any).items;
      console.log(`[Sync] Pulled ${items.length} records from server for clinic`);

      // 1. Reconcile patients
      const patientItems = items.filter(it => it.entity_type === 'patient');
      for (const item of patientItems) {
        const payload = item.payload;
        if (!payload || !payload.id) continue;

        const pendingChange = this.queue.changes.find(
          c => c.resourceType === 'patient' &&
               (c.resourceId === payload.id || c.payload?.id === payload.id || (payload.folderNumber && c.payload?.folderNumber === payload.folderNumber)) &&
               (c.status === 'pending' || c.status === 'syncing')
        );

        const existingById = await patientDB.getById(payload.id);
        const folderMatches = !existingById && payload.folderNumber
          ? await patientDB.getByFolderNumber(payload.folderNumber)
          : [];
        const existing = existingById || (Array.isArray(folderMatches) && folderMatches.length > 0 ? folderMatches[0] : null);

        if (existing && existing.id) {
          if (pendingChange) {
            const localPendingTime = new Date(pendingChange.payload?.updatedAt || pendingChange.timestamp).getTime();
            const serverTime = new Date(payload.updatedAt || item.created_at || 0).getTime();

            if (localPendingTime > serverTime) {
              // Local pending edit is newer — keep local data to prevent corruption
              console.log(`[Sync] Keeping newer local edit for patient ${payload.id}`);
              conflicts++;
              continue;
            } else {
              // Server is newer or equal: server wins
              pendingChange.status = 'synced';
              if (existing.id !== payload.id) {
                await patientDB.delete(existing.id);
              }
              await patientDB.save(payload);
              pulledPatients++;
            }
          } else {
            const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            const serverTime = new Date(payload.updatedAt || payload.createdAt || 0).getTime();
            const serverVersion = item.payload_version || payload.syncVersion || 1;
            const localVersion = existing.syncVersion || 1;

            if (serverTime >= localTime || serverVersion >= localVersion) {
              if (existing.id !== payload.id) {
                await patientDB.delete(existing.id);
              }
              await patientDB.save(payload);
              pulledPatients++;
            }
          }
        } else {
          // Fresh record from another device (e.g., registered on desktop, pulled on mobile)
          await patientDB.save(payload);
          pulledPatients++;
        }
      }

      // 2. Reconcile encounters
      const encounterItems = items.filter(it => it.entity_type === 'encounter');
      for (const item of encounterItems) {
        const payload = item.payload;
        if (!payload || !payload.id) continue;

        const pendingChange = this.queue.changes.find(
          c => c.resourceType === 'encounter' &&
               (c.resourceId === payload.id || c.payload?.id === payload.id) &&
               (c.status === 'pending' || c.status === 'syncing')
        );

        const existing = await encounterDB.getById(payload.id);

        if (existing) {
          if (pendingChange) {
            const localPendingTime = new Date(pendingChange.payload?.updatedAt || pendingChange.timestamp).getTime();
            const serverTime = new Date(payload.updatedAt || item.created_at || 0).getTime();

            if (localPendingTime > serverTime) {
              console.log(`[Sync] Keeping newer local edit for encounter ${payload.id}`);
              conflicts++;
              continue;
            } else {
              pendingChange.status = 'synced';
              await encounterDB.save(payload);
              pulledEncounters++;
            }
          } else {
            const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            const serverTime = new Date(payload.updatedAt || payload.createdAt || 0).getTime();
            const serverVersion = item.payload_version || payload.syncVersion || 1;
            const localVersion = existing.syncVersion || 1;

            if (serverTime >= localTime || serverVersion >= localVersion) {
              await encounterDB.save(payload);
              pulledEncounters++;
            }
          }
        } else {
          // Fresh encounter created on another device
          await encounterDB.save(payload);
          pulledEncounters++;
        }
      }

      this.queue.lastSync = Date.now();
      this.saveQueue();
    } catch (error) {
      console.error('[Sync] pullAndReconcile failed:', error);
    }

    return { pulledPatients, pulledEncounters, conflicts };
  }

  /**
   * Pull pending changes from server (for multi-device sync)
   */
  async pull(): Promise<SyncChange[]> {
    const result = await this.pullAndReconcile();
    return [];
  }

  /**
   * Get last sync timestamp
   */
  getLastSync(): number | null {
    return this.queue.lastSync;
  }

  /**
   * Format last sync time for display
   */
  getLastSyncFormatted(): string {
    if (!this.queue.lastSync) return 'Never';

    const date = new Date(this.queue.lastSync);
    return date.toLocaleString();
  }
}

// Singleton instance
export const syncService = new SyncService();
export default syncService;
