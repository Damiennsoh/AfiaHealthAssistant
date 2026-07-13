/**
 * AFIA OFFLINE-FIRST SECURITY MODULE
 * Handles brute-force protection even without internet.
 */

import { openDB, IDBPDatabase } from 'idb';

interface LockoutState {
  userId: string;
  failedAttempts: number;
  lastAttemptAt: number;
  lockoutUntil: number | null;
  deviceId?: string;
  syncedAt?: number;
}

interface LockoutStatus {
  locked: boolean;
  remaining: number;
  attemptsRemaining: number;
  totalAttempts: number;
}

const DB_NAME = 'afia_security';
const STORE_NAME = 'lockouts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const RESET_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Generate device fingerprint for hardware binding
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let deviceId = localStorage.getItem('afia_device_id');
  if (!deviceId) {
    // Create a device fingerprint from available browser properties
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      Math.random().toString(36).substr(2, 9)
    ].join('|');
    
    deviceId = btoa(fingerprint).substr(0, 32);
    localStorage.setItem('afia_device_id', deviceId);
  }
  return deviceId;
}

async function getSecurityDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    },
  });
}

export const SecurityService = {
  /**
   * Validates if user is currently allowed to attempt a login.
   */
  async checkLockoutStatus(userId: string): Promise<LockoutStatus> {
    const db = await getSecurityDB();
    const deviceId = getDeviceId();
    const compositeKey = `${userId}_${deviceId}`;
    
    let state: LockoutState = (await db.get(STORE_NAME, compositeKey)) || {
      userId: compositeKey,
      failedAttempts: 0,
      lastAttemptAt: 0,
      lockoutUntil: null,
      deviceId,
    };

    const now = Date.now();

    // Check if current lockout period has expired
    if (state.lockoutUntil && now < state.lockoutUntil) {
      return {
        locked: true,
        remaining: state.lockoutUntil - now,
        attemptsRemaining: 0,
        totalAttempts: state.failedAttempts
      };
    }

    // Reset attempts if last failure was a long time ago (24 hours)
    if (now - state.lastAttemptAt > RESET_DURATION) {
      state.failedAttempts = 0;
      state.lockoutUntil = null;
      await db.put(STORE_NAME, state);
    }

    return {
      locked: false,
      remaining: 0,
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - state.failedAttempts),
      totalAttempts: state.failedAttempts
    };
  },

  /**
   * Registers a failed login attempt.
   */
  async recordFailure(userId: string): Promise<{ attemptsRemaining: number; lockoutTime: number | null; locked: boolean }> {
    const db = await getSecurityDB();
    const deviceId = getDeviceId();
    const compositeKey = `${userId}_${deviceId}`;
    
    let state: LockoutState = (await db.get(STORE_NAME, compositeKey)) || {
      userId: compositeKey,
      failedAttempts: 0,
      lastAttemptAt: 0,
      lockoutUntil: null,
      deviceId,
    };

    state.failedAttempts += 1;
    state.lastAttemptAt = Date.now();

    let locked = false;
    let lockoutTime = null;

    if (state.failedAttempts >= MAX_ATTEMPTS) {
      state.lockoutUntil = Date.now() + LOCKOUT_DURATION;
      lockoutTime = state.lockoutUntil;
      locked = true;
      
      console.warn(`[SecurityService] User ${userId} locked out for ${LOCKOUT_DURATION/60000} minutes due to ${state.failedAttempts} failed attempts`);
    }

    await db.put(STORE_NAME, state);

    return {
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - state.failedAttempts),
      lockoutTime,
      locked
    };
  },

  /**
   * Resets failures upon successful login and syncs to cloud if available.
   */
  async clearLockout(userId: string, syncToCloud: boolean = true): Promise<void> {
    const db = await getSecurityDB();
    const deviceId = getDeviceId();
    const compositeKey = `${userId}_${deviceId}`;
    
    // Clear local lockout
    await db.delete(STORE_NAME, compositeKey);
    
    // Sync to cloud if online and requested
    if (syncToCloud && typeof window !== 'undefined' && navigator.onLine) {
      try {
        await fetch('/api/sync-lockout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            deviceId,
            action: 'clear',
            timestamp: Date.now()
          })
        });
        console.log(`[SecurityService] Cleared lockout for ${userId} and synced to cloud`);
      } catch (error) {
        console.warn(`[SecurityService] Failed to sync lockout clearance to cloud:`, error);
      }
    }
  },

  /**
   * Syncs current lockout state to cloud (for remote enforcement)
   */
  async syncLockoutToCloud(userId: string): Promise<void> {
    const db = await getSecurityDB();
    const deviceId = getDeviceId();
    const compositeKey = `${userId}_${deviceId}`;
    
    const state = await db.get(STORE_NAME, compositeKey);
    if (!state) return;
    
    try {
      await fetch('/api/sync-lockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          deviceId,
          failedAttempts: state.failedAttempts,
          lockoutUntil: state.lockoutUntil,
          lastAttemptAt: state.lastAttemptAt,
          timestamp: Date.now()
        })
      });
      console.log(`[SecurityService] Synced lockout state for ${userId} to cloud`);
    } catch (error) {
      console.warn(`[SecurityService] Failed to sync lockout to cloud:`, error);
    }
  },

  /**
   * Gets device information for security logging
   */
  getDeviceInfo() {
    return {
      deviceId: getDeviceId(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      timestamp: Date.now()
    };
  },

  /**
   * Validates if current device is allowed to attempt login
   * (can be extended with device whitelisting/blacklisting)
   */
  async validateDevice(): Promise<{ allowed: boolean; reason?: string }> {
    const deviceId = getDeviceId();
    
    // Basic device validation - can be extended
    if (!deviceId || deviceId.length < 10) {
      return { allowed: false, reason: 'Invalid device identifier' };
    }
    
    return { allowed: true };
  },

  /**
   * Gets security statistics for monitoring
   */
  async getSecurityStats(userId: string): Promise<{
    totalFailures: number;
    isCurrentlyLocked: boolean;
    lockoutRemaining: number;
    deviceInfo: any;
  }> {
    const status = await this.checkLockoutStatus(userId);
    const deviceInfo = this.getDeviceInfo();
    
    return {
      totalFailures: status.totalAttempts,
      isCurrentlyLocked: status.locked,
      lockoutRemaining: status.remaining,
      deviceInfo
    };
  }
};

// Auto-sync lockout state when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('[SecurityService] Device online, syncing lockout state...');
    // Note: This would need to know the current userId, which should be handled by the calling component
  });
}
