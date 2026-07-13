"use client";

/**
 * SecurityContext — Stub
 * 
 * The original SecurityContext relied on Firebase Firestore for device-level
 * security state. With the migration to a custom FastAPI backend, all security
 * enforcement is handled server-side. This stub preserves the exported symbols
 * so any un-migrated component does not crash at build time.
 */
import React, { createContext, useContext } from 'react';

interface SecurityContextType {
  isLocked: boolean;
  lockoutUntil: Date | null;
  failedAttempts: number;
  unlock: (pin: string) => boolean;
}

const SecurityContext = createContext<SecurityContextType>({
  isLocked: false,
  lockoutUntil: null,
  failedAttempts: 0,
  unlock: () => true,
});

export const HardenedSecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SecurityContext.Provider value={{ isLocked: false, lockoutUntil: null, failedAttempts: 0, unlock: () => true }}>
    {children}
  </SecurityContext.Provider>
);

export const useSecurity = () => useContext(SecurityContext);
