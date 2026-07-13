/**
 * AFIA Health Assistant - Offline Sync Service
 * For intermittent connectivity (rural clinics, mobile networks)
 * Updated to use new sync-manager for IndexedDB-based queue
 */

import { afiaAPI } from './afia-api';
import { OfflineSyncManager } from '@/lib/sync-manager';

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

  /**
   * Load sync queue from localStorage
   */
  private loadQueue(): SyncQueue {
    if (typeof window === 'undefined') {
      return { changes: [], lastSync: null, deviceId: '' };
    }

    try {
      const stored = localStorage.getItem('afia_sync_queue');
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
      localStorage.setItem('afia_sync_queue', JSON.stringify(this.queue));
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
      if (this.isOnline && this.getPendingCount() > 0) {
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
   * Perform sync with server
   */
  async sync(): Promise<{ synced: number; failed: number; conflicts: number }> {
    if (!this.isOnline) {
      console.log('Cannot sync: offline');
      return { synced: 0, failed: 0, conflicts: 0 };
    }

    const pending = this.queue.changes.filter(
      c => c.status === 'pending' || (c.status === 'failed' && c.retryCount < 3)
    );

    if (pending.length === 0) {
      return { synced: 0, failed: 0, conflicts: 0 };
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
      // Push changes to server
      const changesToPush = pending.map(c => ({
        action: c.action,
        resource_type: c.resourceType,
        resource_id: c.resourceId,
        payload: c.payload,
      }));

      const response = await afiaAPI.pushSyncChanges(changesToPush, this.queue.deviceId);

      if (response.data) {
        // Mark all as synced
        pending.forEach(change => {
          change.status = 'synced';
          synced++;
        });

        this.queue.lastSync = Date.now();
        console.log(`Sync complete: ${synced} changes synced`);
      } else {
        throw new Error(response.error || 'Sync failed');
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
    return { synced, failed, conflicts };
  }

  /**
   * Pull pending changes from server (for multi-device sync)
   */
  async pull(): Promise<SyncChange[]> {
    if (!this.isOnline) return [];

    try {
      const response = await afiaAPI.getPendingSync(this.queue.deviceId);

      if (response.data && (response.data as any).changes) {
        console.log(`Pulled ${(response.data as any).changes.length} changes from server`);
        return (response.data as any).changes;
      }
    } catch (error) {
      console.error('Pull failed:', error);
    }

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
