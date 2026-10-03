"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, LogIn, Key, Mail, Eye, EyeOff, WifiOff, Search, MapPin, User, Building, Sparkles, Check, Shield, Stethoscope } from "lucide-react"
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

  // Recruiter & Demo quick login state
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
      setError(err instanceof Error ? err.message : 'Demo login failed. If backend is waking up from idle, please retry in 10-15 seconds.')
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
      setError('Please select a clinic first')
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
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.')
    } finally {
      console.log('[LoginForm] handleSubmit complete, setting isLoading to false');
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Recruiter & Guest Demo Quick Access Card */}
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-white p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              Recruiter & Guest Preview Mode
            </span>
          </div>
          <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
            Instant 1-Click
          </span>
        </div>

        <p className="text-xs text-slate-600 mb-3 leading-relaxed">
          Test live features with pre-configured accounts:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Guest Clinician Button */}
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => handleQuickLogin('guest')}
            className="h-auto py-2.5 px-3 border-emerald-300 bg-white hover:bg-emerald-50 text-slate-800 flex flex-col items-start justify-center shadow-xs transition-all hover:border-emerald-400 group"
          >
            <div className="flex items-center gap-2 w-full">
              <div className="p-1 rounded bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                <Stethoscope className="h-4 w-4" />
              </div>
              <div className="text-left font-semibold text-xs text-emerald-950 flex-1 truncate">
                Guest Clinician
              </div>
              {quickLoadingType === 'guest' && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-normal mt-1 text-left">
              Patient Care, AI STG & Triage
            </span>
          </Button>

          {/* Super Admin Button */}
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => handleQuickLogin('admin')}
            className="h-auto py-2.5 px-3 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 flex flex-col items-start justify-center shadow-xs transition-all hover:border-slate-400 group"
          >
            <div className="flex items-center gap-2 w-full">
              <div className="p-1 rounded bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200 transition-colors">
                <Shield className="h-4 w-4" />
              </div>
              <div className="text-left font-semibold text-xs text-slate-900 flex-1 truncate">
                Super Admin
              </div>
              {quickLoadingType === 'admin' && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-normal mt-1 text-left">
              Clinic Mgmt, Audit & Security
            </span>
          </Button>
        </div>

        {/* Credentials Pill / Auto-fill hints */}
        <div className="mt-3 pt-2 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400">Credentials:</span>
            <button
              type="button"
              onClick={() => copyToClipboard('guest@afia.health | Demo1234!', 'guest')}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-mono text-[10px]"
              title="Click to copy guest login"
            >
              guest@afia.health / Demo1234!
              {copiedCred === 'guest' ? <Check className="h-3 w-3 text-emerald-600" /> : null}
            </button>
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">
            (or fill below manually)
          </span>
        </div>
      </div>

      <div className="relative flex py-1 items-center">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="flex-shrink mx-3 text-xs text-slate-400 font-medium">Or Sign In Manually</span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      {/* Error Alert - Always visible at top */}
      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 sticky top-0 z-50 animate-in fade-in">
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Offline Warning */}
      {isOffline && (
        <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-800">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You are currently offline. If you have logged in before on this device, you can authenticate using cached credentials. First-time login requires internet connection.
          </AlertDescription>
        </Alert>
      )}

      {step === 1 ? (
        // Step 1: Country and Clinic Selection
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
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
              className="h-4 w-4 text-emerald-600 border-emerald-300 rounded focus:ring-emerald-500"
            />
            <Label htmlFor="superAdmin" className="text-sm text-slate-600 cursor-pointer">
              Super Admin Login (Global Access)
            </Label>
          </div>

          {!isSuperAdmin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="country" className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Country
                </Label>
                <Select value={country} onValueChange={(val: 'GH' | 'ZW') => setCountry(val)}>
                  <SelectTrigger className="border-emerald-100 focus:border-emerald-500 focus:ring-emerald-500 bg-white/50">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GH">Ghana</SelectItem>
                    <SelectItem value="ZW">Zimbabwe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="search" className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Search className="h-4 w-4 text-emerald-600" />
                  Search Clinics
                </Label>
                <Input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by clinic name or code..."
                  disabled={isLoadingClinics}
                  className="border-emerald-100 focus:border-emerald-500 focus:ring-emerald-500 bg-white/50"
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 border border-emerald-100 rounded-lg p-2">
                {isLoadingClinics ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                    <span className="ml-2 text-slate-600">Loading clinics...</span>
                  </div>
                ) : (clinics || []).length === 0 ? (
                  <div className="text-center py-6 px-4 bg-slate-50/70 rounded-lg border border-dashed border-slate-200 space-y-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                      <Building className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-700">
                        {searchQuery ? "No matching clinics found" : "No registered clinics found (0 clinics)"}
                      </p>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                        {searchQuery
                          ? "Try a different search term or clear the search field."
                          : "Super Admins can log in below to register partnered clinics and provision staff credentials."}
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
                        className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 gap-1.5 font-medium shadow-xs"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        Log in as Super Admin to Provision Clinics
                      </Button>
                    )}
                  </div>
                ) : (
                  (clinics || []).map((clinic) => (
                    <button
                      key={clinic.id}
                      type="button"
                      onClick={() => handleClinicSelect(clinic)}
                      className="w-full text-left p-3 rounded-lg border border-emerald-100 hover:bg-emerald-50 transition-colors duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-slate-800">{clinic.name}</div>
                          <div className="text-sm text-slate-500">{clinic.code}</div>
                          {(clinic.region || clinic.district) && (
                            <div className="text-xs text-slate-400 mt-1">
                              {clinic.region} {clinic.district ? `• ${clinic.district}` : ''}
                            </div>
                          )}
                        </div>
                        <Building className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      </div>
                      {(clinic.require_staff_id || clinic.require_department) && (
                        <div className="mt-2 flex gap-2">
                          {clinic.require_staff_id && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                              Staff ID Required
                            </span>
                          )}
                          {clinic.require_department && (
                            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
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
        <form onSubmit={handleSubmit} className="space-y-5">
          {selectedClinic && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-emerald-600" />
                  <div>
                    <div className="font-medium text-emerald-800">{selectedClinic.name}</div>
                    <div className="text-xs text-emerald-600">{selectedClinic.code}</div>
                  </div>
                </div>
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleBack}
                  className="text-xs"
                >
                  Change
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-600" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@clinic.org"
              required
              autoComplete="email"
              disabled={isLoading}
              className="border-emerald-100 focus:border-emerald-500 focus:ring-emerald-500 bg-white/50"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Key className="h-4 w-4 text-emerald-600" />
                Password
              </Label>
              {onForgotPassword && (
                <button 
                  type="button" 
                  onClick={onForgotPassword}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
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
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={isLoading}
                className="border-emerald-100 focus:border-emerald-500 focus:ring-emerald-500 bg-white/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {selectedClinic?.require_staff_id && (
            <div className="space-y-2">
              <Label htmlFor="staffId" className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                Staff ID
              </Label>
              <Input
                id="staffId"
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="Enter your staff ID"
                required
                disabled={isLoading}
                className="border-emerald-100 focus:border-emerald-500 focus:ring-emerald-500 bg-white/50"
              />
            </div>
          )}

          {selectedClinic?.require_department && (
            <div className="space-y-2">
              <Label htmlFor="department" className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Building className="h-4 w-4 text-emerald-600" />
                Department
              </Label>
              <Input
                id="department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Enter your department"
                required
                disabled={isLoading}
                className="border-emerald-100 focus:border-emerald-500 focus:ring-emerald-500 bg-white/50"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 text-emerald-600 border-emerald-300 rounded focus:ring-emerald-500"
            />
            <Label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">
              Remember me on this device
            </Label>
          </div>

          <Button
            type="button"
            disabled={isLoading}
            onClick={(e) => {
              console.log('[LoginForm] Button clicked');
              e.preventDefault();
              // Call handleSubmit directly
              const formEvent = new Event('submit', { cancelable: true, bubbles: true });
              handleSubmit(formEvent as any);
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-300 text-white shadow-lg shadow-emerald-200 dark:shadow-none h-11 transition-all duration-200 transform hover:scale-[1.02]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
        </form>
      )}

      <div className="text-center">
        <p className="text-xs text-slate-500">
          Contact your clinic administrator to create an account
        </p>
      </div>
    </div>
  )
}
