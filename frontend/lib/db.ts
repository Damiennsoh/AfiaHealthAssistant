// IndexedDB database layer for Afia Health Assistant
// Uses raw IndexedDB for full control over stores and indexes

const DB_NAME = "afia-health-db";
const DB_VERSION = 4; // Updated for user accounts support

export interface Patient {
  id: string;
  folderNumber: string; // Unique folder number (e.g., F-00001)
  name: string;
  nhisNumber?: string; // Optional NHIS number
  hasNHIS: boolean; // Flag to indicate NHIS status
  age: number;
  sex: "male" | "female";
  locality: string;
  region: string;
  community: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  // Soft Delete fields
  deleted?: boolean; // Legacy/Compat
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface UnifiedDiagnosis {
  id: string;
  type: 'primary' | 'secondary';
  diagnosis: string;
  source: 'manual' | 'ai';
  confidence?: number; // AI confidence score
  createdAt: string;
  overriddenBy?: string; // If manual overrides AI
}

export interface BMI {
  value: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
  label: string;
  calculatedAt: string;
}

export interface VitalAlert {
  type: 'bp_high' | 'bp_low' | 'temp_high' | 'temp_low' | 'spo2_low' | 'pulse_high' | 'pulse_low' | 'resp_high' | 'resp_low' | 'clinical_critical' | 'clinical_warning';
  severity: 'critical' | 'warning';
  message: string;
  value: string;
}

export interface ReferralTrigger {
  reason: string;
  vitalType: string;
  threshold: string;
  actualValue: string;
  triggeredAt: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  date: string;
  vitals: {
    temperature: string;
    bloodPressureSystolic: string;
    bloodPressureDiastolic: string;
    pulse: string;
    respiratoryRate: string;
    weight: string;
    height: string;
    spO2: string;
  };
  symptoms: string[];
  history: string;
  presentingComplaint?: string; // Main presenting complaint
  historyOfComplaint?: string; // Detailed history of complaint
  diagnosis: string; // Legacy field - keep for backward compatibility
  treatment: string; // Legacy field - keep for backward compatibility
  unifiedDiagnoses?: UnifiedDiagnosis[]; // New unified structure
  bmi?: BMI; // BMI data
  vitalAlerts?: VitalAlert[]; // Critical vital alerts
  referralTriggers?: ReferralTrigger[]; // Referral trigger reasons
  aiDiagnosisData?: { // AI diagnosis data in manual form format
    primaryDiagnosis: string;
    secondaryDiagnosis: string;
    treatmentPlan: string;
    clinicalNotes: string;
    followUpInstructions: string;
    appliedAt: string;
    confidence: number;
  };
  drugs: DrugAdministration[];
  labResults: LabResult[];
  notes: string;
  status: "in-progress" | "completed";
  createdAt: string;
  updatedAt: string;
  referralData?: any; // Optional referral data
  deleted?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface DrugAdministration {
  id: string;
  drugName: string;
  dosage: string;
  frequency: string;
  route: string; // oral, IV, IM, etc.
  startDate: string;
  endDate?: string;
  prescribedBy: string;
  notes?: string;
  createdAt: string;
}

export interface LabResult {
  id: string;
  testType: string; // RDT, HB, Glucose, etc.
  result: string;
  normalRange?: string;
  unit?: string;
  testDate: string;
  performedBy: string;
  imageUrl?: string; // For uploaded lab result images
  s3Url?: string; // For S3 storage
  createdAt: string;
}

export interface AIRequest {
  id: string;
  encounterId: string;
  patientId: string;
  type: "diagnosis" | "image-analysis" | "chat";
  payload: string;
  response: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
  completedAt: string | null;
}

export interface UploadTask {
  id: string;
  name: string;
  contentType: string;
  // Blob is stored directly in IndexedDB
  blob: any;
  status: "pending" | "uploading" | "uploaded" | "failed";
  attempts: number;
  // s3Key: the object key in S3 for server-side download proxy
  s3Key?: string | null;
  // progress 0-100 for UI
  progress?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  staffId: string;
  name: string;
  pin: string;
  role: string;
  facility: string;
  department: string;
  securityQuestion: string;
  securityAnswer: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

// Event Listener System
export type DBChangeListener = () => void;
const listeners = new Map<string, Set<DBChangeListener>>();

function subscribe(storeName: string, listener: DBChangeListener) {
  if (!listeners.has(storeName)) {
    listeners.set(storeName, new Set());
  }
  listeners.get(storeName)!.add(listener);
  return () => {
    listeners.get(storeName)?.delete(listener);
  };
}

function notify(storeName: string) {
  listeners.get(storeName)?.forEach((listener) => listener());
}

function openDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("patients")) {
        const patientStore = db.createObjectStore("patients", {
          keyPath: "id",
        });
        patientStore.createIndex("folderNumber", "folderNumber", {
          unique: true, // Folder numbers must be unique
        });
        patientStore.createIndex("nhisNumber", "nhisNumber", {
          unique: false,
        });
        patientStore.createIndex("name", "name", { unique: false });
        patientStore.createIndex("locality", "locality", { unique: false });
      }

