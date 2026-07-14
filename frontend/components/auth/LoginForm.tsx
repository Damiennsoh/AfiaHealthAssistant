"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, LogIn, Key, Mail, Eye, EyeOff, WifiOff, Search, MapPin, User, Building } from "lucide-react"
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

  // Load clinics when country changes (auto-select if only one)
  useEffect(() => {
    const loadClinics = async () => {
      setIsLoadingClinics(true)
      setError(null)
      try {
        const response = await afiaAPI.listPublicClinics(country)
        if (response.error) {
          setError(response.error)
        } else {
          setClinics(response.data || [])
          // Auto-select first clinic if only one exists
          if (response.data && response.data.length === 1) {
            setSelectedClinic(response.data[0])
            setStep(2)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clinics')
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
        setError(null)
        try {
          const response = await afiaAPI.listPublicClinics(country, searchQuery)
          if (response.error) {
            setError(response.error)
          } else {
            setClinics(response.data || [])
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load clinics')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    // Super admin login doesn't require clinic selection
    if (!isSuperAdmin && !selectedClinic) {
      setError('Please select a clinic first')
      setIsLoading(false)
      return
    }

    try {
      await login(
        email, 
        password, 
        isSuperAdmin ? undefined : selectedClinic?.id, 
        isSuperAdmin ? undefined : (selectedClinic?.require_staff_id ? staffId : undefined), 
        isSuperAdmin ? undefined : (selectedClinic?.require_department ? department : undefined),
        isSuperAdmin ? 'super_admin' : undefined
      )
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-5">
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
            You are currently offline. Login requires internet connection to authenticate with the server.
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
                ) : clinics.length === 0 ? (
                  <div className="text-center p-4 text-slate-500">
                    No clinics found
                  </div>
                ) : (
                  clinics.map((clinic) => (
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
            type="submit"
            disabled={isLoading || isOffline}
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
