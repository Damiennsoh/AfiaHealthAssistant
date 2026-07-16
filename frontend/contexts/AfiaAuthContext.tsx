"use client";

/**
 * AFIA Health Assistant - Authentication Context
 * Replaces Firebase Auth with JWT-based authentication
 * No self-registration - admin-provisioned accounts only
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { afiaAPI } from '@/lib/afia-api';
import {
  cacheSessionForOffline,
  restoreOfflineSession,
  clearOfflineSession,
  type CachedUserProfile,
} from '@/lib/offline-auth';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'clinic_admin' | 'healthworker' | 'viewer';
  clinic_id?: string;
  country_code: 'GH' | 'ZW';
  staff_id?: string;
  department?: string;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, clinicId?: string, staffId?: string, department?: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
  verifyAdminPassword: (password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Validate existing token on mount
   */
  useEffect(() => {
    console.log('[AuthContext] Mounting - checking for existing token');
    const token = typeof window !== 'undefined' ? localStorage.getItem('afia_access_token') : null;
    console.log('[AuthContext] Token found:', !!token);
    if (token) {
      validateToken();
    } else {
      console.log('[AuthContext] No token found, setting isLoading to false');
      setIsLoading(false);
    }
  }, []);

  const validateToken = async () => {
    console.log('[AuthContext] validateToken called');
    try {
      // ── OFFLINE PATH ──────────────────────────────────────────────────────
      if (typeof window !== 'undefined' && !navigator.onLine) {
        console.log('[AuthContext] Offline mode - attempting to restore session from IndexedDB');
        // Try to restore a full session from IndexedDB offline cache
        const email = localStorage.getItem('afia_last_email');
        console.log('[AuthContext] Last email found:', email);
        if (email) {
          const cached: CachedUserProfile | null = await restoreOfflineSession(email);
          console.log('[AuthContext] Cached session found:', !!cached);
          if (cached) {
            const userData: User = {
              id: cached.id,
              email: cached.email,
              full_name: cached.full_name,
              role: cached.role,
              clinic_id: cached.clinic_id,
              country_code: cached.country_code,
              staff_id: cached.staff_id,
              department: cached.department,
            };
            console.log('[AuthContext] Setting user from cache:', userData.email);
            setUser(userData);
            afiaAPI.setCountry(userData.country_code);
            console.log('[Auth] Offline session restored from cache for:', email);
            setIsLoading(false);
            return;
          }
        }
        // No cached session — user stays logged out until online
        console.log('[AuthContext] No cached session, setting isLoading to false');
        setIsLoading(false);
        return;
      }

      // ── ONLINE PATH ───────────────────────────────────────────────────────
      console.log('[AuthContext] Online mode - validating token with backend');
      const response = await afiaAPI.getCurrentUser();
      console.log('[AuthContext] API response status:', response.status);
      console.log('[AuthContext] API response data:', !!response.data);

      if (response.data) {
        const userData: User = {
          id: response.data.id,
          email: response.data.email,
          full_name: response.data.full_name,
          role: response.data.role as User['role'],
          clinic_id: response.data.clinic_id,
          country_code: (response.data.country_code || 'GH') as 'GH' | 'ZW',
          staff_id: response.data.staff_id,
          department: response.data.department,
        };

        console.log('[AuthContext] Setting user from API:', userData.email);
        setUser(userData);

        // Set country context for API
        afiaAPI.setCountry(userData.country_code);
      } else if (response.status === 401) {
        console.log('[AuthContext] Token invalid (401), clearing tokens');
        // Token invalid, clear
        afiaAPI.clearTokens();
      }
    } catch (error) {
      console.error('[AuthContext] Token validation failed:', error);
      // Only clear tokens if we are sure it's not a network error
      if (typeof window !== 'undefined' && navigator.onLine) {
        console.log('[AuthContext] Online and error occurred, clearing tokens');
        afiaAPI.clearTokens();
      }
    } finally {
      console.log('[AuthContext] validateToken complete, setting isLoading to false');
      setIsLoading(false);
    }
  };

  /**
   * Login with email, password, selected clinic, and optional staff_id/department/role
   * No self-registration - accounts are admin-provisioned
   */
  const login = useCallback(async (email: string, password: string, clinicId?: string, staffId?: string, department?: string, role?: string) => {
    console.log('[AuthContext] login called for:', email);
    setIsLoading(true);

    try {
      // ── OFFLINE LOGIN PATH ────────────────────────────────────────────────
      if (typeof window !== 'undefined' && !navigator.onLine) {
        console.log('[AuthContext] Offline login attempt');
        const cached = await restoreOfflineSession(email, password);
        console.log('[AuthContext] Offline session restored:', !!cached);
        if (cached) {
          const userData: User = {
            id: cached.id,
            email: cached.email,
            full_name: cached.full_name,
            role: cached.role,
            clinic_id: cached.clinic_id,
            country_code: cached.country_code,
            staff_id: cached.staff_id,
            department: cached.department,
          };
          console.log('[AuthContext] Setting user from offline login:', userData.email);
          setUser(userData);
          afiaAPI.setCountry(userData.country_code);
          console.log('[Auth] Offline login successful for:', email);
          setIsLoading(false);
          return;
        }
        throw new Error('Offline login failed. Please ensure you have logged in online at least once on this device.');
      }

      // ── ONLINE LOGIN PATH ─────────────────────────────────────────────────
      console.log('[AuthContext] Online login attempt');
      const response = await afiaAPI.login(email, password, clinicId, staffId, department, role);
      console.log('[AuthContext] API login response status:', response.status);
      console.log('[AuthContext] API login response error:', response.error);
      console.log('[AuthContext] API login response data:', !!response.data);

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.data) {
        throw new Error('Login failed: No user data returned from server');
      }

      if (response.data) {
        console.log('[AuthContext] Login successful, processing user data');
        const userData: User = {
          id: response.data.user.id,
          email: response.data.user.email,
          full_name: response.data.user.name || response.data.user.email,
          role: response.data.user.role as User['role'],
          clinic_id: response.data.user.clinic_id,
          country_code: (response.data.user.country_code || 'GH') as 'GH' | 'ZW',
          staff_id: response.data.user.staff_id,
          department: response.data.user.department,
        };

        console.log('[AuthContext] Setting user from login:', userData.email);
        setUser(userData);
        afiaAPI.setCountry(userData.country_code);

        // Remember email for offline session restoration on next visit
        localStorage.setItem('afia_last_email', email.toLowerCase());

        // Cache the session + derive local credential hash for offline use
        console.log('[AuthContext] Caching session for offline use');
        cacheSessionForOffline(
          {
            id: userData.id,
            email: userData.email,
            full_name: userData.full_name,
            role: userData.role,
            clinic_id: userData.clinic_id || (clinicId ? clinicId : undefined),
            country_code: userData.country_code,
            staff_id: userData.staff_id,
            department: userData.department,
          },
          password
        ).catch((e) => console.warn('[Auth] Session cache failed (non-fatal):', e));
      }
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      throw error;
    } finally {
      console.log('[AuthContext] Login complete, setting isLoading to false');
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout and clear session
   */
  const logout = useCallback(async () => {
    const email = localStorage.getItem('afia_last_email');
    try {
      if (navigator.onLine) {
        await afiaAPI.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      afiaAPI.clearTokens();
      if (email) clearOfflineSession(email);
      localStorage.removeItem('afia_last_email');
      setUser(null);
    }
  }, []);

  /**
   * Refresh user data from server
   */
  const refreshUser = useCallback(async () => {
    try {
      const response = await afiaAPI.getCurrentUser();
      if (response.data) {
        const userData: User = {
          id: response.data.id,
          email: response.data.email,
          full_name: response.data.full_name,
          role: response.data.role as User['role'],
          clinic_id: response.data.clinic_id,
          country_code: (response.data.country_code || 'GH') as 'GH' | 'ZW',
          staff_id: response.data.staff_id,
          department: response.data.department,
        };
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  /**
   * Check if user has a specific permission
   */
  const can = useCallback((permission: string): boolean => {
    if (!user) return false;

    const rolePermissions: Record<string, string[]> = {
      super_admin: ['*'],
      clinic_admin: [
        'users:read', 'users:create', 'users:update', 'users:delete',
        'patients:*', 'encounters:*', 'clinic:manage',
        'knowledge:query', 'knowledge:manage', 'knowledge:upload', 'knowledge:delete',
        'reports:read', 'sync:manage',
        'backup:create', 'backup:download', 'backup:restore',
        'clinical:delete',
      ],
      healthworker: [
        'patients:read', 'patients:create', 'patients:update',
        'encounters:read', 'encounters:create', 'encounters:update',
        'knowledge:query',
      ],
      viewer: [
        'patients:read', 'encounters:read', 'knowledge:query',
      ],
    };

    const permissions = rolePermissions[user.role] || [];
    return permissions.includes('*') || permissions.includes(permission);
  }, [user]);

  /**
   * Verify admin password by re-authenticating with the backend.
   * Used by AdminAuthModal to confirm sensitive operations.
   */
  const verifyAdminPassword = useCallback(async (password: string): Promise<boolean> => {
    if (!user || !user.clinic_id) return false;
    try {
      // Re-login to verify credentials without changing session
      const response = await afiaAPI.login(user.email, password, user.clinic_id, user.staff_id, user.department);
      return !response.error && !!response.data;
    } catch {
      return false;
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        can,
        refreshUser,
        verifyAdminPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

/**
 * Higher-order component for protected routes
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission?: string
) {
  return function ProtectedRoute(props: P) {
    const { user, isLoading, isAuthenticated, can } = useAuth();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        window.location.href = '/';
      }

      if (!isLoading && requiredPermission && !can(requiredPermission)) {
        window.location.href = '/unauthorized';
      }
    }, [isLoading, isAuthenticated]);

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      return null;
    }

    if (requiredPermission && !can(requiredPermission)) {
      return null;
    }

    return <Component {...props} />;
  };
}
