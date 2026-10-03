"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { ShieldCheck, Stethoscope, Activity, Lock, WifiOff } from "lucide-react"
import LoginForm from "./LoginForm"
import ForgotPasswordForm from "./ForgotPasswordForm"
import { useAuth } from "@/contexts/AfiaAuthContext"

export default function AuthPage() {
  const { isAuthenticated } = useAuth()
  const [view, setView] = useState<'login' | 'forgot_password'>('login')
  const router = useRouter()

  if (isAuthenticated) {
    console.log('[AuthPage] User is authenticated, redirecting to dashboard');
    router.replace('/')
    return null
  }

  const handleLoginSuccess = () => {
    console.log('[AuthPage] Login success callback - Redirecting to dashboard...');
    router.replace('/')
  }

  return (
    <main className="min-h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center py-4 px-3 sm:px-6 lg:py-10 lg:px-8 relative overflow-x-hidden">
      {/* Subtle ambient clinical illumination */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -top-40 -left-40 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/10 rounded-full blur-3xl" 
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -bottom-40 -right-40 w-72 sm:w-96 h-72 sm:h-96 bg-teal-500/10 rounded-full blur-3xl" 
      />

      <div className="w-full max-w-md sm:max-w-lg lg:max-w-6xl grid lg:grid-cols-12 gap-6 lg:gap-12 items-center relative z-10 mx-auto">
        {/* Left Column: Mobile-First Clinical Gateway & Authentication Form */}
        <div className="w-full lg:col-span-7 xl:col-span-6">
          <Card className="border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 shadow-xl sm:shadow-2xl shadow-slate-900/5 backdrop-blur-xl rounded-2xl sm:rounded-3xl overflow-hidden">
            {/* Clinical Brand Header - Compact on mobile, expansive on desktop */}
            <header className="px-4 sm:px-8 pt-5 sm:pt-8 pb-3 sm:pb-4 text-center border-b border-slate-100 dark:border-slate-800/70">
              <div className="mx-auto w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 mb-2 sm:mb-3.5 ring-3 sm:ring-4 ring-emerald-50 dark:ring-emerald-950/40">
                <Stethoscope className="h-5 w-5 sm:h-7 sm:w-7 text-white stroke-[2.2]" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-600 dark:text-slate-300 uppercase mb-1.5 sm:mb-2">
                Clinical Health Platform
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                AFIA Health Assistant
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-normal">
                Authorized clinical portal for healthcare practitioners and partner clinical facilities
              </p>
            </header>

            <CardContent className="px-3.5 py-4 sm:px-8 sm:py-7">
              {view === 'login' ? (
                <LoginForm 
                  onSuccess={handleLoginSuccess} 
                  onForgotPassword={() => setView('forgot_password')} 
                />
              ) : (
                <ForgotPasswordForm 
                  onSuccess={() => setView('login')} 
                  onBackToLogin={() => setView('login')} 
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Institutional Platform Showcase (Tablet/Desktop) */}
        <div className="hidden lg:flex lg:col-span-5 xl:col-span-6 flex-col space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold tracking-wide">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>GHS Standard Treatment Guidelines (STG) Compliant</span>
            </div>
            
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.2]">
              Resilient Clinical Intelligence for Primary Healthcare
            </h2>
            
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Engineered for health centres, CHPS compounds, and district hospitals. AFIA delivers zero-latency offline clinical records, real-time guideline triage reasoning, and cryptographic patient data protection.
            </p>
          </div>

          {/* Key Clinical Capabilities */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 shadow-xs backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center flex-shrink-0 text-emerald-700 dark:text-emerald-400">
                <Activity className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                  Standard Treatment Guidelines (STG) RAG Engine
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Context-aware retrieval for Ghana Health Service protocols, ensuring evidence-based diagnosis and prescription safety.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 shadow-xs backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200/60 dark:border-teal-800/60 flex items-center justify-center flex-shrink-0 text-teal-700 dark:text-teal-400">
                <WifiOff className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                  Zero-Connectivity Offline Synchronization
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Full clinical encounter workflows and patient folder creation function continuously offline with automatic delta sync.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 shadow-xs backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 text-slate-700 dark:text-slate-300">
                <Lock className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                  Field-Level AES-256 Encryption &amp; Audit Trail
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Patient Identifiable Information (PII) is encrypted at rest, backed by tamper-evident device-fingerprinted audit logs.
                </p>
              </div>
            </div>
          </div>

          {/* System Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800 text-center">
            <div className="p-2 rounded-lg bg-slate-100/60 dark:bg-slate-900/40">
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">100% Offline</div>
              <div className="text-[10px] text-slate-400">Local-First Engine</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-100/60 dark:bg-slate-900/40">
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">GHS Verified</div>
              <div className="text-[10px] text-slate-400">Clinical Protocols</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-100/60 dark:bg-slate-900/40">
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">AES-256</div>
              <div className="text-[10px] text-slate-400">Field Encrypted</div>
            </div>
          </div>

          {/* Legal / Institutional Compliance Notice */}
          <div className="p-3 rounded-lg bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
              <strong>Official Clinical Portal:</strong> For authorized healthcare personnel only. Uncertified access attempts are cryptographically recorded in accordance with national health data protection regulations.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
