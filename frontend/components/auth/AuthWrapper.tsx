"use client"

import { useAuth } from "@/contexts/AfiaAuthContext"
import AuthPage from "./AuthPage"

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { isAuthenticated, isLoading } = useAuth()

  console.log('[AuthWrapper] Render - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  if (isLoading) {
    console.log('[AuthWrapper] Showing loading state');
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <div className="w-8 h-8 bg-emerald-600 rounded-full animate-ping"></div>
          </div>
          <p className="text-slate-600 font-medium">Loading Afia Health Assistant...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    console.log('[AuthWrapper] User not authenticated, showing AuthPage');
    return <AuthPage />
  }

  console.log('[AuthWrapper] User authenticated, rendering children');
  return <>{children}</>
}
