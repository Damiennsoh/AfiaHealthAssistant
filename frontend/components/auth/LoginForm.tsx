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

  // Evaluation quick login state
  const [quickLoadingType, setQuickLoadingType] = useState<'guest' | 'admin' | null>(null)
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
          // Safely extract array from response
          const clinicsArray = Array.isArray(response) 
            ? response 
            : (response.data || [])
          setClinics(clinicsArray)
          // Auto-select first clinic if only one exists
          if (clinicsArray.length === 1) {
            setSelectedClinic(clinicsArray[0])
            setStep(2)
          }
        }
      } catch (err) {
        console.warn('[LoginForm] Clinic list discovery error:', err)
        setClinics([]) // Force reset to empty array on failure
      } finally {
        setIsLoadingClinics(false)
      }
    }

    loadClinics()
  }, [country])

  // Load clinics when search changes (don't auto-select)
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
            // Safely extract array from response
            const clinicsArray = Array.isArray(response) 
              ? response 
              : (response.data || [])
            setClinics(clinicsArray)
          }
        } catch (err) {
          console.warn('[LoginForm] Search clinic error:', err)
          setClinics([]) // Force reset to empty array on failure
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

  const handleQuickLogin = async (type: 'guest' | 'admin') => {
    setError(null)
    setIsLoading(true)
    setQuickLoadingType(type)

    try {
      if (type === 'guest') {
        const demoEmail = 'guest@afia.health'
        const demoPw = 'Demo1234!'
        setEmail(demoEmail)
        setPassword(demoPw)
        setIsSuperAdmin(false)

        // Find demo clinic or fallback to known ID
        const targetClinic = selectedClinic || clinics.find(c => c.code === 'DEMO-GH01') || (clinics.length > 0 ? clinics[0] : null)
        const clinicId = targetClinic?.id || '64d5dd15-44c3-4d12-bf2f-5fef517c346e'
        if (targetClinic) setSelectedClinic(targetClinic)

        await login(demoEmail, demoPw, clinicId, undefined, undefined, 'clinic_admin')
      } else {
        const adminEmail = 'admin@afia.health'
        const adminPw = 'Admin1234!'
        setEmail(adminEmail)
        setPassword(adminPw)
        setIsSuperAdmin(true)

        await login(adminEmail, adminPw, undefined, undefined, undefined, 'super_admin')
      }
      onSuccess?.()
    } catch (err) {
      console.error('[LoginForm] Quick login error:', err)
      setError(err instanceof Error ? err.message : 'Authentication failed. Please verify network connectivity and retry.')
    } finally {
      setIsLoading(false)
      setQuickLoadingType(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    console.log('[LoginForm] handleSubmit called');
    console.log('[LoginForm] Email:', email);
    console.log('[LoginForm] Is Super Admin:', isSuperAdmin);
    console.log('[LoginForm] Selected Clinic:', selectedClinic?.name);

    const isGuest = email.trim().toLowerCase() === 'guest@afia.health';

    // Super admin or guest demo login doesn't strictly block on clinic selection
    if (!isSuperAdmin && !selectedClinic && !isGuest) {
      setError('Please select an authorized healthcare facility first.')
      setIsLoading(false)
      return
    }

    try {
      console.log('[LoginForm] Calling login function...');
      const targetClinicId = isSuperAdmin ? undefined : (selectedClinic?.id || (isGuest ? '64d5dd15-44c3-4d12-bf2f-5fef517c346e' : undefined))
      await login(
        email, 
        password, 
        targetClinicId, 
        isSuperAdmin ? undefined : (selectedClinic?.require_staff_id ? staffId : undefined), 
        isSuperAdmin ? undefined : (selectedClinic?.require_department ? department : undefined),
        isSuperAdmin ? 'super_admin' : (isGuest ? 'clinic_admin' : undefined)
      )
      console.log('[LoginForm] Login function completed successfully');
      console.log('[LoginForm] Calling onSuccess callback...');
      onSuccess?.()
      console.log('[LoginForm] onSuccess callback completed');
    } catch (err) {
      console.error('[LoginForm] Login error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed. Please verify your credentials.')
    } finally {
      console.log('[LoginForm] handleSubmit complete, setting isLoading to false');
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Clinical Sandbox & Evaluation Access */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Clinical Evaluation Sandbox
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700">
            1-Click Access
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          Select an evaluation role to test clinical decision support, triage, and administrative governance in an isolated sandbox environment:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Guest Clinician Button */}
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => handleQuickLogin('guest')}
            className="h-auto py-2.5 px-3 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-800 dark:text-slate-200 flex flex-col items-start justify-center shadow-xs transition-all group"
          >
            <div className="flex items-center gap-2 w-full">
              <div className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60 transition-colors">
                <Stethoscope className="h-3.5 w-3.5" />
              </div>
              <div className="text-left font-semibold text-xs text-slate-900 dark:text-white flex-1 truncate">
                Medical Clinician
              </div>
              {quickLoadingType === 'guest' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
              ) : (
                <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-1 text-left leading-tight">
              Patient Care, SOAP Notes &amp; Triage
            </span>
          </Button>

          {/* Super Admin Button */}
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => handleQuickLogin('admin')}
            className="h-auto py-2.5 px-3 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200 flex flex-col items-start justify-center shadow-xs transition-all group"
          >
            <div className="flex items-center gap-2 w-full">
              <div className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <div className="text-left font-semibold text-xs text-slate-900 dark:text-white flex-1 truncate">
                Global Administrator
              </div>
              {quickLoadingType === 'admin' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-600" />
              ) : (
                <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-1 text-left leading-tight">
              Facility Onboarding &amp; Audits
            </span>
          </Button>
        </div>

        {/* Credentials Pill / Auto-fill hints */}
        <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 text-[10px]">Evaluation Credentials:</span>
            <button
              type="button"
              onClick={() => copyToClipboard('guest@afia.health | Demo1234!', 'guest')}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-700 dark:text-slate-300 font-mono text-[10px]"
              title="Click to copy evaluation credentials"
            >
              guest@afia.health / Demo1234!
              {copiedCred === 'guest' ? <Check className="h-3 w-3 text-emerald-600" /> : null}
            </button>
          </div>
          <span className="text-[10px] text-slate-400">
            Isolated Local Sandbox
          </span>
        </div>
      </div>

      <div className="relative flex py-1 items-center">
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Or Sign In with Facility Credentials
        </span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 animate-in fade-in">
          <AlertDescription className="font-medium text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Offline Warning */}
      {isOffline && (
        <Alert variant="destructive" className="bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="text-xs">
            You are operating offline. You can authenticate using cached credentials on this device. First-time login requires initial online synchronization.
          </AlertDescription>
        </Alert>
      )}

      {step === 1 ? (
        // Step 1: Country and Clinic Selection
        <div className="space-y-4">
          <div className="flex items-center space-x-2.5 p-2 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800">
            <input
              type="checkbox"
              id="superAdmin"
              checked={isSuperAdmin}
              onChange={(e) => {
                setIsSuperAdmin(e.target.checked)
                if (e.target.checked) {
                  setStep(2) // Skip clinic selection for super admin
                } else {
                  setStep(1)
                }
              }}
              disabled={isLoading}
              className="h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
            />
            <Label htmlFor="superAdmin" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              Global Administrator Login (Skip Facility Selection)
            </Label>
          </div>

          {!isSuperAdmin && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  Jurisdiction / Country
                </Label>
                <Select value={country} onValueChange={(val: 'GH' | 'ZW') => setCountry(val)}>
                  <SelectTrigger className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-xs h-9">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GH" className="text-xs">Republic of Ghana (GHS)</SelectItem>
                    <SelectItem value="ZW" className="text-xs">Republic of Zimbabwe (EDLIZ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="search" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-emerald-600" />
                  Search Healthcare Facility
                </Label>
                <Input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by facility name or code..."
                  disabled={isLoadingClinics}
                  className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-xs h-9"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/40 dark:bg-slate-900/30">
                {isLoadingClinics ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    <span className="ml-2 text-xs text-slate-500">Querying registered facilities...</span>
                  </div>
                ) : (clinics || []).length === 0 ? (
                  <div className="text-center py-6 px-4 bg-white/70 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mx-auto text-slate-400">
                      <Building className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {searchQuery ? "No matching facilities found" : "No Registered Facilities Found (0 Clinics)"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
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
                        className="text-xs border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 font-medium shadow-xs"
                      >
                        <Shield className="h-3.5 w-3.5 text-emerald-600" />
                        Log in as Global Administrator to Onboard Facilities
                      </Button>
                    )}
                  </div>
                ) : (
                  (clinics || []).map((clinic) => (
                    <button
                      key={clinic.id}
                      type="button"
                      onClick={() => handleClinicSelect(clinic)}
                      className="w-full text-left p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/40 dark:hover:bg-slate-800/60 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-xs text-slate-900 dark:text-white">{clinic.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{clinic.code}</div>
                          {(clinic.region || clinic.district) && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {clinic.region} {clinic.district ? `• ${clinic.district}` : ''}
                            </div>
                          )}
                        </div>
                        <Building className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      </div>
                      {(clinic.require_staff_id || clinic.require_department) && (
                        <div className="mt-1.5 flex gap-1.5">
                          {clinic.require_staff_id && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded">
                              Staff ID Required
                            </span>
                          )}
                          {clinic.require_department && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded">
                              Department Required
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        // Step 2: User Authentication
        <form onSubmit={handleSubmit} className="space-y-4">
          {selectedClinic && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">{selectedClinic.name}</div>
                  <div className="text-[10px] font-mono text-slate-500">{selectedClinic.code}</div>
                </div>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={handleBack}
                className="text-xs h-7 text-slate-600 hover:text-slate-900"
              >
                Change Facility
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
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
              className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-xs h-9"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-emerald-600" />
                Password
              </Label>
              {onForgotPassword && (
                <button 
                  type="button" 
                  onClick={onForgotPassword}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium"
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
                className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-xs h-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {selectedClinic?.require_staff_id && (
            <div className="space-y-1.5">
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
                className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-xs h-9"
              />
            </div>
          )}

          {selectedClinic?.require_department && (
            <div className="space-y-1.5">
              <Label htmlFor="department" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-emerald-600" />
                Department / Ward
              </Label>
              <Input
                id="department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Outpatient (OPD) / Maternity"
                required
                disabled={isLoading}
                className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-white dark:bg-slate-900 text-xs h-9"
              />
            </div>
          )}

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              className="h-3.5 w-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
            />
            <Label htmlFor="remember" className="text-[11px] text-slate-500 cursor-pointer">
              Remember this clinical workstation
            </Label>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg h-10 shadow-sm transition-all flex items-center justify-center text-xs"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Authenticating Credentials...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-3.5 w-3.5" />
                Sign In to Clinical Portal
              </>
            )}
          </Button>
        </form>
      )}

      <div className="text-center pt-1 border-t border-slate-100 dark:border-slate-800">
        <p className="text-[11px] text-slate-400">
          Authorized personnel only. Contact your facility administrator for credential provisioning.
        </p>
      </div>
    </div>
  )
}
