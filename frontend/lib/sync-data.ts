import { 
  patientDB, 
  encounterDB, 
  aiRequestDB, 
  uploadDB,
  userDB
} from './db';
import { toast } from 'sonner';

/**
 * Data Export/Import Utilities for Hybrid Sync
 * Handles serialization and deserialization of IndexedDB data
 */

export interface SyncData {
  version: string;
  timestamp: string;
  source: string;
  deviceId: string;
  data: {
    patients: any[];
    encounters: any[];
    aiRequests: any[];
    uploads: any[];
    users: any[];
  };
  stats: {
    totalRecords: number;
    totalSize: string;
    lastSync: string | null;
  };
}

export interface ExportOptions {
  includePatients?: boolean;
  includeEncounters?: boolean;
  includeAIRequests?: boolean;
  includeUploads?: boolean;
  includeUsers?: boolean;
  since?: Date; // Only export records modified since this date
}

const DEFAULT_OPTIONS: ExportOptions = {
  includePatients: true,
  includeEncounters: true,
  includeAIRequests: true,
  includeUploads: true,
  includeUsers: false, // Don't sync users by default for security
};

/**
 * Export all data from IndexedDB
 */
export async function exportAllData(options: ExportOptions = {}): Promise<SyncData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const data: SyncData['data'] = {
      patients: [],
      encounters: [],
      aiRequests: [],
      uploads: [],
      users: []
    };

    // Export patients
    if (opts.includePatients) {
      const patients = await patientDB.getAll();
      data.patients = opts.since 
        ? patients.filter((p: any) => new Date(p.updatedAt) > opts.since!)
        : patients;
    }

    // Export encounters
    if (opts.includeEncounters) {
      const encounters = await encounterDB.getAll();
      data.encounters = opts.since
        ? encounters.filter(e => new Date(e.updatedAt) > opts.since!)
        : encounters;
    }

    // Export AI requests
    if (opts.includeAIRequests) {
      const aiRequests = await aiRequestDB.getAll();
      data.aiRequests = opts.since
        ? aiRequests.filter(r => new Date(r.createdAt) > opts.since!)
        : aiRequests;
    }

    // Export uploads
    if (opts.includeUploads) {
      const uploads = await uploadDB.getAll();
      data.uploads = opts.since
        ? uploads.filter((u: any) => new Date(u.updatedAt || u.createdAt) > opts.since!)
        : uploads;
    }

    // Export users (optional, usually skipped for security)
    if (opts.includeUsers) {
      const users = await userDB.getAll();
      data.users = users;
    }

    const totalRecords = 
      data.patients.length + 
      data.encounters.length + 
      data.aiRequests.length + 
      data.uploads.length;

    const syncData: SyncData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'afia-health-assistant',
      deviceId: await getDeviceId(),
      data: {
        patients: data.patients,
        encounters: data.encounters,
        aiRequests: data.aiRequests,
        uploads: data.uploads,
        users: data.users
      },
      stats: {
        totalRecords,
        totalSize: formatBytes(calculateSize(data)),
        lastSync: await getLastSyncTime()
      }
    };

    return syncData;

  } catch (error) {
    console.error('Export failed:', error);
    toast.error('Failed to export data for sync');
    throw error;
  }
}

/**
 * Import data into IndexedDB
 */
