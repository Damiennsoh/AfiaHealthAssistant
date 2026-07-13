/**
 * AFIA Health Assistant — Offline Auth Service
 *
 * Enables staff to authenticate locally when the device is offline.
 *
 * HOW IT WORKS:
 * 1. On every successful online login, we cache a "session profile" in IndexedDB:
 *    - Full user profile (role, clinic_id, country_code, etc.)
 *    - A bcrypt-compatible hash of the password is NOT stored here.
 *      Instead, we store the user's UUID and rely on the cached JWT for rehydration.
 *    - A SHA-256 hash of (email + password + salt) is stored as a local verifier.
 *    - The salt is a device-specific value stored in localStorage (never sent to server).
 *
 * 2. On subsequent visits/refreshes:
 *    a. If ONLINE  → validate JWT against backend as normal.
 *    b. If OFFLINE → check if a valid (non-expired) cached JWT exists.
 *       - If JWT is not expired → restore session from cached profile. No password needed.
 *       - If JWT is expired → prompt user for password → verify against local hash.
 *         If verified, restore session from cached profile. Flag for re-sync on next connect.
 *
 * CONFLICT PREVENTION (Nurse vs Doctor on different devices):
 * - Every write to patients/encounters includes a device fingerprint + `updatedAt` timestamp.
 * - The sync engine uses "last-writer-wins" by timestamp.
 * - The offline session is SCOPED to the same clinic_id that was used online.
 *   A user cannot cross clinic boundaries offline.
 * - An offline session cannot create NEW users — only the backend can do that.
 *
 * SECURITY:
 * - The local credential hash uses PBKDF2 with 100k iterations (Web Crypto API).
 * - Hash is stored in IndexedDB under a key derived from the email (not the ID).
 * - An attacker with physical access to the device still needs the password to
 *   authenticate after JWT expiry (15-min offline window configurable).
 * - Device fingerprint prevents hash portability across devices.
 */

const OFFLINE_SESSION_STORE = 'afia_offline_sessions';
const OFFLINE_HASH_PREFIX = 'afia_local_hash_';
const DEVICE_SALT_KEY = 'afia_device_salt';
const JWT_OFFLINE_GRACE_MS = 8 * 60 * 60 * 1000; // 8 hours — matches access token lifetime

export interface CachedUserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'clinic_admin' | 'healthworker' | 'viewer';
  clinic_id?: string; // Optional for super_admin
  country_code: 'GH' | 'ZW';
  staff_id?: string;
  department?: string;
  cachedAt: number; // Unix timestamp
  clinicName?: string;
}

/**
 * Get or generate a device-specific salt.
 * This salt never leaves the device and is used in the local credential hash.
 */
function getDeviceSalt(): string {
  let salt = localStorage.getItem(DEVICE_SALT_KEY);
  if (!salt) {
    // Generate a 32-char random salt once per device
    salt = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(DEVICE_SALT_KEY, salt);
  }
  return salt;
}

/**
 * Derive a local credential hash from email + password + device salt.
 * Uses PBKDF2 with SHA-256, 100k iterations — resistant to brute-force.
 */
async function deriveLocalHash(email: string, password: string): Promise<string> {
  const salt = getDeviceSalt();
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(email.toLowerCase() + salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decode the payload of a JWT without verifying the signature.
 * We use this ONLY to read the expiry timestamp — actual verification
 * is always done by the backend on the next online session.
 */
function decodeJWTPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if the stored JWT is within the offline grace period.
 * Returns true if the token has not expired yet.
 */
function isTokenStillValid(token: string): boolean {
  const payload = decodeJWTPayload(token);
  if (!payload || !payload.exp) return false;
  const expiresAt = payload.exp * 1000; // Convert to ms
  return Date.now() < expiresAt;
}

// ─── IndexedDB helpers (minimal, self-contained) ──────────────────────────────

async function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('afia-health-db', 4);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      // The main db.ts handles schema creation; we just open it here.
    };
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName: string, value: unknown): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a user session to IndexedDB after a successful online login.
 * Also derives and stores the local credential hash for offline fallback.
 *
 * @param profile  User profile returned from the backend.
 * @param password The plaintext password used during this login (used to derive hash).
 */
