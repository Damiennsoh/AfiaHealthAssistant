/**
 * Guest Preview Mode Utilities
 *
 * When a user logs in as the guest demo account (guest@afia.health), we:
 *  1. Route all IndexedDB reads/writes to a completely separate "sandbox" database
 *     ("afia-health-guest-db") so their test data NEVER touches the real production
 *     database ("afia-health-db").
 *  2. Disable all cloud sync so zero records are pushed to the backend.
 *  3. Show a clearly visible sandbox banner inside the app.
 *
 * This file exports the single source of truth for identifying guest mode.
 */

export const GUEST_EMAIL = "guest@afia.health";

/** Production IndexedDB name — real clinic staff */
export const PROD_DB_NAME = "afia-health-db";

/** Sandbox IndexedDB name — guest demo only */
export const GUEST_DB_NAME = "afia-health-guest-db";

/**
 * Determine if the currently signed-in user is the guest demo account.
 * Works on both server (returns false) and client.
 */
export function isGuestEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === GUEST_EMAIL;
}

/**
 * Read the active DB name from localStorage so db.ts can pick it up
 * without needing React context (avoids circular imports).
 */
export const ACTIVE_DB_KEY = "afia_active_db_name";

export function setActiveDB(dbName: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_DB_KEY, dbName);
}

export function getActiveDB(): string {
  if (typeof window === "undefined") return PROD_DB_NAME;
  return localStorage.getItem(ACTIVE_DB_KEY) || PROD_DB_NAME;
}

/** Call this when guest logs in — switches to the sandbox DB */
export function activateGuestDB() {
  setActiveDB(GUEST_DB_NAME);
}

/** Call this when guest logs out or a real user logs in — switches back to prod DB */
export function activateProdDB() {
  setActiveDB(PROD_DB_NAME);
}