      if (!db.objectStoreNames.contains("encounters")) {
        const encounterStore = db.createObjectStore("encounters", {
          keyPath: "id",
        });
        encounterStore.createIndex("patientId", "patientId", {
          unique: false,
        });
        encounterStore.createIndex("date", "date", { unique: false });
        encounterStore.createIndex("status", "status", { unique: false });
      }

      if (!db.objectStoreNames.contains("aiRequests")) {
        const aiStore = db.createObjectStore("aiRequests", { keyPath: "id" });
        aiStore.createIndex("status", "status", { unique: false });
        aiStore.createIndex("encounterId", "encounterId", { unique: false });
      }

      if (!db.objectStoreNames.contains("uploads")) {
        const uploadStore = db.createObjectStore("uploads", { keyPath: "id" });
        uploadStore.createIndex("status", "status", { unique: false });
        uploadStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("metadata")) {
        const metadataStore = db.createObjectStore("metadata", {
          keyPath: "key",
        });
      }

      if (!db.objectStoreNames.contains("users")) {
        const userStore = db.createObjectStore("users", {
          keyPath: "id",
        });
        userStore.createIndex("staffId", "staffId", { unique: true });
        userStore.createIndex("role", "role", { unique: false });
        userStore.createIndex("facility", "facility", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Generic CRUD helpers
async function getAll<T>(storeName: string, includeDeleted: boolean = false): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as T[];
      if (includeDeleted) {
        resolve(results);
      } else {
        // Filter out deleted items if not requested
        resolve(results.filter((item: any) => !item.deleted && !item.isDeleted));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function getById<T>(storeName: string, id: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result as T;
      // Return null if item is deleted (unless specifically checking deleted items via other methods)
      if (item && ((item as any).deleted || (item as any).isDeleted)) {
        resolve(null);
      } else {
        resolve(item || null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function put<T>(storeName: string, item: T): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => {
      resolve(item);
      notify(storeName);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteById(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => {
      resolve();
      notify(storeName);
    };
    request.onerror = () => reject(request.error);
  });
}

async function softDeleteById(storeName: string, id: string, adminId?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        // Apply soft delete updates
        const now = new Date().toISOString();
        item.deleted = true; // Legacy
        item.isDeleted = true; // New standard
        item.deletedAt = now;
        item.deletedBy = adminId || "SYSTEM";
        item.updatedAt = now; // Critical for sync
        
        const putRequest = store.put(item);
        putRequest.onsuccess = () => {
          resolve();
          notify(storeName);
        };
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve(); // Item not found, treat as success
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: string,
  includeDeleted: boolean = false
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => {
      const results = request.result as T[];
      if (includeDeleted) {
        resolve(results);
      } else {
        resolve(results.filter((item: any) => !item.deleted && !item.isDeleted));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Patient operations
export const patientDB = {
  subscribe: (listener: DBChangeListener) => subscribe("patients", listener),
  getAll: (includeDeleted = false) => getAll<Patient>("patients", includeDeleted),
  getById: (id: string) => getById<Patient>("patients", id),
  getByFolderNumber: (folderNumber: string) => getByIndex<Patient>("patients", "folderNumber", folderNumber),
  getByNHIS: (nhisNumber: string) => getByIndex<Patient>("patients", "nhisNumber", nhisNumber),
  save: (patient: Patient) => put<Patient>("patients", patient),
  delete: (id: string) => deleteById("patients", id), // Hard delete
  softDelete: async (id: string, adminId?: string) => {
    await softDeleteById("patients", id, adminId);
    // Also soft-delete all encounters for this patient
    const encounters = await getByIndex<Encounter>("encounters", "patientId", id, true);
    for (const encounter of encounters) {
      if (!encounter.deleted && !encounter.isDeleted) {
        await softDeleteById("encounters", encounter.id, adminId);
      }
    }
  }, // Soft delete with cascading to encounters
  search: async (query: string, filters?: { region?: string; community?: string }): Promise<Patient[]> => {
    const all = await getAll<Patient>("patients"); // Only returns non-deleted by default
    let results = all;
    
    // Apply text search
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nhisNumber && p.nhisNumber.toLowerCase().includes(q)) ||
          p.region?.toLowerCase().includes(q) ||
          p.community?.toLowerCase().includes(q) ||
          p.locality.toLowerCase().includes(q) ||
          (p.phone && p.phone.toLowerCase().includes(q))
      );
    }
    
    // Apply region filter
    if (filters?.region) {
      results = results.filter(p => p.region === filters.region);
    }
    
    // Apply community filter
    if (filters?.community) {
      results = results.filter(p => 
        p.community?.toLowerCase().includes(filters.community!.toLowerCase())
      );
    }
    
    return results;
  },
  // Advanced search with all filters
  advancedSearch: async (params: {
    name?: string;
    nhisNumber?: string;
    region?: string;
    community?: string;
    minAge?: number;
    maxAge?: number;
  }): Promise<Patient[]> => {
    const all = await getAll<Patient>("patients");
    
    return all.filter(p => {
      if (params.name && !p.name.toLowerCase().includes(params.name.toLowerCase())) return false;
      if (params.nhisNumber && (!p.nhisNumber || !p.nhisNumber.includes(params.nhisNumber))) return false;
      if (params.region && p.region !== params.region) return false;
      if (params.community && !p.community?.toLowerCase().includes(params.community.toLowerCase())) return false;
      if (params.minAge !== undefined && p.age < params.minAge) return false;
      if (params.maxAge !== undefined && p.age > params.maxAge) return false;
      return true;
    });
  }
};

// Encounter operations
export const encounterDB = {
  subscribe: (listener: DBChangeListener) => subscribe("encounters", listener),
  getAll: (includeDeleted = false) => getAll<Encounter>("encounters", includeDeleted),
  getById: (id: string) => getById<Encounter>("encounters", id),
  getByPatient: (patientId: string) =>
    getByIndex<Encounter>("encounters", "patientId", patientId),
  save: (encounter: Encounter) => put<Encounter>("encounters", encounter),
  delete: (id: string) => deleteById("encounters", id), // Hard delete
  softDelete: (id: string, adminId?: string) => softDeleteById("encounters", id, adminId), // Soft delete
};

// AI Request operations
export const aiRequestDB = {
  subscribe: (listener: DBChangeListener) => subscribe("aiRequests", listener),
  getAll: () => getAll<AIRequest>("aiRequests"),
  getById: (id: string) => getById<AIRequest>("aiRequests", id),
  getQueued: () =>
    getByIndex<AIRequest>("aiRequests", "status", "queued"),
  getProcessing: () =>
    getByIndex<AIRequest>("aiRequests", "status", "processing"),
  save: (request: AIRequest) => put<AIRequest>("aiRequests", request),
  delete: (id: string) => deleteById("aiRequests", id),
};

// Upload task operations
export const uploadDB = {
  subscribe: (listener: DBChangeListener) => subscribe("uploads", listener),
  getAll: () => getAll<UploadTask>("uploads"),
  getById: (id: string) => getById<UploadTask>("uploads", id),
  getPending: () => getByIndex<UploadTask>("uploads", "status", "pending"),
  save: (t: UploadTask) => put<UploadTask>("uploads", t),
  delete: (id: string) => deleteById("uploads", id),
};

// User operations
export const userDB = {
  subscribe: (listener: DBChangeListener) => subscribe("users", listener),
  getAll: (includeDeleted = false) => getAll<User>("users", includeDeleted),
  getById: (id: string) => getById<User>("users", id),
  getByStaffId: (staffId: string) => getByIndex<User>("users", "staffId", staffId),
  save: (user: User) => put<User>("users", user),
  delete: (id: string) => deleteById("users", id),
  softDelete: (id: string, adminId?: string) => softDeleteById("users", id, adminId),
  findByStaffId: async (staffId: string): Promise<User | null> => {
    try {
      const trimmedStaffId = staffId.trim();
      const results = await getByIndex<User>("users", "staffId", trimmedStaffId);
      if (results.length > 0) return results[0];
      
      // Fallback for case-insensitivity if index search failed
      const allUsers = await getAll<User>("users");
      return allUsers.find(u => u.staffId.toLowerCase() === trimmedStaffId.toLowerCase()) || null;
    } catch (error) {
      console.error('Find user error:', error);
      return null;
    }
  },
  updateLastLogin: async (userId: string): Promise<void> => {
    try {
      const user = await getById<User>("users", userId);
      if (user) {
        const updatedUser = { ...user, updatedAt: new Date().toISOString() };
        await put<User>("users", updatedUser);
      }
    } catch (error) {
      console.error('Update last login error:', error);
    }
  }
};

export const metadataDB = {
  subscribe: (listener: DBChangeListener) => subscribe("metadata", listener),
  getAll: () => getAll<any>("metadata"),
  save: (item: any) => put<any>("metadata", item),
};

// Generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Folder number management
export const generateFolderNumber = async (): Promise<string> => {
  try {
    const patients = await getAll<Patient>("patients");
    
    // 1. Find the highest existing number
    const maxNum = patients.reduce((max, p) => {
      const num = parseInt(p.folderNumber.replace(/[^0-9]/g, ""));
      return !isNaN(num) ? Math.max(max, num) : max;
    }, 0);

    // 2. Generate next sequential number
    const nextNum = maxNum + 1;
    
    // 3. Add a 3-character random suffix to prevent collisions between devices
    // that haven't synced yet (e.g., 0045-A7B)
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    return `${nextNum.toString().padStart(4, "0")}-${suffix}`;
  } catch (error) {
    console.error("Error generating folder number:", error);
    // Ultimate fallback: completely random
    return `F-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }
};

// NHIS number validation (format: XX-XXXX-XXXX-X)
export function validateNHIS(nhis: string): boolean {
  const pattern = /^[A-Z0-9]{2}-\d{4}-\d{4}-\d{1}$/;
  return pattern.test(nhis);
}

// Format NHIS as user types
export function formatNHIS(value: string): string {
  const cleaned = value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  if (cleaned.length <= 10)
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}-${cleaned.slice(10, 11)}`;
}

// Database cleanup utilities
export const dbCleanup = {
  // Clear stuck processing AI requests (older than 5 minutes)
  clearStuckAIRequests: async (): Promise<number> => {
    const allRequests = await aiRequestDB.getAll();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const stuckRequests = allRequests.filter(r => 
      r.status === 'processing' && 
      new Date(r.createdAt) < new Date(fiveMinutesAgo)
    );
    
    for (const request of stuckRequests) {
      await aiRequestDB.delete(request.id);
    }
    
    return stuckRequests.length;
  },
  
  // Clear failed upload tasks (older than 1 hour)
  clearFailedUploads: async (): Promise<number> => {
    const allUploads = await uploadDB.getAll();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const failedUploads = allUploads.filter(u => 
      (u.status === 'failed' || u.status === 'uploading') && 
      new Date(u.updatedAt) < new Date(oneHourAgo)
    );
    
    for (const upload of failedUploads) {
      await uploadDB.delete(upload.id);
    }
    
    return failedUploads.length;
  },
  
  // Get counts for debugging
  getDebugCounts: async () => {
    const [allAI, queuedAI, processingAI, allUploads, pendingUploads, uploadingUploads, failedUploads] = await Promise.all([
      aiRequestDB.getAll(),
      aiRequestDB.getQueued(),
      aiRequestDB.getProcessing(),
      uploadDB.getAll(),
      uploadDB.getPending(),
      getByIndex<UploadTask>("uploads", "status", "uploading"),
      getByIndex<UploadTask>("uploads", "status", "failed"),
    ]);
    
    return {
      aiRequests: {
        total: allAI.length,
        queued: queuedAI.length,
        processing: processingAI.length,
        completed: allAI.filter(r => r.status === 'completed').length,
        failed: allAI.filter(r => r.status === 'failed').length,
      },
      uploads: {
        total: allUploads.length,
        pending: pendingUploads.length,
        uploading: uploadingUploads.length,
        failed: failedUploads.length,
        uploaded: allUploads.filter(u => u.status === 'uploaded').length,
      }
    };
  }
};

export async function clearClinicalLocalData(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['patients','encounters','aiRequests'],'readwrite');
    tx.objectStore('patients').clear();
    tx.objectStore('encounters').clear();
    tx.objectStore('aiRequests').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error as any);
  });
  notify('patients');
  notify('encounters');
  notify('aiRequests');
}

/**
 * MIGRATION HELPER: Clear legacy IndexedDB user data
 * This should be called once during the Firebase to Backend migration
 */
export async function clearLegacyUserData(): Promise<void> {
  try {
    // Clear localStorage legacy users key
    localStorage.removeItem('afia-users');
    
    // Clear legacy auth session
    localStorage.removeItem('afia-auth-session');
    
    // Clear legacy Firebase sync timestamps
    localStorage.removeItem('afia_last_cloud_sync');
    
    // Open and clear user store from IndexedDB
    const db = await openDB();
    if (db.objectStoreNames.contains('users')) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['users'], 'readwrite');
        tx.objectStore('users').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as any);
      });
      console.log('[MIGRATION] Cleared legacy user data from IndexedDB');
    }
    
    // Show one-time migration notice
    const migrationShown = localStorage.getItem('afia_migration_v2_shown');
    if (!migrationShown) {
      console.log('[MIGRATION] User data migration to new backend completed');
      localStorage.setItem('afia_migration_v2_shown', 'true');
    }
  } catch (error) {
    console.error('[MIGRATION] Error clearing legacy user data:', error);
  }
}
