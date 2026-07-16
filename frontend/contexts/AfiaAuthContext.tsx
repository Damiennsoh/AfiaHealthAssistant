"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getKey, setActiveKey } from '@/lib/crypto'
import { afiaAPI } from '@/lib/afia-api'

// Define the Auth Context State shape
interface AuthContextType {
  user: any | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (
    email: string,
    password: string,
    clinicId?: string,
    staffId?: string,
    department?: string,
    role?: string
  ) => Promise<void>
  logout: () => Promise<void>
  can: (permission: string) => boolean
  refreshUser: () => Promise<void>
  verifyAdminPassword: (password: string) => Promise<boolean>
}

const AfiaAuthContext = createContext<AuthContextType | undefined>(undefined)

const SESSION_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

// Simple local IndexedDB helper functions
async function saveSessionToLocalDB(user: any, token: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("afia_health_db", 1)

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains("session")) {
        db.createObjectStore("session", { keyPath: "id" })
      }
    }

    request.onsuccess = (e: any) => {
      const db = e.target.result
      const transaction = db.transaction("session", "readwrite")
      const store = transaction.objectStore("session")

      // Store user and token under a static main key
      const putRequest = store.put({ id: "current_session", user, token, updatedAt: Date.now() })

      putRequest.onsuccess = () => resolve()
      putRequest.onerror = () => reject(putRequest.error)
    }

    request.onerror = () => reject(request.error)
  })
}

async function getSessionFromLocalDB() {
  return new Promise<{ user: any; token: string } | null>((resolve, reject) => {
    const request = indexedDB.open("afia_health_db", 1)

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains("session")) {
        db.createObjectStore("session", { keyPath: "id" })
      }
    }

    request.onsuccess = (e: any) => {
      const db = e.target.result
      const transaction = db.transaction("session", "readonly")
      const store = transaction.objectStore("session")
      const getRequest = store.get("current_session")

      getRequest.onsuccess = () => {
        const session = getRequest.result
        if (session) {
          const isExpired = Date.now() - session.updatedAt > SESSION_EXPIRY_MS
          if (isExpired) {
            console.log("[AuthContext] Local session expired.")
            clearSessionFromLocalDB().then(() => resolve(null)).catch(() => resolve(null))
            return
          }
        }
        resolve(session || null)
      }
      getRequest.onerror = () => reject(getRequest.error)
    }

    request.onerror = () => reject(request.error)
  })
}

async function clearSessionFromLocalDB() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("afia_health_db", 1)
    request.onsuccess = (e: any) => {
      const db = e.target.result
      const transaction = db.transaction("session", "readwrite")
      const store = transaction.objectStore("session")
      const deleteRequest = store.delete("current_session")
      deleteRequest.onsuccess = () => resolve()
      deleteRequest.onerror = () => reject(deleteRequest.error)
    }
    request.onerror = () => reject(request.error)
  })
}