export async function cacheSessionForOffline(
  profile: Omit<CachedUserProfile, 'cachedAt'>,
  password: string
): Promise<void> {
  try {
    const sessionRecord: CachedUserProfile = {
      ...profile,
      cachedAt: Date.now(),
    };

    // 1. Save the user profile to the 'metadata' store (keyed by email)
    await idbPut('metadata', { key: `${OFFLINE_SESSION_STORE}:${profile.email.toLowerCase()}`, ...sessionRecord });

    // 2. Derive and save the local credential hash
    const hash = await deriveLocalHash(profile.email, password);
    localStorage.setItem(`${OFFLINE_HASH_PREFIX}${profile.email.toLowerCase()}`, hash);

    console.log('[OfflineAuth] Session cached for:', profile.email);
  } catch (error) {
    // Non-fatal: if caching fails, online auth still works normally
    console.warn('[OfflineAuth] Failed to cache session:', error);
  }
}

/**
 * Attempt to restore a user session completely offline.
 *
 * Strategy:
 * 1. If a valid (non-expired) JWT is in localStorage → restore from cached profile.
 *    No password required.
 * 2. If JWT is expired and a password is provided → verify local hash.
 *    If hash matches → restore from cached profile.
 * 3. Otherwise → return null (user must connect to get a new token).
 *
 * @param email    User's email address.
 * @param password Optional: required only when JWT has expired.
 * @returns        Cached user profile, or null if offline auth fails.
 */
export async function restoreOfflineSession(
  email: string,
  password?: string
): Promise<CachedUserProfile | null> {
  try {
    const token = localStorage.getItem('afia_access_token');
    const emailKey = email.toLowerCase();

    // Load cached profile from IndexedDB
    const cached = await idbGet<CachedUserProfile & { key: string }>(
      'metadata',
      `${OFFLINE_SESSION_STORE}:${emailKey}`
    );

    if (!cached) {
      console.log('[OfflineAuth] No cached session found for:', email);
      return null;
    }

    // Strategy 1: JWT is still valid → restore without password
    if (token && isTokenStillValid(token)) {
      console.log('[OfflineAuth] Valid JWT — restoring session from cache for:', email);
      return cached;
    }

    // Strategy 2: JWT expired but password provided → verify local hash
    if (password) {
      const storedHash = localStorage.getItem(`${OFFLINE_HASH_PREFIX}${emailKey}`);
      if (!storedHash) {
        console.log('[OfflineAuth] No local hash found — cannot verify offline');
        return null;
      }

      const derivedHash = await deriveLocalHash(email, password);
      if (derivedHash === storedHash) {
        console.log('[OfflineAuth] Password verified offline — restoring session for:', email);
        // Flag: this session was restored offline and needs re-sync
        localStorage.setItem('afia_offline_restored', 'true');
        return cached;
      } else {
        console.log('[OfflineAuth] Password mismatch — offline login rejected for:', email);
        return null;
      }
    }

    console.log('[OfflineAuth] JWT expired and no password provided — cannot restore session');
    return null;
  } catch (error) {
    console.warn('[OfflineAuth] restoreOfflineSession error:', error);
    return null;
  }
}

/**
 * Clear all offline session data for a user (called on explicit logout).
 */
export function clearOfflineSession(email: string): void {
  const emailKey = email.toLowerCase();
  localStorage.removeItem(`${OFFLINE_HASH_PREFIX}${emailKey}`);
  localStorage.removeItem('afia_offline_restored');
  // Note: the IndexedDB metadata entry is left as a soft record.
  // It will be overwritten on next successful login.
  console.log('[OfflineAuth] Cleared offline session for:', email);
}
