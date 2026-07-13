"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Stethoscope, Activity, Lock } from "lucide-react"
import LoginForm from "./LoginForm"
import ForgotPasswordForm from "./ForgotPasswordForm"
import { useAuth } from "@/contexts/AfiaAuthContext"

export default function AuthPage() {
  const { isAuthenticated } = useAuth()
  const [view, setView] = useState<'login' | 'forgot_password'>('login')

  if (isAuthenticated) {
    return null // Will be handled by redirect in the layout
  }

  const handleLoginSuccess = () => {
    window.location.href = "/"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Form */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <Stethoscope className="h-8 w-8 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">
              Afia Health Assistant
            </CardTitle>
            <CardDescription className="text-slate-600">
              Secure clinical access for healthcare providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {view === 'login' ? (
              <div className="space-y-4">
                <LoginForm onSuccess={handleLoginSuccess} onForgotPassword={() => setView('forgot_password')} />
              </div>
            ) : (
              <ForgotPasswordForm 
                onSuccess={() => setView('login')} 
                onBackToLogin={() => setView('login')} 
              />
            )}
          </CardContent>
        </Card>

        {/* Right Side - Information */}
        <div className="hidden lg:block space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              Welcome Back, Healthcare Provider
            </h1>
            <p className="text-lg text-slate-600">
              Access your clinical workspace and continue providing quality care to your patients.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="flex items-start space-x-4 p-4 bg-white/60 rounded-lg backdrop-blur-sm">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Secure Authentication</h3>
                <p className="text-sm text-slate-600">
                  Email and password-based access with JWT tokens ensures only authorized healthcare providers can access patient data.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4 p-4 bg-white/60 rounded-lg backdrop-blur-sm">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Activity className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Offline-Ready</h3>
                <p className="text-sm text-slate-600">
                  Continue working even without internet connectivity. Your data syncs automatically when connection is restored.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4 p-4 bg-white/60 rounded-lg backdrop-blur-sm">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Lock className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Admin-Provisioned Accounts</h3>
                <p className="text-sm text-slate-600">
                  All user accounts are created by clinic administrators for security and compliance with healthcare regulations.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm text-emerald-800 text-center">
              <strong>Need an account?</strong> Contact your clinic administrator to request access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
