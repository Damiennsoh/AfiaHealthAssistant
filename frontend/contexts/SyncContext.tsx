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
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Track queued patient IDs so we don't re-queue on every syncToCloud call
  const queuedPatientIds = useRef<Set<string>>(new Set());
  const queuedEncounterIds = useRef<Set<string>>(new Set());

  // Listen to network state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync every 30 seconds when online
  useEffect(() => {
    if (!user) return;
    syncService.startAutoSync(30000);
    return () => syncService.stopAutoSync();
  }, [user]);

  /**
   * Queue any un-synced IndexedDB records and push to backend.
   * Called by form components after saving data locally.
   */
  const syncToCloud = useCallback(async (): Promise<void> => {
    if (!user) return;
    if (!isOnline) {
      console.log('[Sync] Offline — changes queued, will push when online');
      return;
    }

    setIsSyncing(true);
    try {
      // --- Queue patients that haven't been queued yet ---
      const patients = await patientDB.getAll(true); // include soft-deleted
      for (const patient of patients) {
        if (!queuedPatientIds.current.has(patient.id)) {
          queuedPatientIds.current.add(patient.id);
          const action = patient.isDeleted ? 'delete' : 'create';
          syncService.queueChange(action, 'patient', patient.id, patient as any);
        }
      }

      // --- Queue encounters that haven't been queued yet ---
      const encounters = await encounterDB.getAll(true); // include soft-deleted
      for (const encounter of encounters) {
        if (!queuedEncounterIds.current.has(encounter.id)) {
          queuedEncounterIds.current.add(encounter.id);
          const action = encounter.isDeleted ? 'delete' : 'create';
          syncService.queueChange(action, 'encounter', encounter.id, encounter as any);
        }
      }

      // --- Push all pending changes to backend ---
      const result = await syncService.sync();
      console.log(`[Sync] ✅ Pushed ${result.synced} records (${result.failed} failed, ${result.conflicts} conflicts)`);

      if (result.synced > 0) {
        setLastSync(new Date());
      }
      setPendingSyncCount(syncService.getPendingCount());
    } catch (error) {
      console.error('[Sync] syncToCloud error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [user, isOnline]);

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
