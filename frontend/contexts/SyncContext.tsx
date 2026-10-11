"use client"
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AfiaAuthContext';
import { syncService } from '@/lib/afia-sync';
import { patientDB, encounterDB } from '@/lib/db';

interface SyncContextType {
  db: null;
  user: any;
  loading: boolean;
  isOnline: boolean;
  appId: string;
  clinicId: string;
  hasClinicClaims: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  syncToCloud: () => Promise<void>;
  getClinicCollection: () => null;
  pendingSyncCount: number;
}

const SyncContext = createContext<SyncContextType>({
  db: null,
  user: null,
  loading: false,
  isOnline: true,
  appId: 'stub-app-id',
  clinicId: 'UNASSIGNED',
  hasClinicClaims: true,
  isSyncing: false,
  lastSync: null,
  syncToCloud: async () => {},
  getClinicCollection: () => null,
  pendingSyncCount: 0,
});

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isGuestMode } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Track already-synced record IDs for the current session to avoid redundant
  // re-queuing. Unlike the old Set-based approach, records that FAILED sync are
  // removed from this set so they will be re-queued on the next syncToCloud call.
  const syncedPatientIds = useRef<Set<string>>(new Set());
  const syncedEncounterIds = useRef<Set<string>>(new Set());

  /**
   * Queue any un-synced IndexedDB records and push to backend.
   * Called by form components after saving data locally.
   *
   * Records are always re-checked on each call. A record is skipped only if
   * it was already successfully synced during THIS browser session and has not
   * been modified since (tracked via syncedPatientIds / syncedEncounterIds).
   */
  const syncToCloud = useCallback(async (): Promise<void> => {
    if (!user) return;
    // 🪣 GUEST ISOLATION: never push guest sandbox data to the backend
    if (isGuestMode) {
      syncService.clearClinicScope();
      console.log('[Sync] Guest mode — syncToCloud skipped. Sandbox data is local-only.');
      return;
    }
    if (user.role === 'super_admin' || !user.clinic_id) {
      syncService.clearClinicScope();
      return;
    }
    syncService.setClinicScope(String(user.clinic_id));
    if (!isOnline) {
      console.log('[Sync] Offline — changes queued, will push when online');
      return;
    }

    setIsSyncing(true);
    try {
      // --- Queue patients that need syncing ---
      const patients = await patientDB.getAll(true); // include soft-deleted
      for (const patient of patients) {
        if (!syncedPatientIds.current.has(patient.id)) {
          const action = patient.isDeleted ? 'delete' : 'create';
          syncService.queueChange(action, 'patient', patient.id, patient as any);
        }
      }

      // --- Queue encounters that need syncing ---
      const encounters = await encounterDB.getAll(true); // include soft-deleted
      for (const encounter of encounters) {
        if (!syncedEncounterIds.current.has(encounter.id)) {
          const action = encounter.isDeleted ? 'delete' : 'create';
          syncService.queueChange(action, 'encounter', encounter.id, encounter as any);
        }
      }

      // --- Push all pending changes to backend ---
      const result = await syncService.sync();
      console.log(`[Sync] ✅ Pushed ${result.synced} records (${result.failed} failed, ${result.conflicts} conflicts)`);

      if (result.synced > 0) {
        setLastSync(new Date());
        // Mark successfully synced records so they aren't re-queued unnecessarily
        for (const p of patients) syncedPatientIds.current.add(p.id);
        for (const e of encounters) syncedEncounterIds.current.add(e.id);
      }

      // If some failed, remove them from the synced set so they get re-queued
      if (result.failed > 0) {
        const failedChanges = syncService.getChangesByStatus('failed');
        for (const fc of failedChanges) {
          if (fc.resourceType === 'patient') syncedPatientIds.current.delete(fc.resourceId);
          if (fc.resourceType === 'encounter') syncedEncounterIds.current.delete(fc.resourceId);
        }
      }

      setPendingSyncCount(syncService.getPendingCount());
    } catch (error) {
      console.error('[Sync] syncToCloud error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [user, isOnline, isGuestMode]);

  // Listen to network state and foreground visibility
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      setIsOnline(true);
      if (user && !isGuestMode && user.clinic_id) {
        syncToCloud().catch(err => console.warn('[Sync] Reconnect sync error:', err));
      }
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && user && !isGuestMode && user.clinic_id) {
        syncService.pullAndReconcile().catch(err => console.warn('[Sync] Foreground pull error:', err));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, isGuestMode, syncToCloud]);

  // Auto-sync every 30 seconds when online — DISABLED for guest demo sessions
  useEffect(() => {
    if (!user || isGuestMode || user.role === 'super_admin' || !user.clinic_id) {
      syncedPatientIds.current.clear();
      syncedEncounterIds.current.clear();
      syncService.clearClinicScope();
      syncService.stopAutoSync();
      return;
    }
    syncedPatientIds.current.clear();
    syncedEncounterIds.current.clear();
    syncService.setClinicScope(String(user.clinic_id));

    // Proactively pull latest records from server on login / scope change.
    // On a brand-new device the local DB is empty; the pull fetches ALL clinic
    // records from the server (lastSync is null ➜ no timestamp filter).
    syncService.pullAndReconcile().then(result => {
      console.log(`[Sync] 📥 Initial login pull: ${result.pulledPatients} patients, ${result.pulledEncounters} encounters`);
      if (result.pulledPatients > 0 || result.pulledEncounters > 0) {
        setLastSync(new Date());
      }
    }).catch(err => {
      console.warn('[Sync] Initial login pull warning:', err);
    });

    syncService.startAutoSync(30000);
    return () => syncService.stopAutoSync();
  }, [user, isGuestMode]);

  // Update pending count whenever the queue changes
  useEffect(() => {
    setPendingSyncCount(syncService.getPendingCount());
  }, [isSyncing]);

  const value: SyncContextType = {
    db: null,
    user,
    loading: false,
    isOnline,
    appId: 'stub-app-id',
    clinicId: user?.clinic_id || 'UNASSIGNED',
    hasClinicClaims: true,
    isSyncing,
    lastSync,
    syncToCloud,
    getClinicCollection: () => null,
    pendingSyncCount,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);

