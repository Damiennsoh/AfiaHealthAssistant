"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, UserPlus, Mail, User, Lock, Shield, Eye, EyeOff } from "lucide-react"
import { afiaAPI } from "@/lib/afia-api"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AfiaAuthContext"

interface CreateAccountFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export default function CreateAccountForm({ onSuccess, onCancel }: CreateAccountFormProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "healthworker",
    staff_id: "",
    department: ""
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [clinicRequirements, setClinicRequirements] = useState({
    require_staff_id: false,
    require_department: false
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const validateForm = (): boolean => {
    if (!formData.full_name.trim()) {
      setError("Full name is required")
      return false
    }
    
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError("Valid email is required")
      return false
    }
    
    if (!formData.password) {
      setError("Password is required")
      return false
    }
    
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long")
      return false
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      setError("Password must contain uppercase, lowercase, and numbers")
      return false
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return false
    }
    
    // Check staff ID requirement
    if (clinicRequirements.require_staff_id && !formData.staff_id.trim()) {
      setError("Staff ID is required for this clinic")
      return false
    }
    
    // Check department requirement
    if (clinicRequirements.require_department && !formData.department.trim()) {
      setError("Department is required for this clinic")
      return false
    }
    
    return true
  }

  // Fetch clinic requirements when component mounts
  useEffect(() => {
    const fetchClinicRequirements = async () => {
      if (user?.clinic_id) {
        try {
          const response = await afiaAPI.getClinic(user.clinic_id)
          if (response.data) {
            setClinicRequirements({
              require_staff_id: response.data.require_staff_id || false,
              require_department: response.data.require_department || false
            })
          }
        } catch (err) {
          console.error('Failed to fetch clinic requirements:', err)
        }
      }
    }
    fetchClinicRequirements()
  }, [user?.clinic_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await afiaAPI.createUser({
        email: formData.email,
        full_name: formData.full_name,
        password: formData.password,
        role: formData.role,
        staff_id: formData.staff_id || undefined,
        department: formData.department || undefined,
        clinic_id: user?.clinic_id // Inherit clinic ID from the admin creating the user
      })

      if (response.data) {
        toast.success("User account created successfully")
        onSuccess?.()
      } else {
        setError(response.error || "Failed to create user account")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <Label htmlFor="full_name" className="text-slate-700 flex items-center gap-2 text-sm">
          <User className="h-3.5 w-3.5 text-emerald-600" />
          Full Name
        </Label>
        <Input
          id="full_name"
          type="text"
          value={formData.full_name}
          onChange={(e) => handleInputChange("full_name", e.target.value)}
          placeholder="e.g. Dr. Kwame Mensah"
          required
          disabled={isLoading}
          className="h-9"
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor="email" className="text-slate-700 flex items-center gap-2 text-sm">
          <Mail className="h-3.5 w-3.5 text-emerald-600" />
          Email Address
        </Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange("email", e.target.value)}
          placeholder="kwame.mensah@clinic.com"
          required
          disabled={isLoading}
          className="h-9"
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor="role" className="text-slate-700 flex items-center gap-2 text-sm">
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          Role
        </Label>
        <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)} disabled={isLoading}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select user role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="healthworker">Healthworker</SelectItem>
            <SelectItem value="clinic_admin">Clinic Administrator</SelectItem>
            <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-3">
          <Label htmlFor="password" className="text-slate-700 flex items-center gap-2 text-sm">
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              required
              disabled={isLoading}
              className="pr-10 h-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="confirm-password" className="text-slate-700 flex items-center gap-2 text-sm">
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
              required
              disabled={isLoading}
              className="pr-10 h-9"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              disabled={isLoading}
            >
              {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-3">
          <Label htmlFor="staff_id" className="text-slate-700 flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-emerald-600" />
            Staff ID {clinicRequirements.require_staff_id && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="staff_id"
            type="text"
            value={formData.staff_id}
            onChange={(e) => handleInputChange("staff_id", e.target.value)}
            placeholder="e.g. STF-001"
            disabled={isLoading}
            required={clinicRequirements.require_staff_id}
            className="h-9"
          />
          {clinicRequirements.require_staff_id && (
            <p className="text-[10px] text-orange-600">Required by clinic policy</p>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="department" className="text-slate-700 flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-emerald-600" />
            Department {clinicRequirements.require_department && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="department"
            type="text"
            value={formData.department}
            onChange={(e) => handleInputChange("department", e.target.value)}
            placeholder="e.g. Pediatrics"
            disabled={isLoading}
            required={clinicRequirements.require_department}
            className="h-9"
          />
          {clinicRequirements.require_department && (
            <p className="text-[10px] text-orange-600">Required by clinic policy</p>
          )}
        </div>
      </div>

      <p className="text-[10px] text-slate-500">
        Password must be at least 8 characters with uppercase, lowercase, and numbers.
      </p>

      <div className="flex flex-col gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full h-9 py-2"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-9 py-2"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          Create Staff Account
        </Button>
      </div>
    </form>
  )
}
