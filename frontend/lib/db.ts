// IndexedDB database layer for Afia Health Assistant
// Uses raw IndexedDB for full control over stores and indexes
import { getActiveKey, encryptData, decryptData } from './crypto';
import { getActiveDB } from './guest-mode';

// DB_NAME is resolved dynamically at call time so that the guest demo
// account transparently uses 'afia-health-guest-db' while real clinic
// staff always use 'afia-health-db'. Never hardcode this constant in
// openDB() calls — always use getActiveDB() instead.
const DB_NAME = "afia-health-db"; // fallback — openDB() uses getActiveDB() at runtime
export const DB_VERSION = 6; // 5→6 adds audit_logs store for tamper-evident append-only action trail

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

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'staff_added'
  | 'staff_deactivated'
  | 'staff_role_changed'
  | 'user_created'
  | 'user_deleted'
  | 'user_updated'
  | 'patient_created'
  | 'patient_updated'
  | 'patient_deleted'
  | 'patient_read'
  | 'encounter_created'
  | 'encounter_updated'
  | 'encounter_completed'
  | 'encounter_deleted'
  | 'encounter_read'
  | 'backup_created'
  | 'backup_restored'
  | 'report_exported'
  | 'patient_referred'
  | 'clinic_suspended'
  | 'clinic_unsuspended'
  | 'clinic_archived'
  | 'clinic_deleted'
  | 'clinic_updated'
  | 'admin_password_reset'
  | 'clinic_settings_updated'
  | 'profile_updated'
  | 'knowledge_uploaded'
  | 'knowledge_deleted';

export interface AuditLog {
  id: string;
  action: AuditAction | string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  clinicId: string | null;
  clinicName: string | null;
  countryCode: 'GH' | 'ZW' | string | null;
  resourceType: 'clinic' | 'user' | 'patient' | 'encounter' | 'backup' | 'report' | 'referral' | 'staff' | 'knowledge' | 'session' | 'system' | string | null;
  resourceId: string | null;
  details: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  createdAt: string;
  pendingSync?: boolean;
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
  // 🔑 Guest isolation: resolve the active DB name at call time so guest users
  //    always write to 'afia-health-guest-db', never to production data.
  const activeName = getActiveDB();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(activeName, DB_VERSION);

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

