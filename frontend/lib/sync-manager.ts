/**
 * AFIA Health Assistant — Offline Sync Manager
 * Queue changes locally, push when online
 */
import { patientDB, encounterDB } from './db';
import { toast } from 'sonner';

export interface SyncQueueItem {
  id: string;
  entityType: 'patient' | 'encounter' | 'encounter_update';
  entityId: string | null;  // Server ID if known
  offlineId: string;
  payload: Record<string, any>;
  version: number;
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  retryCount: number;
  lastError?: string;
}

export class OfflineSyncManager {
  private deviceId: string;
  private apiBase: string;
  private authToken: string | null = null;

  constructor(apiBase: string = '/api/v1') {
    this.apiBase = apiBase;
    this.deviceId = this.getOrCreateDeviceId();
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  // ── Queue Management ──────────────────────────────────────

  async queuePatient(patientData: Record<string, any>): Promise<string> {
    const offlineId = `patient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const item: SyncQueueItem = {
      id: offlineId,
      entityType: 'patient',
      entityId: null,
      offlineId,
      payload: patientData,
      version: 1,
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    };

    await this.addToQueue(item);
    return offlineId;
  }

  async queueEncounter(encounterData: Record<string, any>): Promise<string> {
    const offlineId = `encounter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const item: SyncQueueItem = {
      id: offlineId,
      entityType: 'encounter',
      entityId: null,
      offlineId,
      payload: encounterData,
      version: 1,
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    };

    await this.addToQueue(item);
    return offlineId;
  }

  // ── Sync Operations ───────────────────────────────────────

  async sync(): Promise<{ pushed: number; pulled: number; conflicts: number }> {
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    if (!navigator.onLine) {
      console.log('Offline — sync deferred');
      return { pushed: 0, pulled: 0, conflicts: 0 };
    }

    const queue = await this.getQueue();
    const pending = queue.filter(item => item.status === 'pending' || item.status === 'failed');

    if (pending.length === 0) {
      // Just pull
      const pulled = await this.pullChanges();
      return { pushed: 0, pulled: pulled.items.length, conflicts: 0 };
    }

    // Push pending items
    const pushResponse = await fetch(`${this.apiBase}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        device_id: this.deviceId,
        items: pending.map(item => ({
          offline_id: item.offlineId,
          entity_type: item.entityType,
          entity_server_id: item.entityId,
          payload: item.payload,
          payload_version: item.version,
          created_at: item.createdAt,
        })),
      }),
    });

    if (!pushResponse.ok) {
      throw new Error(`Sync push failed: ${pushResponse.statusText}`);
    }

    const results = await pushResponse.json();

    let pushed = 0;
    let conflicts = 0;

    for (const result of results) {
      if (result.status === 'acknowledged') {
        await this.updateQueueItem(result.offline_id, {
          status: 'syncing',
          entityId: result.server_id,
        });
        pushed++;
      } else if (result.status === 'conflict') {
        await this.updateQueueItem(result.offline_id, {
          status: 'conflict',
          lastError: 'Server has newer version',
        });
        conflicts++;
        // TODO: Show conflict resolution UI
      } else if (result.status === 'conflict_resolved_server_wins') {
        // Last-Write-Wins logic resolved on the server in favor of the server.
        // We must accept the server's payload.
        await this.updateQueueItem(result.offline_id, {
          status: 'syncing', // Will be cleared or marked done eventually
          entityId: result.server_id,
        });
        
        // Update local DB
        const entityType = queue.find(q => q.offlineId === result.offline_id)?.entityType;
        if (entityType === 'patient' && result.server_payload) {
          await patientDB.save(result.server_payload as any);
          toast.info("A patient record was updated with the latest changes from the server.");
        } else if (entityType === 'encounter' && result.server_payload) {
          await encounterDB.save(result.server_payload as any);
        }
        pushed++;
      } else {
        await this.updateQueueItem(result.offline_id, {
          status: 'failed',
          retryCount: (queue.find(q => q.offlineId === result.offline_id)?.retryCount || 0) + 1,
          lastError: result.error,
        });
      }
    }

    // Pull changes from server
    const pulled = await this.pullChanges();

    return { pushed, pulled: pulled.items.length, conflicts };
  }

  async pullChanges(): Promise<any> {
    const lastSync = localStorage.getItem('afia_last_sync');

    const response = await fetch(
      `${this.apiBase}/sync/pull?device_id=${this.deviceId}${lastSync ? `&last_sync_at=${lastSync}` : ''}`,
      {
        headers: { 'Authorization': `Bearer ${this.authToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Sync pull failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Apply pulled changes to local IndexedDB
    for (const item of data.items) {
      await this.applyPulledChange(item);
    }

    localStorage.setItem('afia_last_sync', data.server_time);

    return data;
  }

  // ── IndexedDB Queue Storage ───────────────────────────────

  private async addToQueue(item: SyncQueueItem): Promise<void> {
    const queue = await this.getQueue();
    queue.push(item);
    await this.saveQueue(queue);
  }

  private async getQueue(): Promise<SyncQueueItem[]> {
    return new Promise((resolve) => {
      const request = indexedDB.open('afia-sync', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('queue', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('queue', 'readonly');
        const store = tx.objectStore('queue');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result || []);
        getAll.onerror = () => resolve([]);
      };
      request.onerror = () => resolve([]);
    });
  }

  private async saveQueue(queue: SyncQueueItem[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('afia-sync', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('queue', 'readwrite');
        const store = tx.objectStore('queue');
        store.clear();
        for (const item of queue) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  private async updateQueueItem(offlineId: string, updates: Partial<SyncQueueItem>): Promise<void> {
    const queue = await this.getQueue();
    const index = queue.findIndex(item => item.offlineId === offlineId);
    if (index >= 0) {
      queue[index] = { ...queue[index], ...updates };
      await this.saveQueue(queue);
    }
  }

  private async applyPulledChange(item: any): Promise<void> {
    try {
      if (item.entity_type === 'patient') {
        await patientDB.save(item.payload);
      } else if (item.entity_type === 'encounter') {
        await encounterDB.save(item.payload);
      }
    } catch (err) {
      console.error('Failed to apply pulled change', err, item);
    }
  }

  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('afia_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('afia_device_id', deviceId);
    }
    return deviceId;
  }

  getPendingCount(): Promise<number> {
    return this.getQueue().then(q => q.filter(item => item.status === 'pending').length);
  }
}