async function touchSessionInLocalDB() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("afia_health_db", 1)
    request.onsuccess = (e: any) => {
      const db = e.target.result
      const transaction = db.transaction("session", "readwrite")
      const store = transaction.objectStore("session")
      const getRequest = store.get("current_session")
      
      getRequest.onsuccess = () => {
        const session = getRequest.result
        if (session) {
          session.updatedAt = Date.now()
          store.put(session)
        }
        resolve()
      }
      getRequest.onerror = () => reject(getRequest.error)
    }
    request.onerror = () => reject(request.error)
  })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 1. ASYNC INITIALIZATION: Wait completely for IndexedDB on app mount
  useEffect(() => {
    async function initAuth() {
      console.log("[AuthContext] Mounting - checking for existing token...")
      try {
        const localSession = await getSessionFromLocalDB()
        if (localSession && localSession.token) {
          console.log("[AuthContext] Token found locally!")
          setUser(localSession.user)
          setToken(localSession.token)
          // Also set token in localStorage for API calls
          localStorage.setItem('afia_access_token', localSession.token)
        } else {
          console.log("[AuthContext] Token found: false")
        }
      } catch (err) {
        console.error("[AuthContext] Error reading IndexedDB session:", err)
      } finally {
        // ONLY turn off loading once we are 100% finished querying the DB
        setIsLoading(false)
      }
    }
    initAuth()
  }, [])

  // 2. THE HYBRID LOGIN METHOD
  const login = async (
    email: string,
    password: string,
    clinicId?: string,
    staffId?: string,
    department?: string,
    role?: string
  ) => {
    console.log("[AuthContext] Starting login process...")

    // Setup login payload
    const payload = { email, password, clinicId, staffId, department, role }

    if (navigator.onLine) {
      console.log("[AuthContext] Device is online. Directing auth to Render API...")

      // Perform online auth
      const response = await afiaAPI.login(email, password, clinicId, staffId, department, role)
      if (response.error) {
        throw new Error(response.error)
      }

      const freshUser = response.data?.user
      const freshToken = response.data?.access_token

      if (!freshToken) {
        throw new Error("Invalid API response: Missing authentication token.")
      }

      // Generate and store crypto key in memory
      const cryptoKey = await getKey(password)
      setActiveKey(cryptoKey)

      // CRITICAL: We must AWAIT the IndexedDB write before touching React state
      console.log("[AuthContext] Online auth success. Caching credentials asynchronously to IndexedDB...")
      await saveSessionToLocalDB(freshUser, freshToken)
      console.log("[AuthContext] IndexedDB caching complete.")

      // Now update the React state
      setUser(freshUser)
      setToken(freshToken)
      // Also set token in localStorage for API calls
      localStorage.setItem('afia_access_token', freshToken)

    } else {
      console.log("[AuthContext] Device is offline. Querying local database for cached credentials...")
      const localSession = await getSessionFromLocalDB()

      if (localSession && localSession.user) {
        // Simple verification for offline proof of concept (match email)
        if (localSession.user.email.toLowerCase() === email.toLowerCase()) {
          console.log("[AuthContext] Offline login match successful!")
          
          // Generate and store crypto key in memory.
          // Note: If the password is wrong, they will get a successful "login" here but will fail
          // to decrypt any patients/encounters when fetching from the DB.
          const cryptoKey = await getKey(password)
          setActiveKey(cryptoKey)
          
          setUser(localSession.user)
          setToken(localSession.token)
          localStorage.setItem('afia_access_token', localSession.token)
        } else {
          throw new Error("Offline login failed. No local credentials found for this email on this device.")
        }
      } else {
        throw new Error("No offline session profiles found. Please log in online first to cache your account.")
      }
    }
  }

  const logout = async () => {
    console.log("[AuthContext] Logging out user...")
    setActiveKey(null)
    await clearSessionFromLocalDB()
    setUser(null)
    setToken(null)
    localStorage.removeItem('afia_access_token')
  }

  const can = (permission: string): boolean => {
    if (!user) return false

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
    }

    const permissions = rolePermissions[user.role] || []
    return permissions.includes('*') || permissions.includes(permission)
  }

  const refreshUser = async () => {
    try {
      const response = await afiaAPI.getCurrentUser()
      if (response.data) {
        setUser(response.data)
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
    }
  }

  const verifyAdminPassword = async (password: string): Promise<boolean> => {
    if (!user || !user.clinic_id) return false
    try {
      const response = await afiaAPI.login(user.email, password, user.clinic_id, user.staff_id, user.department)
      return !response.error && !!response.data
    } catch {
      return false
    }
  }

  return (
    <AfiaAuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      can,
      refreshUser,
      verifyAdminPassword,
    }}>
      {children}
    </AfiaAuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AfiaAuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

/**
 * Higher-order component for protected routes
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission?: string
) {
  return function ProtectedRoute(props: P) {
    const { user, isLoading, isAuthenticated, can } = useAuth()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
      // CRITICAL GUARD: Only redirect if the current path is NOT the login page or root '/'
      const isPublicPath = pathname === '/' || pathname === '/login'

      if (!isLoading && !isAuthenticated && !isPublicPath) {
        console.log(`[withAuth] Guard triggered on protected path ${pathname}. Redirecting to /`);
        router.replace('/')
      }

      if (!isLoading && isAuthenticated && requiredPermission && !can(requiredPermission)) {
        console.log(`[withAuth] Permission missing. Redirecting to /unauthorized`);
        router.replace('/unauthorized')
      }

      // Touch the session to keep it alive since the user is active on a protected route
      if (isAuthenticated) {
        touchSessionInLocalDB().catch(console.error)
      }
    }, [isLoading, isAuthenticated, can, pathname, router])

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      )
    }

    // Allow displaying the route public view OR rendering the component if authenticated
    const isPublicPath = pathname === '/' || pathname === '/login'
    if (!isAuthenticated && !isPublicPath) {
      return null
    }

    if (requiredPermission && !can(requiredPermission)) {
      return null
    }

    return <Component {...props} />
  }
}
