"use client"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, ShieldAlert, Building2, Lock, ArrowRight } from "lucide-react"

interface ForgotPasswordFormProps {
  onSuccess?: () => void
  onBackToLogin?: () => void
  onForgotPassword?: () => void
}

export default function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  return (
    <div className="space-y-5 sm:space-y-6 text-center min-w-0 overflow-x-hidden">
      {/* Icon Header */}
      <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-100 via-orange-50 to-amber-100 dark:from-amber-950/60 dark:via-orange-950/40 dark:to-amber-950/60 flex items-center justify-center border-2 border-amber-200/70 dark:border-amber-800/40 shadow-lg shadow-amber-500/10 ring-4 ring-amber-50 dark:ring-amber-950/40">
        <ShieldAlert className="h-8 w-8 sm:h-10 sm:w-10 text-amber-600 dark:text-amber-400 stroke-[2]" />
      </div>

      {/* Title Section */}
      <div className="space-y-2.5">
        <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-amber-800 to-slate-900 dark:from-white dark:via-amber-200 dark:to-white bg-clip-text text-transparent">
          Account Recovery
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium max-w-sm mx-auto">
          For security reasons and patient data protection regulations, self-service password recovery is disabled on this clinical portal.
        </p>
      </div>

      {/* Security Alert */}
      <Alert className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/80 dark:from-amber-950/40 dark:via-slate-900/80 dark:to-orange-950/40 border border-amber-200/70 dark:border-amber-900/40 text-left rounded-xl shadow-sm ring-1 ring-amber-500/5 dark:ring-amber-500/10">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/40 flex-shrink-0 mt-0.5">
            <Lock className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 stroke-[2]" />
          </div>
          <AlertDescription className="text-slate-700 dark:text-slate-300 text-xs sm:text-[13px] leading-relaxed font-medium">
            Please contact your <strong className="text-amber-800 dark:text-amber-300 font-extrabold">Clinic Administrator</strong> or <strong className="text-amber-800 dark:text-amber-300 font-extrabold">IT Department</strong>. They can securely reset your password from the System Settings panel after verifying your identity per facility protocol.
          </AlertDescription>
        </div>
      </Alert>

      {/* Alternative Contact Steps */}
      <div className="space-y-2 p-3 sm:p-3.5 rounded-xl bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-sm">
        <h4 className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 text-left">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Facility Protocol
          </span>
        </h4>
        <ol className="space-y-1.5 text-left">
          <li className="flex items-start gap-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-[9px] font-extrabold flex items-center justify-center mt-0.5">1</span>
            <span>Contact clinic administration or head of department in person</span>
          </li>
          <li className="flex items-start gap-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-[9px] font-extrabold flex items-center justify-center mt-0.5">2</span>
            <span>Present valid staff identification for verification</span>
          </li>
          <li className="flex items-start gap-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-[9px] font-extrabold flex items-center justify-center mt-0.5">3</span>
            <span>Admin issues a temporary secure password via settings panel</span>
          </li>
        </ol>
      </div>

      {/* Back Button */}
      <div className="space-y-2.5 pt-1">
        <Button
          type="button"
          variant="default"
          onClick={onBackToLogin}
          className="w-full h-12 sm:h-11 bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-850 active:from-slate-900 active:to-slate-950 text-white font-bold rounded-xl shadow-lg shadow-slate-900/15 dark:shadow-slate-950/40 hover:shadow-xl hover:shadow-slate-900/20 active:scale-[0.99] ring-1 ring-inset ring-white/10 transition-all flex items-center justify-center text-xs sm:text-sm border border-slate-700/40 dark:border-slate-600/30 group"
        >
          <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Return to Clinical Sign In
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onBackToLogin}
          className="w-full h-10 sm:h-9 border-emerald-200/80 dark:border-emerald-800/50 bg-white dark:bg-slate-900/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-700 font-semibold shadow-xs transition-all flex items-center justify-center text-xs"
        >
          <span className="mr-1.5">Quick login</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
