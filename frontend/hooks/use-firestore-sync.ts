"use client";

/**
 * useFirestoreSync — Stub
 * 
 * Real-time Firestore sync has been replaced by the AFIA REST API backend.
 * This stub maintains the hook interface so existing callers don't break,
 * but performs no actual cloud sync. Data persistence is now handled
 * server-side via the FastAPI backend with PostgreSQL.
 */
export function useFirestoreSync() {
  const isOnline = typeof window !== 'undefined' ? navigator.onLine : true;

  return {
    isSyncing: false,
    lastSync: null as Date | null,
    syncToCloud: async () => {},
    isOnline,
    isAuthenticated: true
  };
}
