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
    <div className="space-y-4 sm:space-y-5">
      {/* Clinical Sandbox & Evaluation Access - Mobile Optimized */}
      <section 
        aria-label="Evaluation Access"
        className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3 sm:p-4 shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block flex-shrink-0"></span>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
              Evaluation Sandbox
            </h2>
          </div>
          <span className="text-[9px] sm:text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800 flex-shrink-0 whitespace-nowrap">
            Isolated Local DB
          </span>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5 leading-snug break-words">
          Test clinical triage, encounters, and STG guidelines with 1-click guest access in an isolated local database:
        </p>

        {/* 1-Click Guest Clinician Button */}
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={handleGuestLogin}
          className="w-full h-auto min-h-[52px] sm:min-h-[56px] py-2 px-3 border-emerald-200/80 dark:border-emerald-800/80 bg-white dark:bg-slate-800/90 hover:bg-emerald-50/70 dark:hover:bg-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 active:scale-[0.99] text-slate-800 dark:text-slate-200 flex items-center justify-between shadow-xs transition-all group"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex-shrink-0">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div className="text-left min-w-0 flex-1">
              <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 min-w-0">
                <span className="truncate">Guest Clinician Access</span>
                <span className="text-[9px] font-normal text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50 flex-shrink-0">
                  1-Click
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate">
                Patient Records, SOAP Notes &amp; GHS STG Triage
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 flex-shrink-0 pl-2">
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
        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-1 text-[10px] sm:text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0 w-full sm:w-auto">
            <span className="text-slate-400 text-[10px] flex-shrink-0">Credentials:</span>
            <button
              type="button"
              onClick={() => copyToClipboard('guest@afia.health | Demo1234!', 'guest')}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 active:bg-slate-50 text-slate-700 dark:text-slate-300 font-mono text-[9px] sm:text-[10px] min-w-0 flex-1 sm:flex-none overflow-hidden"
              title="Click to copy evaluation credentials"
            >
              <span className="truncate">guest@afia.health</span>
              <span className="text-slate-300 flex-shrink-0">/</span>
              <span className="flex-shrink-0">Demo1234!</span>
              {copiedCred === 'guest' ? <Check className="h-2.5 w-2.5 text-emerald-600 flex-shrink-0" /> : null}
            </button>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 flex-shrink-0 self-start sm:self-auto whitespace-nowrap">
            Cloud Sync Paused
          </span>
        </div>
      </section>

      <div className="relative flex py-0.5 items-center">
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        <span className="flex-shrink mx-2.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">
          Or Sign In with Facility Credentials
        </span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 animate-in fade-in py-2.5 px-3">
          <AlertDescription className="font-medium text-xs leading-normal">{error}</AlertDescription>
        </Alert>
      )}

      {/* Offline Warning */}
      {isOffline && (
        <Alert variant="destructive" className="bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 py-2.5 px-3">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="text-xs leading-normal">
            Operating offline. You can authenticate using cached credentials on this device.
          </AlertDescription>
        </Alert>
      )}

      {step === 1 ? (
        // Step 1: Country and Clinic Selection
        <div className="space-y-3 sm:space-y-4">
          <label 
            htmlFor="superAdmin" 
            className="flex items-start sm:items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 cursor-pointer active:bg-slate-100 dark:active:bg-slate-800/80 select-none min-h-[44px]"
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
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-tight">
              Global Administrator Login (Skip Facility Selection)
            </span>
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

              <div className="max-h-52 sm:max-h-60 overflow-y-auto overscroll-contain space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 sm:p-2 bg-slate-50/40 dark:bg-slate-900/30">
                {isLoadingClinics ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    <span className="ml-2 text-xs text-slate-500">Querying registered facilities...</span>
                  </div>
                ) : (clinics || []).length === 0 ? (
                  <div className="text-center py-5 px-3 bg-white/70 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mx-auto text-slate-400">
                      <Building className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {searchQuery ? "No matching facilities found" : "No Registered Facilities Found (0 Clinics)"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-normal">
                        {searchQuery
                          ? "Check spelling or search by facility code."
                          : "Global administrators can sign in below to onboard partnered facilities and provision staff credentials."}
                      </p>
                    </div>
                    {!searchQuery && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsSuperAdmin(true)
                          setStep(2)
                        }}
                        className="text-xs border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 font-medium shadow-xs h-9 min-h-[36px]"
                      >
                        <Shield className="h-3.5 w-3.5 text-emerald-600" />
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
                      className="w-full text-left p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700 active:bg-emerald-50 dark:active:bg-slate-800 transition-all min-h-[48px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">{clinic.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{clinic.code}</div>
                          {(clinic.region || clinic.district) && (
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                              {clinic.region} {clinic.district ? `• ${clinic.district}` : ''}
                            </div>
                          )}
                        </div>
                        <Building className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
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
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {selectedClinic && (
            <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Building className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">{selectedClinic.name}</div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">{selectedClinic.code}</div>
                </div>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={handleBack}
                className="text-xs h-8 px-2 text-slate-600 hover:text-slate-900 flex-shrink-0 whitespace-nowrap"
              >
                Change
              </Button>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-emerald-600" />
              Staff Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="clinician@facility.org"
              required
              autoComplete="email"
              disabled={isLoading}
              className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-base sm:text-xs h-11 sm:h-9"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-emerald-600" />
                Password
              </Label>
              {onForgotPassword && (
                <button 
                  type="button" 
                  onClick={onForgotPassword}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium py-1"
                >
                  Forgot?
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
                className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-base sm:text-xs h-11 sm:h-9 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-0 h-11 sm:h-9 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 active:text-slate-800"
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {selectedClinic?.require_staff_id && (
            <div className="space-y-1">
              <Label htmlFor="staffId" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-emerald-600" />
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
                className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-base sm:text-xs h-11 sm:h-9"
              />
            </div>
          )}

          {selectedClinic?.require_department && (
            <div className="space-y-1">
              <Label htmlFor="department" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-emerald-600" />
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
                className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-base sm:text-xs h-11 sm:h-9"
              />
            </div>
          )}

          <label 
            htmlFor="remember" 
            className="flex items-center gap-2.5 py-1 cursor-pointer select-none min-h-[36px]"
          >
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
            />
            <span className="text-[11px] text-slate-600 dark:text-slate-400">
              Remember this clinical workstation
            </span>
          </label>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-medium rounded-xl h-11 sm:h-10 shadow-sm transition-all flex items-center justify-center text-xs sm:text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In to Clinical Portal
              </>
            )}
          </Button>
        </form>
      )}

      <footer className="text-center pt-1 border-t border-slate-100 dark:border-slate-800">
        <p className="text-[10px] sm:text-[11px] text-slate-400">
          Authorized personnel only. Contact facility administrator for access.
        </p>
      </footer>
    </div>
  )
}
