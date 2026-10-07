"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Loader2, 
  LogIn, 
  Key, 
  Mail, 
  Eye, 
  EyeOff, 
  WifiOff, 
  Search, 
  MapPin, 
  User, 
  Building, 
  Check, 
  Shield, 
  Stethoscope, 
  ArrowRight 
} from "lucide-react"
import { useAuth } from "@/contexts/AfiaAuthContext"
import { afiaAPI } from "@/lib/afia-api"

interface Clinic {
  id: string
  name: string
  code: string
  country_code: string
  region?: string
  district?: string
  is_active: boolean
  require_staff_id: boolean
  require_department: boolean
  features: Record<string, any>
}

interface LoginFormProps {
  onSuccess?: () => void
  onForgotPassword?: () => void
}

export default function LoginForm({ onSuccess, onForgotPassword }: LoginFormProps) {
  const { login } = useAuth()

  // Two-step flow state
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 state
  const [country, setCountry] = useState<'GH' | 'ZW'>('GH')
  const [searchQuery, setSearchQuery] = useState('')
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null)
  const [isLoadingClinics, setIsLoadingClinics] = useState(false)

  // Step 2 state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [staffId, setStaffId] = useState('')
  const [department, setDepartment] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  // Evaluation sandbox 1-click login state
  const [isGuestLoggingIn, setIsGuestLoggingIn] = useState(false)
  const [copiedCred, setCopiedCred] = useState<string | null>(null)

  // Load clinics when country changes (auto-select if only one)
  useEffect(() => {
    const loadClinics = async () => {
      setIsLoadingClinics(true)
      try {
        const response = await afiaAPI.listPublicClinics(country)
        if (response.error) {
          console.warn('[LoginForm] Clinic list discovery notice:', response.error)
          setClinics([])
        } else {
          const clinicsArray = Array.isArray(response) 
            ? response 
            : (response.data || [])
          setClinics(clinicsArray)
          if (clinicsArray.length === 1) {
            setSelectedClinic(clinicsArray[0])
            setStep(2)
          }
        }
      } catch (err) {
        console.warn('[LoginForm] Clinic list discovery error:', err)
        setClinics([])
      } finally {
        setIsLoadingClinics(false)
      }
    }

    loadClinics()
  }, [country])

  // Load clinics when search changes
  useEffect(() => {
    if (searchQuery) {
      const loadClinics = async () => {
        setIsLoadingClinics(true)
        try {
          const response = await afiaAPI.listPublicClinics(country, searchQuery)
          if (response.error) {
            console.warn('[LoginForm] Search clinic notice:', response.error)
            setClinics([])
          } else {
            const clinicsArray = Array.isArray(response) 
              ? response 
              : (response.data || [])
            setClinics(clinicsArray)
          }
        } catch (err) {
          console.warn('[LoginForm] Search clinic error:', err)
          setClinics([])
        } finally {
          setIsLoadingClinics(false)
        }
      }

      loadClinics()
    }
  }, [searchQuery, country])

  // Check online status
  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleClinicSelect = (clinic: Clinic) => {
    setSelectedClinic(clinic)
    setStep(2)
  }

  const handleBack = () => {
    setStep(1)
    setError(null)
  }

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedCred(label)
      setTimeout(() => setCopiedCred(null), 2000)
    }
  }

  const handleGuestLogin = async () => {
    setError(null)
    setIsLoading(true)
    setIsGuestLoggingIn(true)

    try {
      const demoEmail = 'guest@afia.health'
      const demoPw = 'Demo1234!'
      setEmail(demoEmail)
      setPassword(demoPw)
      setIsSuperAdmin(false)

      const clinicId = '64d5dd15-44c3-4d12-bf2f-5fef517c346e'

      await login(demoEmail, demoPw, clinicId, undefined, undefined, 'clinic_admin')
      onSuccess?.()
    } catch (err) {
      console.error('[LoginForm] Guest login error:', err)
      setError(err instanceof Error ? err.message : 'Guest authentication failed. Please verify network connectivity and retry.')
    } finally {
      setIsLoading(false)
      setIsGuestLoggingIn(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const isGuest = email.trim().toLowerCase() === 'guest@afia.health';

    if (!isSuperAdmin && !selectedClinic && !isGuest) {
      setError('Please select an authorized healthcare facility first.')
      setIsLoading(false)
      return
    }

    try {
      const targetClinicId = isSuperAdmin ? undefined : (selectedClinic?.id || (isGuest ? '64d5dd15-44c3-4d12-bf2f-5fef517c346e' : undefined))
      await login(
        email, 
        password, 
        targetClinicId, 
        isSuperAdmin ? undefined : (selectedClinic?.require_staff_id ? staffId : undefined), 
        isSuperAdmin ? undefined : (selectedClinic?.require_department ? department : undefined),
        isSuperAdmin ? 'super_admin' : (isGuest ? 'clinic_admin' : undefined)
      )
      onSuccess?.()
    } catch (err) {
      console.error('[LoginForm] Login error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed. Please verify your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5 min-w-0 overflow-x-hidden">
      {/* Clinical Sandbox & Evaluation Access - Mobile Optimized */}
      <section 
        aria-label="Evaluation Access"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/60 dark:from-slate-900 dark:to-slate-900/70 p-3 sm:p-4 shadow-sm min-w-0 overflow-x-hidden ring-1 ring-inset ring-slate-900/[0.02] dark:ring-white/[0.03]"
      >
        <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block flex-shrink-0 ring-2 ring-emerald-500/20"></span>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 truncate">
              Evaluation Sandbox
            </h2>
          </div>
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 flex-shrink-0 whitespace-nowrap shadow-xs">
            Isolated Local DB
          </span>
        </div>

        <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2.5 leading-snug break-words">
          Test clinical triage, encounters, and STG guidelines with 1-click guest access in an isolated local database:
        </p>

        {/* 1-Click Guest Clinician Button */}
        <Button
          type="button"
          variant="default"
          disabled={isLoading}
          onClick={handleGuestLogin}
          className="w-full h-auto min-h-[52px] sm:min-h-[56px] py-2.5 px-3.5 border border-emerald-700/40 dark:border-emerald-400/30 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-650 active:from-emerald-700 active:to-emerald-800 text-white shadow-md shadow-emerald-600/20 dark:shadow-emerald-500/10 active:scale-[0.99] ring-1 ring-inset ring-white/10 hover:shadow-lg hover:shadow-emerald-600/25 transition-all group"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-white/15 dark:bg-emerald-900/40 text-white border border-white/20 dark:border-emerald-400/20 flex-shrink-0 backdrop-blur-sm">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div className="text-left min-w-0 flex-1">
              <div className="font-semibold text-xs text-white flex items-center gap-1.5 min-w-0">
                <span className="truncate">Guest Clinician Access</span>
                <span className="text-[9px] font-normal text-emerald-50 bg-emerald-500/30 dark:bg-emerald-400/20 px-1.5 py-0.5 rounded border border-white/20 dark:border-emerald-300/20 flex-shrink-0">
                  1-Click
                </span>
              </div>
              <div className="text-[10px] text-emerald-50/90 dark:text-emerald-100/80 font-normal truncate">
                Patient Records, SOAP Notes &amp; GHS STG Triage
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-white flex-shrink-0 pl-2">
            {isGuestLoggingIn ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="text-xs font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Launch <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </Button>

        {/* Credentials Pill / Auto-fill hints */}
        <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-1 text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0 w-full sm:w-auto">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] font-semibold flex-shrink-0">Credentials:</span>
            <button
              type="button"
              onClick={() => copyToClipboard('guest@afia.health | Demo1234!', 'guest')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500/70 active:bg-slate-100 text-slate-700 dark:text-slate-300 font-mono text-[9px] sm:text-[10px] min-w-0 flex-1 sm:flex-none overflow-hidden shadow-xs transition-colors"
              title="Click to copy evaluation credentials"
            >
              <span className="truncate">guest@afia.health</span>
              <span className="text-slate-300 dark:text-slate-600 flex-shrink-0">/</span>
              <span className="flex-shrink-0 font-semibold text-slate-800 dark:text-slate-200">Demo1234!</span>
              {copiedCred === 'guest' ? <Check className="h-2.5 w-2.5 text-emerald-600 flex-shrink-0" /> : null}
            </button>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 flex-shrink-0 self-start sm:self-auto whitespace-nowrap inline-flex items-center gap-1 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0"></span>
            Cloud Sync Paused
          </span>
        </div>
      </section>

      <div className="relative flex py-0.5 items-center">
        <div className="flex-grow border-t border-emerald-100 dark:border-emerald-900/30"></div>
        <span className="flex-shrink mx-2.5 sm:mx-3 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-700/80 dark:text-emerald-400/80 text-center inline-flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
          Facility Sign In
          <span className="h-1 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
        </span>
        <div className="flex-grow border-t border-emerald-100 dark:border-emerald-900/30"></div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="bg-gradient-to-br from-red-50 via-white to-red-50 dark:from-red-950/40 dark:via-slate-900 dark:to-red-950/30 border border-red-200/80 dark:border-red-900/50 text-red-800 dark:text-red-300 animate-in fade-in py-2.5 sm:py-3 px-3 sm:px-3.5 rounded-xl shadow-sm ring-1 ring-red-500/5 dark:ring-red-500/10">
          <AlertDescription className="font-semibold text-xs sm:text-[13px] leading-normal">{error}</AlertDescription>
        </Alert>
      )}

      {/* Offline Warning */}
      {isOffline && (
        <Alert className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/60 dark:from-amber-950/40 dark:via-slate-900/80 dark:to-orange-950/30 border border-amber-200/80 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 py-2.5 sm:py-3 px-3 sm:px-3.5 rounded-xl shadow-sm ring-1 ring-amber-500/5 dark:ring-amber-500/10">
          <WifiOff className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400 stroke-[2]" />
          <AlertDescription className="text-xs sm:text-[13px] leading-normal font-semibold">
            Operating offline. You can authenticate using cached credentials on this device.
          </AlertDescription>
        </Alert>
      )}

      {step === 1 ? (
        // Step 1: Country and Clinic Selection
        <div className="space-y-3 sm:space-y-4 min-w-0 overflow-x-hidden">
          <label 
            htmlFor="superAdmin" 
            className="flex items-start sm:items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/80 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 active:bg-slate-50 dark:active:bg-slate-800/80 select-none min-h-[44px] min-w-0 overflow-x-hidden shadow-sm ring-1 ring-inset ring-slate-900/[0.02] dark:ring-white/[0.03] transition-colors"
          >
            <input
              type="checkbox"
              id="superAdmin"
              checked={isSuperAdmin}
              onChange={(e) => {
                setIsSuperAdmin(e.target.checked)
                if (e.target.checked) {
                  setStep(2)
                } else {
                  setStep(1)
                }
              }}
              disabled={isLoading}
              className="h-4 w-4 mt-0.5 sm:mt-0 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight break-words block">
                Global Administrator Login (Skip Facility Selection)
              </span>
              {isSuperAdmin && (
                <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Privileged sign-in mode enabled
                </span>
              )}
            </div>
            <Shield className={`h-4 w-4 mt-0.5 sm:mt-0 flex-shrink-0 transition-colors ${isSuperAdmin ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
          </label>

          {!isSuperAdmin && (
            <>
              <div className="space-y-1">
                <Label htmlFor="country" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  Jurisdiction / Country
                </Label>
                <Select value={country} onValueChange={(val: 'GH' | 'ZW') => setCountry(val)}>
                  <SelectTrigger className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-base sm:text-xs h-11 sm:h-9">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GH" className="text-xs py-2">Republic of Ghana (GHS)</SelectItem>
                    <SelectItem value="ZW" className="text-xs py-2">Republic of Zimbabwe (EDLIZ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="search" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-emerald-600" />
                  Search Healthcare Facility
                </Label>
                <Input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clinic name or code..."
                  disabled={isLoadingClinics}
                  className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-base sm:text-xs h-11 sm:h-9"
                />
              </div>

              <div className="max-h-52 sm:max-h-60 overflow-y-auto overscroll-contain space-y-1.5 sm:space-y-2 border border-emerald-100/80 dark:border-emerald-900/30 rounded-xl p-1.5 sm:p-2 bg-gradient-to-b from-emerald-50/30 to-white dark:from-emerald-950/20 dark:to-slate-900 shadow-inner">
                {isLoadingClinics ? (
                  <div className="flex items-center justify-center p-4 sm:p-5">
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/50 mr-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Querying registered facilities...</span>
                  </div>
                ) : (clinics || []).length === 0 ? (
                  <div className="text-center py-6 sm:py-7 px-3 sm:px-4 bg-gradient-to-b from-white via-slate-50/50 to-white dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 space-y-3 shadow-sm">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-xl flex items-center justify-center mx-auto text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700">
                      <Building className="h-5 w-5 sm:h-5.5 sm:w-5.5 stroke-[2]" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs sm:text-[13px] font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">
                        {searchQuery ? "No matching facilities found" : "No Registered Facilities Found"}
                      </p>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed font-medium">
                        {searchQuery
                          ? "Check spelling or search by facility code."
                          : "Global administrators can sign in below to onboard partnered facilities and provision staff credentials."}
                      </p>
                    </div>
                    {!searchQuery && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setIsSuperAdmin(true)
                          setStep(2)
                        }}
                        className="text-xs border border-emerald-700/30 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-650 text-white gap-1.5 font-bold shadow-md shadow-emerald-600/15 hover:shadow-lg hover:shadow-emerald-600/25 ring-1 ring-inset ring-white/10 h-10 sm:h-9 px-4 sm:px-3 rounded-lg mt-1"
                      >
                        <Shield className="h-3.5 w-3.5 stroke-[2]" />
                        Log in as Global Admin
                      </Button>
                    )}
                  </div>
                ) : (
                  (clinics || []).map((clinic) => (
                    <button
                      key={clinic.id}
                      type="button"
                      onClick={() => handleClinicSelect(clinic)}
                      className="w-full text-left p-3 sm:p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-800/80 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:from-emerald-50/70 hover:to-teal-50/50 dark:hover:from-emerald-950/40 dark:hover:to-teal-950/30 active:scale-[0.99] active:shadow-inner transition-all min-h-[52px] sm:min-h-[56px] shadow-sm hover:shadow-md group ring-1 ring-slate-900/[0.02] dark:ring-white/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white truncate group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors">{clinic.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px] sm:text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                              {clinic.code}
                            </span>
                            {!clinic.is_active && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-900/50 text-[9px] font-bold text-amber-700 dark:text-amber-400">
                                Suspended
                              </span>
                            )}
                          </div>
                          {(clinic.region || clinic.district) && (
                            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate font-medium">
                              <MapPin className="h-3 w-3 flex-shrink-0 text-emerald-600 dark:text-emerald-500" />
                              <span className="truncate">{clinic.region}{clinic.district ? ` • ${clinic.district}` : ''}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60 group-hover:scale-110 transition-all shadow-sm">
                            <Building className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2]" />
                          </div>
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            Select
                            <ArrowRight className="h-2.5 w-2.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        // Step 2: User Authentication
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 min-w-0 overflow-x-hidden">
          {!isSuperAdmin && selectedClinic && (
            <div className="p-3 sm:p-3.5 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/30 border border-emerald-200/70 dark:border-emerald-800/50 rounded-xl flex items-center justify-between gap-2.5 shadow-sm ring-1 ring-emerald-500/5 dark:ring-emerald-500/10">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/70 dark:to-teal-950/70 border border-emerald-200/70 dark:border-emerald-800/50 flex-shrink-0 shadow-sm">
                  <Building className="h-4 w-4 text-emerald-700 dark:text-emerald-400 stroke-[2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white truncate">{selectedClinic.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/50 text-[9px] sm:text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {selectedClinic.code}
                    </span>
                    {(selectedClinic.region || selectedClinic.district) && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate font-medium">
                        <MapPin className="h-2.5 w-2.5 flex-shrink-0 text-emerald-600 dark:text-emerald-500" />
                        <span className="truncate">{selectedClinic.region}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleBack}
                className="text-xs h-10 sm:h-9 px-3.5 sm:px-3 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0 whitespace-nowrap border-slate-300 dark:border-slate-700 shadow-sm font-bold rounded-lg"
              >
                Change
              </Button>
            </div>
          )}

          {isSuperAdmin && (
            <div className="p-3 sm:p-3.5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-emerald-50 dark:via-white dark:to-teal-50 border border-slate-700 dark:border-emerald-200/80 rounded-xl flex items-start justify-between gap-2.5 text-white dark:text-slate-900 shadow-md ring-1 ring-white/5 dark:ring-emerald-500/10">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 dark:from-emerald-100 dark:to-teal-100 border border-emerald-400/30 dark:border-emerald-200/70 flex-shrink-0 shadow-sm">
                  <Shield className="h-4 w-4 text-emerald-400 dark:text-emerald-700 stroke-[2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs sm:text-[13px] text-white dark:text-slate-900 truncate">Global Administrator Portal</div>
                  <div className="text-[10px] sm:text-[11px] text-slate-300 dark:text-slate-600 leading-snug break-words font-medium mt-0.5">
                    Facility selection bypassed. All actions are cryptographically signed and logged in the tamper-evident audit trail.
                  </div>
                </div>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleBack}
                className="text-xs h-10 sm:h-9 px-3.5 sm:px-3 text-slate-200 dark:text-slate-700 hover:text-white dark:hover:text-slate-900 hover:bg-white/10 dark:hover:bg-slate-900/10 border-slate-600 dark:border-slate-300 flex-shrink-0 whitespace-nowrap font-bold shadow-sm bg-white/5 dark:bg-transparent rounded-lg"
              >
                Switch
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/50">
                <Mail className="h-3 w-3 text-emerald-700 dark:text-emerald-400 stroke-[2]" />
              </span>
              {isSuperAdmin ? 'Administrator Email Address' : 'Staff Email Address'}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isSuperAdmin ? 'superadmin@afia.health' : 'clinician@facility.org'}
              required
              autoComplete="email"
              disabled={isLoading}
              className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 text-base sm:text-xs h-11 sm:h-10 rounded-lg shadow-sm transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="password" className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/50">
                  <Key className="h-3 w-3 text-emerald-700 dark:text-emerald-400 stroke-[2]" />
                </span>
                Password
              </Label>
              {onForgotPassword && (
                <button 
                  type="button" 
                  onClick={onForgotPassword}
                  className="text-[11px] text-emerald-700 dark:text-emerald-500 hover:text-emerald-800 dark:hover:text-emerald-400 font-bold py-1 px-2 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors inline-flex items-center gap-1 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter facility password"
                required
                autoComplete="current-password"
                disabled={isLoading}
                className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 text-base sm:text-xs h-11 sm:h-10 pr-12 rounded-lg shadow-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4 stroke-[2]" /> : <Eye className="h-4 w-4 stroke-[2]" />}
              </button>
            </div>
          </div>

          {!isSuperAdmin && selectedClinic?.require_staff_id && (
            <div className="space-y-1.5">
              <Label htmlFor="staffId" className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/50">
                  <User className="h-3 w-3 text-emerald-700 dark:text-emerald-400 stroke-[2]" />
                </span>
                Staff Registration ID
              </Label>
              <Input
                id="staffId"
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="e.g. GHS-MED-4421"
                required
                disabled={isLoading}
                className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 text-base sm:text-xs h-11 sm:h-10 rounded-lg shadow-sm transition-all"
              />
            </div>
          )}

          {!isSuperAdmin && selectedClinic?.require_department && (
            <div className="space-y-1.5">
              <Label htmlFor="department" className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/50">
                  <Building className="h-3 w-3 text-emerald-700 dark:text-emerald-400 stroke-[2]" />
                </span>
                Department / Ward
              </Label>
              <Input
                id="department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. OPD / Maternity"
                required
                disabled={isLoading}
                className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 text-base sm:text-xs h-11 sm:h-10 rounded-lg shadow-sm transition-all"
              />
            </div>
          )}

          <label 
            htmlFor="remember" 
            className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg cursor-pointer select-none min-h-[40px] hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
          >
            <div className="relative flex items-center">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
                className="peer h-[18px] w-[18px] text-emerald-600 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                Remember this clinical workstation
              </span>
              <span className="block text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Secure credential caching on this trusted device
              </span>
            </div>
          </label>

          <div className="pt-1">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-b from-emerald-600 via-emerald-600 to-emerald-700 hover:from-emerald-500 hover:via-emerald-500 hover:to-emerald-650 active:from-emerald-700 active:via-emerald-700 active:to-emerald-800 text-white font-bold rounded-xl min-h-[52px] sm:h-12 shadow-lg shadow-emerald-600/20 dark:shadow-emerald-600/15 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-[0.99] active:shadow-inner ring-1 ring-inset ring-white/15 transition-all flex items-center justify-center text-sm sm:text-[15px] border border-emerald-700/50 dark:border-emerald-400/30 tracking-wide py-3.5 sm:py-3 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2.5 h-[18px] w-[18px] animate-spin" />
                  <span className="tracking-normal">Authenticating...</span>
                </>
              ) : (
                <>
                  <div className="p-1.5 rounded-lg bg-white/15 border border-white/20 mr-2.5 backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                    <LogIn className="h-4 w-4 stroke-[2]" />
                  </div>
                  <span className="tracking-wide">Sign In to Clinical Portal</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      <footer className="text-center pt-2.5 sm:pt-3 mt-1 border-t border-emerald-100/80 dark:border-emerald-900/30">
        <div className="inline-flex items-center gap-1.5 mb-1">
          <Shield className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
            Secured Clinical Portal
          </span>
        </div>
        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
          Authorized healthcare personnel only. Contact your facility administrator for credential provisioning.
        </p>
      </footer>
    </div>
  )
}
