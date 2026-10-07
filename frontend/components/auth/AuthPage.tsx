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
    <main className="min-h-[100dvh] w-full bg-gradient-to-br from-emerald-50 via-teal-50/50 to-slate-50 dark:from-emerald-950/40 dark:via-slate-950 dark:to-teal-950/30 flex flex-col justify-center items-center py-4 px-3 sm:px-6 lg:py-10 lg:px-8 relative overflow-x-hidden">
      {/* Ambient clinical illumination gradients */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -top-40 -left-40 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/15 dark:bg-emerald-500/20 rounded-full blur-3xl" 
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -bottom-40 -right-40 w-72 sm:w-96 h-72 sm:h-96 bg-teal-500/15 dark:bg-teal-500/20 rounded-full blur-3xl" 
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute top-1/3 right-1/4 w-64 sm:w-80 h-64 sm:h-80 bg-cyan-400/5 dark:bg-cyan-500/10 rounded-full blur-3xl" 
      />

      <div className="w-full max-w-md sm:max-w-lg lg:max-w-6xl grid lg:grid-cols-12 gap-6 lg:gap-12 items-center relative z-10 mx-auto overflow-x-hidden">
        {/* Left Column: Mobile-First Clinical Gateway & Authentication Form */}
        <div className="w-full lg:col-span-7 xl:col-span-6 min-w-0">
          <Card className="border border-emerald-100/80 dark:border-emerald-900/40 bg-white/98 dark:bg-slate-900/98 shadow-xl sm:shadow-2xl shadow-emerald-900/10 dark:shadow-emerald-950/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl overflow-hidden ring-1 ring-emerald-500/5 dark:ring-emerald-500/10">
            {/* Clinical Brand Header - Compact on mobile, expansive on desktop */}
            <header className="px-4 sm:px-8 pt-5 sm:pt-8 pb-3 sm:pb-4 text-center border-b border-emerald-50 dark:border-emerald-900/30 min-w-0 overflow-x-hidden bg-gradient-to-b from-emerald-50/50 via-white to-transparent dark:from-emerald-950/30 dark:via-slate-900 dark:to-transparent">
              <div className="mx-auto w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 dark:shadow-emerald-500/20 mb-2 sm:mb-3.5 ring-3 sm:ring-4 ring-emerald-100 dark:ring-emerald-900/60">
                <Stethoscope className="h-5 w-5 sm:h-7 sm:w-7 text-white stroke-[2.2]" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-950/70 dark:to-teal-950/70 border border-emerald-200/70 dark:border-emerald-800/50 text-[9px] sm:text-[10px] font-bold tracking-wider text-emerald-800 dark:text-emerald-300 uppercase mb-1.5 sm:mb-2 max-w-full overflow-hidden shadow-sm">
                <ShieldCheck className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="truncate">Clinical Health Platform</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-emerald-900 to-slate-900 dark:from-white dark:via-emerald-200 dark:to-white bg-clip-text text-transparent break-words">
                AFIA Health Assistant
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-[92%] sm:max-w-sm mx-auto leading-snug break-words font-medium">
                Authorized clinical portal for healthcare practitioners and partner clinical facilities
              </p>
            </header>

            <CardContent className="px-3.5 py-4 sm:px-8 sm:py-7 overflow-x-hidden min-w-0">
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
          <div className="space-y-3.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/15 dark:to-teal-500/15 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold tracking-wide shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>GHS Standard Treatment Guidelines (STG) Compliant</span>
            </div>
            
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 dark:from-white dark:via-emerald-200 dark:to-teal-200 bg-clip-text text-transparent leading-[1.15]">
              Resilient Clinical Intelligence for Primary Healthcare
            </h2>
            
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              Engineered for health centres, CHPS compounds, and district hospitals. AFIA delivers zero-latency offline clinical records, real-time guideline triage reasoning, and cryptographic patient data protection.
            </p>
          </div>

          {/* Key Clinical Capabilities */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-emerald-100/80 dark:border-emerald-900/30 shadow-sm backdrop-blur-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-all">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/70 dark:to-teal-950/70 border border-emerald-200/70 dark:border-emerald-800/50 flex items-center justify-center flex-shrink-0 text-emerald-700 dark:text-emerald-400 shadow-sm">
                <Activity className="h-4 w-4 stroke-[2]" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                  Standard Treatment Guidelines (STG) RAG Engine
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
                  Context-aware retrieval for Ghana Health Service protocols, ensuring evidence-based diagnosis and prescription safety.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-teal-100/80 dark:border-teal-900/30 shadow-sm backdrop-blur-sm hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800/50 transition-all">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-950/70 dark:to-cyan-950/70 border border-teal-200/70 dark:border-teal-800/50 flex items-center justify-center flex-shrink-0 text-teal-700 dark:text-teal-400 shadow-sm">
                <WifiOff className="h-4 w-4 stroke-[2]" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                  Zero-Connectivity Offline Synchronization
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
                  Full clinical encounter workflows and patient folder creation function continuously offline with automatic delta sync.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-sm backdrop-blur-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 text-slate-700 dark:text-slate-300 shadow-sm">
                <Lock className="h-4 w-4 stroke-[2]" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                  Field-Level AES-256 Encryption &amp; Audit Trail
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
                  Patient Identifiable Information (PII) is encrypted at rest, backed by tamper-evident device-fingerprinted audit logs.
                </p>
              </div>
            </div>
          </div>

          {/* System Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-100/80 dark:border-emerald-900/30 text-center">
            <div className="p-2.5 rounded-lg bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/40 dark:to-slate-900/40 border border-emerald-100/80 dark:border-emerald-900/30 shadow-sm">
              <div className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300">100% Offline</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Local-First Engine</div>
            </div>
            <div className="p-2.5 rounded-lg bg-gradient-to-b from-teal-50/80 to-white dark:from-teal-950/40 dark:to-slate-900/40 border border-teal-100/80 dark:border-teal-900/30 shadow-sm">
              <div className="text-[11px] font-extrabold text-teal-800 dark:text-teal-300">GHS Verified</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Clinical Protocols</div>
            </div>
            <div className="p-2.5 rounded-lg bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-800/40 dark:to-slate-900/40 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200">AES-256</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Field Encrypted</div>
            </div>
          </div>

          {/* Legal / Institutional Compliance Notice */}
          <div className="p-3.5 rounded-lg bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/60 dark:from-emerald-950/30 dark:via-slate-900/70 dark:to-teal-950/30 border border-emerald-100/80 dark:border-emerald-900/30 shadow-sm">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed text-center font-medium">
              <strong className="text-emerald-800 dark:text-emerald-400">Official Clinical Portal:</strong> For authorized healthcare personnel only. Uncertified access attempts are cryptographically recorded in accordance with national health data protection regulations.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
