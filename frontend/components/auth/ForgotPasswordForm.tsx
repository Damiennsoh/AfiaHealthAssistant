"use client"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, ShieldAlert } from "lucide-react"

interface ForgotPasswordFormProps {
  onSuccess?: () => void
  onBackToLogin?: () => void
  onForgotPassword?: () => void
}

export default function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
        <ShieldAlert className="h-8 w-8 text-orange-600" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-slate-800 mb-2">
          Account Recovery
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          For security reasons and data protection, self-service password recovery is disabled.
        </p>
        
        <Alert className="bg-slate-50 border-slate-200 mt-4 text-left">
          <AlertDescription className="text-slate-700">
            Please contact your <strong>Clinic Administrator</strong>. They can securely reset your password from the System Settings panel.
          </AlertDescription>
        </Alert>
      </div>

      <div className="space-y-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBackToLogin}
          className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-11"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
      </div>
    </div>
  )
}