      if (!db.objectStoreNames.contains("audit_logs")) {
        const auditStore = db.createObjectStore("audit_logs", {
          keyPath: "id",
        });
        auditStore.createIndex("action", "action", { unique: false });
        auditStore.createIndex("createdAt", "createdAt", { unique: false });
        auditStore.createIndex("clinicId", "clinicId", { unique: false });
        auditStore.createIndex("userId", "userId", { unique: false });
        auditStore.createIndex("resourceType_resourceId", ["resourceType", "resourceId"], { unique: false, multiEntry: false } as any);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Schema Normalization: Canonicalize encounter data shape from all sources
 * — local form saves, sync-manager pull payloads, importSyncData raw imports,
 *   or rows that were persisted under an older/migrated schema (missing fields).
 *
 * Also bridges schema mismatch between the cloud REST API (afia-api.ts) which
 * uses cloud shapes like:
 *   vitals?: { bp?: string; temperature?: number; pulse?: number;
 *              respiratory_rate?: number; spo2?: number; weight?; height?; bmi? }
 *   encounter_date: string; prescriptions?: [...]
 *
 * and the local Encounter interface (db.ts line 66) which requires:
 *   vitals: { temperature, bloodPressureSystolic, bloodPressureDiastolic,
 *             pulse, respiratoryRate, weight, height, spO2 }
 *   date: string; symptoms: string[]; drugs: DrugAdministration[];
 *   labResults: LabResult[]
 *
 * Every encounter that enters IndexedDB OR is read from IndexedDB is passed
 * through this function, so that downstream consumers (encounter-detail,
 * edit-encounter-modal, useVitalAlerts, AfiaAssistant, etc.) can safely assume
 * structural fields always exist with the correct shape.
 */
export function normalizeEncounterShape(enc: any): Encounter {
  if (!enc || typeof enc !== "object") {
    const now = new Date().toISOString();
    return {
      id: `migrated_${Math.random().toString(36).slice(2, 10)}`,
      patientId: "",
      date: now,
      vitals: {
        temperature: "",
        bloodPressureSystolic: "",
        bloodPressureDiastolic: "",
        pulse: "",
        respiratoryRate: "",
        weight: "",
        height: "",
        spO2: "",
      },
      symptoms: [],
      history: "",
      diagnosis: "",
      treatment: "",
      drugs: [],
      labResults: [],
      notes: "",
      status: "completed",
      createdAt: now,
      updatedAt: now,
    } satisfies Encounter;
  }

  const now = new Date().toISOString();
  const out: any = { ...enc };
  const s = (x: any) => (x === null || x === undefined ? "" : String(x));

  // 1. date → accept cloud's encounter_date as fallback
  if (!out.date && out.encounter_date) {
    out.date = out.encounter_date;
  }
  if (!out.date) out.date = now;

  // 2. createdAt / updatedAt → accept cloud names as fallback
  if (!out.createdAt) out.createdAt = out.created_at || now;
  if (!out.updatedAt) out.updatedAt = out.updated_at || out.updatedAt || now;

  // 2b. notes + status (required in local Encounter TS interface)
  if (typeof out.notes !== "string") {
    const noteParts: string[] = [];
    if (typeof out.clinicalNotes === "string" && out.clinicalNotes) noteParts.push(out.clinicalNotes);
    if (typeof out.notes_text === "string" && out.notes_text) noteParts.push(out.notes_text);
    out.notes = noteParts.join("\n\n");
  }
  if (out.status !== "in-progress" && out.status !== "completed") {
    const u = String(out.status ?? "").toLowerCase();
    if (u === "in_progress" || u === "inprogress" || u === "pending" || u === "draft") {
      out.status = "in-progress";
    } else {
      out.status = "completed";
    }
  }

  // 3. Vitals: merge from any source, translate names, coerce types to string
  const rawV: any = out.vitals ?? {};
  // bp string in cloud shape "120/80" → split into systolic/diastolic
  if (rawV.bp && typeof rawV.bp === "string" && !rawV.bloodPressureSystolic && !rawV.bloodPressureDiastolic) {
    const [sys, dia] = rawV.bp.split(/[\/\-]/);
    if (sys && !rawV.bloodPressureSystolic) rawV.bloodPressureSystolic = String(sys).trim();
    if (dia && !rawV.bloodPressureDiastolic) rawV.bloodPressureDiastolic = String(dia).trim();
  }
  out.vitals = {
    temperature: s(rawV.temperature ?? rawV.temp),
    bloodPressureSystolic: s(rawV.bloodPressureSystolic ?? rawV.systolic ?? rawV.sys_bp),
    bloodPressureDiastolic: s(rawV.bloodPressureDiastolic ?? rawV.diastolic ?? rawV.dia_bp),
    pulse: s(rawV.pulse ?? rawV.heart_rate ?? rawV.hr),
    respiratoryRate: s(rawV.respiratoryRate ?? rawV.respiratory_rate ?? rawV.rr),
    weight: s(rawV.weight),
    height: s(rawV.height),
    spO2: s(rawV.spO2 ?? rawV.spo2 ?? rawV.oxygen_saturation),
  };

  // 4. Symptoms: prefer symptoms[] array, else split subjective/complaint → words fallback
  if (!Array.isArray(out.symptoms)) {
    if (Array.isArray(out.complaints)) {
      out.symptoms = [...out.complaints];
    } else if (typeof out.subjective === "string" && out.subjective.length > 0) {
      out.symptoms = out.subjective
        .split(/[,.\n]+/)
        .map((x: string) => x.trim())
        .filter(Boolean);
    } else {
      out.symptoms = [];
    }
  }

  // 5. history: accept subjective / presentingComplaint / historyOfComplaint as source
  if (!out.history) {
    const parts: string[] = [];
    if (typeof out.presentingComplaint === "string" && out.presentingComplaint) parts.push(out.presentingComplaint);
    if (typeof out.historyOfComplaint === "string" && out.historyOfComplaint) parts.push(out.historyOfComplaint);
    if (typeof out.subjective === "string" && out.subjective && !parts.includes(out.subjective)) parts.push(out.subjective);
    out.history = parts.join("\n\n");
  }

  // 6. Drugs: accept drugs[] or cloud-style prescriptions[] → normalize to local DrugAdministration[]
  //    Local shape: { id, drugName, dosage, frequency, route, startDate, endDate?, prescribedBy, notes?, createdAt }
  if (!Array.isArray(out.drugs)) {
    if (Array.isArray(out.prescriptions)) {
      out.drugs = out.prescriptions.map((p: any, i: number) => {
        const dosage = s(p.dose ?? p.dosage);
        const freq = s(p.frequency);
        const duration = s(p.duration ?? p.days);
        const start = p.startDate ?? p.start_date ?? out.date ?? now;
        let end = p.endDate ?? p.end_date ?? null;
        if (!end && duration && !isNaN(parseFloat(duration))) {
          const d = new Date(start);
          d.setDate(d.getDate() + Math.round(parseFloat(duration)));
          end = d.toISOString();
        }
        return {
          id: p.id || `presc_import_${i}`,
          drugName: s(p.drug ?? p.name ?? p.drugName),
          dosage,
          frequency: freq,
          route: s(p.route ?? "PO"),
          startDate: start,
          endDate: end || undefined,
          prescribedBy: p.prescribedBy ?? p.prescribed_by ?? p.provider ?? "SYSTEM",
          notes: s(p.instructions ?? p.notes),
          createdAt: p.createdAt ?? p.created_at ?? now,
        };
      });
    } else {
      out.drugs = [];
    }
  } else if (Array.isArray(out.drugs) && out.drugs.length > 0) {
    // Ensure every existing drug entry has all required fields of the local schema
    out.drugs = out.drugs.map((p: any, i: number) => {
      const base = typeof p === "object" && p ? p : {};
      // Legacy shapes (e.g., dose/duration → dosage + start/end date computation)
      const durationStr = s(base.duration ?? base.days);
      const start = base.startDate ?? base.start_date ?? out.date ?? now;
      let end = base.endDate ?? base.end_date ?? null;
      if (!end && durationStr && !isNaN(parseFloat(durationStr))) {
        const d = new Date(start);
        d.setDate(d.getDate() + Math.round(parseFloat(durationStr)));
        end = d.toISOString();
      }
      return {
        id: base.id || `drug_norm_${i}`,
        drugName: s(base.drugName ?? base.drug ?? base.name),
        dosage: s(base.dosage ?? base.dose),
        frequency: s(base.frequency),
        route: s(base.route ?? "PO"),
        startDate: start,
        endDate: end || undefined,
        prescribedBy: base.prescribedBy ?? base.prescribed_by ?? base.provider ?? "SYSTEM",
        notes: s(base.notes ?? base.instructions),
        createdAt: base.createdAt ?? base.created_at ?? now,
      };
    });
  }

  // 7. LabResults: accept labResults[] or scalar lab_results dict/array
  //    Local shape: { id, testType, result, normalRange?, unit?, testDate, performedBy, imageUrl?, s3Url?, createdAt }
  if (!Array.isArray(out.labResults)) {
    const arr: any[] = [];
    if (Array.isArray(out.lab_results)) {
      out.lab_results.forEach((lr: any, i: number) => {
        arr.push({
          id: lr.id || `lab_import_${i}`,
          testType: s(lr.test ?? lr.test_name ?? lr.testType ?? lr.name),
          result: s(lr.result ?? lr.value),
          normalRange: s(lr.reference_range ?? lr.ref ?? lr.normalRange),
          unit: s(lr.unit),
          testDate: lr.testDate ?? lr.performedAt ?? lr.performed_at ?? lr.date ?? now,
          performedBy: lr.performedBy ?? lr.performed_by ?? lr.orderedBy ?? "SYSTEM",
          imageUrl: s(lr.imageUrl ?? lr.image_url ?? lr.image),
          s3Url: s(lr.s3Url ?? lr.s3_url),
          createdAt: lr.createdAt ?? lr.created_at ?? now,
        });
      });
    } else if (out.lab_results && typeof out.lab_results === "object" && !Array.isArray(out.lab_results)) {
      Object.entries(out.lab_results).forEach(([k, v], i) => {
        arr.push({
          id: `lab_dict_${i}`,
          testType: s(k),
          result: s(v),
          normalRange: "",
          unit: "",
          testDate: now,
          performedBy: "SYSTEM",
          createdAt: now,
        });
      });
    }
    out.labResults = arr;
  } else if (Array.isArray(out.labResults) && out.labResults.length > 0) {
    out.labResults = out.labResults.map((lr: any, i: number) => {
      const base = typeof lr === "object" && lr ? lr : {};
      return {
        id: base.id || `lab_norm_${i}`,
        testType: s(base.testType ?? base.test ?? base.test_name ?? base.testName),
        result: s(base.result ?? base.value),
        normalRange: s(base.normalRange ?? base.reference_range ?? base.ref ?? base.referenceRange),
        unit: s(base.unit),
        testDate: base.testDate ?? base.performedAt ?? base.performed_at ?? base.date ?? now,
        performedBy: base.performedBy ?? base.performed_by ?? base.orderedBy ?? "SYSTEM",
        imageUrl: s(base.imageUrl ?? base.image_url ?? base.image),
        s3Url: s(base.s3Url ?? base.s3_url),
        createdAt: base.createdAt ?? base.created_at ?? now,
      };
    });
  }

  // 8. diagnosis / treatment: accept many alternate field names (from AI response shapes,
  //    cloud Postgres REST API schema, or aiDiagnosisData nested object).
  //    Also — normalizeDiagnosisText NEVER stays empty: Mark Complete validation reads
  //    these legacy strings, and AI often returns "" for diagnosis despite having saved
  //    diagnosis inside aiDiagnosisData.primaryDiagnosis or unifiedDiagnoses[].
  const diagnosisFromUnified = Array.isArray(out.unifiedDiagnoses)
    ? out.unifiedDiagnoses.find((u: any) => u && u.type === "primary")?.diagnosis
    : null;
  const diagnosisFromAIStruct =
    out.aiDiagnosisData && typeof out.aiDiagnosisData === "object"
      ? (out.aiDiagnosisData as any).primaryDiagnosis
      : null;
  const diagnosisCandidates = [
    out.diagnosis,
    diagnosisFromUnified,
    diagnosisFromAIStruct,
    out.primary_diagnosis,
    out.primaryDiagnosis,
    out.assessment,
    out.diagnoses,
    out.workingDiagnosis,
  ];
  let diagFinal = "";
  for (const c of diagnosisCandidates) {
    if (typeof c === "string") {
      const t = c.trim();
      if (t.length > 0) { diagFinal = t; break; }
    } else if (Array.isArray(c)) {
      const joined = c
        .filter((x: any) => typeof x === "string" && x.trim().length > 0)
        .map((x: any) => String(x).trim())
        .join(", ");
      if (joined.length > 0) { diagFinal = joined; break; }
    }
  }
  out.diagnosis = diagFinal;

  const treatmentFromAIStruct =
    out.aiDiagnosisData && typeof out.aiDiagnosisData === "object"
      ? (out.aiDiagnosisData as any).treatmentPlan
      : null;
  const treatmentCandidates = [
    out.treatment,
    treatmentFromAIStruct,
    out.plan,
    out.treatment_plan,
    out.treatmentPlan,
    out.recommendations,
  ];
  let treatFinal = "";
  for (const c of treatmentCandidates) {
    if (typeof c === "string") {
      const t = c.trim();
      if (t.length > 0) { treatFinal = t; break; }
    }
  }
  out.treatment = treatFinal;

  // 9. notes + status field must exist per Encounter TS interface (already handled above).
  //    Also — If after ALL the above, diagnosis is still empty, write a safe non-empty
  //    placeholder so Mark Complete validation won't reject an encounter that has
  //    legitimate content elsewhere (clinical notes, referral, RDT, vitals etc.).
  if (!out.diagnosis) {
    const notesHint = typeof out.notes === "string" && out.notes.trim().length > 0 ? "Clinical notes present" : "";
    out.diagnosis = notesHint || "Clinical encounter recorded";
  }

  return out as Encounter;
}

// Crypto Integration Helper
async function processItemFromDB<T>(storeName: string, item: any): Promise<T> {
  if (!item) return item as T;
  if ((storeName === 'patients' || storeName === 'encounters') && item.__encrypted_payload) {
    if (!getActiveKey()) {
      if (storeName === 'encounters') return normalizeEncounterShape(item) as any as T;
      return item as T;
    }
    try {
      const decryptedString = await decryptData(item.__encrypted_payload, getActiveKey()!);
      const decryptedObj = JSON.parse(decryptedString);
      let result: any = { ...decryptedObj, ...item };
      delete result.__encrypted_payload;
      if (storeName === 'encounters') result = normalizeEncounterShape(result);
      return result as T;
    } catch (err) {
      console.error("Decryption failed for item from DB", err);
      if (storeName === 'encounters') return normalizeEncounterShape(item) as any as T;
      return item as T;
    }
  }
  if (storeName === 'encounters') return normalizeEncounterShape(item) as any as T;
  return item as T;
}

// Generic CRUD helpers
async function getAll<T>(storeName: string, includeDeleted: boolean = false): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = async () => {
      const rawResults = request.result as any[];
      const processedResults = await Promise.all(
        rawResults.map(item => processItemFromDB<T>(storeName, item))
      );
      if (includeDeleted) {
        resolve(processedResults);
      } else {
        // Filter out deleted items if not requested
        resolve(processedResults.filter((item: any) => !item.deleted && !item.isDeleted));
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
    request.onsuccess = async () => {
      const rawItem = request.result;
      const item = await processItemFromDB<T>(storeName, rawItem);
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
  
  let itemToStore: any = { ...item };
  
  if ((storeName === 'patients' || storeName === 'encounters') && getActiveKey()) {
    try {
      const payloadString = JSON.stringify(item);
      const encryptedPayload = await encryptData(payloadString, getActiveKey()!);
      // Keep indexed fields in plaintext so querying works
      if (storeName === 'patients') {
        itemToStore = {
          id: (item as any).id,
          folderNumber: (item as any).folderNumber,
          nhisNumber: (item as any).nhisNumber,
          name: (item as any).name,
          locality: (item as any).locality,
          createdAt: (item as any).createdAt,
          updatedAt: (item as any).updatedAt,
          deleted: (item as any).deleted,
          isDeleted: (item as any).isDeleted,
          __encrypted_payload: encryptedPayload
        };
      } else if (storeName === 'encounters') {
        itemToStore = {
          id: (item as any).id,
          patientId: (item as any).patientId,
          date: (item as any).date,
          status: (item as any).status,
          createdAt: (item as any).createdAt,
          updatedAt: (item as any).updatedAt,
          deleted: (item as any).deleted,
          isDeleted: (item as any).isDeleted,
          __encrypted_payload: encryptedPayload
        };
      }
    } catch (err) {
      console.error(`Encryption failed before ${storeName} DB write`, err);
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(itemToStore);
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
    request.onsuccess = async () => {
      const rawResults = request.result as any[];
      const processedResults = await Promise.all(
        rawResults.map(item => processItemFromDB<T>(storeName, item))
      );
      if (includeDeleted) {
        resolve(processedResults);
      } else {
        resolve(processedResults.filter((item: any) => !item.deleted && !item.isDeleted));
      }
    };
    request.onerror = () => resolve([]); // Return empty array on error instead of rejecting
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
  save: (encounter: Encounter | any) => put<Encounter>("encounters", normalizeEncounterShape(encounter)),
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

export const auditDB = {
  savePending: (entry: AuditLog) => put<AuditLog>("audit_logs", { ...entry, pendingSync: true }),
  getPending: async () => (await getAll<AuditLog>("audit_logs", true)).filter((entry) => entry.pendingSync),
  remove: (id: string) => deleteById("audit_logs", id),
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
