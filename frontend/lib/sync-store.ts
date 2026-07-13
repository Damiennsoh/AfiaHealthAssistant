/**
 * Sync Session Store
 * Shared in-memory store for cloud sync sessions
 * In production, this should be replaced with Redis or Firestore
 */

export interface SyncSession {
  code: string;
  data: any;
  expiresAt: string;
  createdAt: string;
  deviceId: string;
}

// In-memory store for demo (use Redis/Firestore in production)
export const syncSessions = new Map<string, SyncSession>();