export async function importSyncData(
  syncData: SyncData, 
  options: { merge?: boolean; overwrite?: boolean } = {}
): Promise<{ imported: number; updated: number; skipped: number }> {
  const { merge = true, overwrite = false } = options;
  
  try {
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    // Validate data structure
    if (!syncData.data) {
      throw new Error('Invalid sync data structure');
    }

    // Import patients
    if (syncData.data.patients?.length > 0) {
      for (const patient of syncData.data.patients) {
        try {
          const existing = await patientDB.getById(patient.id);
          
          if (existing && !overwrite) {
            if (merge && new Date(patient.updatedAt) > new Date(existing.updatedAt)) {
              await patientDB.save(patient);
              updated++;
            } else {
              skipped++;
            }
          } else {
            await patientDB.save(patient);
            imported++;
          }
        } catch (e) {
          console.warn('Failed to import patient:', patient.id, e);
          skipped++;
        }
      }
    }

    // Import encounters
    if (syncData.data.encounters?.length > 0) {
      for (const encounter of syncData.data.encounters) {
        try {
          const existing = await encounterDB.getById(encounter.id);
          
          if (existing && !overwrite) {
            if (merge && new Date(encounter.updatedAt) > new Date(existing.updatedAt)) {
              await encounterDB.save(encounter);
              updated++;
            } else {
              skipped++;
            }
          } else {
            await encounterDB.save(encounter);
            imported++;
          }
        } catch (e) {
          console.warn('Failed to import encounter:', encounter.id, e);
          skipped++;
        }
      }
    }

    // Import AI requests
    if (syncData.data.aiRequests?.length > 0) {
      for (const request of syncData.data.aiRequests) {
        try {
          const existing = await aiRequestDB.getById(request.id);
          
          if (existing && !overwrite) {
            skipped++;
          } else {
            await aiRequestDB.save(request);
            imported++;
          }
        } catch (e) {
          console.warn('Failed to import AI request:', request.id, e);
          skipped++;
        }
      }
    }

    // Import uploads
    if (syncData.data.uploads?.length > 0) {
      for (const upload of syncData.data.uploads) {
        try {
          const existing = await uploadDB.getById(upload.id);
          
          if (existing && !overwrite) {
            skipped++;
          } else {
            await uploadDB.save(upload);
            imported++;
          }
        } catch (e) {
          console.warn('Failed to import upload:', upload.id, e);
          skipped++;
        }
      }
    }

    // Update last sync time
    await updateLastSyncTime();

    toast.success(`Sync complete: ${imported} imported, ${updated} updated`, {
      description: `${skipped} records skipped`
    });

    return { imported, updated, skipped };

  } catch (error) {
    console.error('Import failed:', error);
    toast.error('Failed to import sync data');
    throw error;
  }
}

/**
 * Compress sync data for transmission
 */
export async function compressSyncData(data: SyncData): Promise<Blob> {
  const jsonString = JSON.stringify(data);
  const blob = new Blob([jsonString], { type: 'application/json' });
  return blob;
}

/**
 * Decompress received sync data
 */
export async function decompressSyncData(blob: Blob): Promise<SyncData> {
  const text = await blob.text();
  return JSON.parse(text) as SyncData;
}

/**
 * Get or create a unique device ID
 */
async function getDeviceId(): Promise<string> {
  let deviceId = localStorage.getItem('afia-device-id');
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('afia-device-id', deviceId);
  }
  return deviceId;
}

/**
 * Get last sync time
 */
async function getLastSyncTime(): Promise<string | null> {
  return localStorage.getItem('afia-last-sync');
}

/**
 * Update last sync time
 */
async function updateLastSyncTime(): Promise<void> {
  localStorage.setItem('afia-last-sync', new Date().toISOString());
}

/**
 * Calculate approximate size of data
 */
function calculateSize(data: any): number {
  const jsonString = JSON.stringify(data);
  return new Blob([jsonString]).size;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate sync data integrity
 */
export function validateSyncData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid data format');
    return { valid: false, errors };
  }

  if (!data.version) {
    errors.push('Missing version information');
  }

  if (!data.timestamp) {
    errors.push('Missing timestamp');
  }

  if (!data.data || typeof data.data !== 'object') {
    errors.push('Missing data payload');
  }

  // Check for required data arrays
  const requiredArrays = ['patients', 'encounters', 'aiRequests', 'uploads'];
  for (const key of requiredArrays) {
    if (!Array.isArray(data.data?.[key])) {
      errors.push(`Missing or invalid ${key} array`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get sync statistics
 */
export async function getSyncStats(): Promise<{
  totalPatients: number;
  totalEncounters: number;
  lastSync: string | null;
  pendingUploads: number;
}> {
  try {
    const [patients, encounters, uploads] = await Promise.all([
      patientDB.getAll(),
      encounterDB.getAll(),
      uploadDB.getAll()
    ]);

    return {
      totalPatients: patients.length,
      totalEncounters: encounters.length,
      lastSync: await getLastSyncTime(),
      pendingUploads: uploads.filter((u: any) => u.status === 'pending').length
    };
  } catch (error) {
    console.error('Failed to get sync stats:', error);
    return {
      totalPatients: 0,
      totalEncounters: 0,
      lastSync: null,
      pendingUploads: 0
    };
  }
}

const syncUtils = {
  exportAllData,
  importSyncData,
  compressSyncData,
  decompressSyncData,
  validateSyncData,
  getSyncStats
};

export default syncUtils;
