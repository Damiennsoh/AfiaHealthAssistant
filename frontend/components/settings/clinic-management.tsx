"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Loader2, Plus, Building, Users, Activity, Ban, Archive,
  Trash2, CheckCircle, KeyRound, Eye, EyeOff, Save, RotateCcw,
  Mail, Phone, MapPin, User, ShieldAlert, Settings2
} from "lucide-react"
import { toast } from "sonner"
import { afiaAPI } from "@/lib/afia-api"
import { useAuth } from "@/contexts/AfiaAuthContext"

interface Clinic {
  id: string
  name: string
  code: string
  country_code: string
  region?: string
  district?: string
  address?: string
  phone?: string
  email?: string
  is_active: boolean
  is_suspended: boolean
  is_demo_clinic: boolean
  require_staff_id: boolean
  require_department: boolean
  features: Record<string, any>
  tier: string
  status: string
  created_at: string
  user_count: number
  patient_count: number
}

const validatePassword = (password: string): string | null => {
  if (password.length < 8) return "Password must be at least 8 characters"
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter"
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter"
  if (!/\d/.test(password)) return "Password must contain at least one digit"
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) return "Password must contain at least one special character"
  return null
}

function AdminPasswordResetPanel({ clinic }: { clinic: Clinic }) {
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  const handleReset = async () => {
    const err = validatePassword(newPassword)
    if (err) { setPasswordError(err); return }
    setPasswordError(null)
    setIsResetting(true)
    try {
      const res = await afiaAPI.adminResetClinicAdminPassword(clinic.id, newPassword)
      if (res.error) throw new Error(String(res.error))
      toast.success(`Admin password for ${clinic.name} has been reset.`)
      setNewPassword("")
    } catch (e: any) {
      toast.error(e.message || "Failed to reset password")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Reset Clinic Admin Password</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Set a new temporary password for this clinic's administrator. They should change it on next login.
      </p>
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                setPasswordError(validatePassword(e.target.value))
              }}
              placeholder="New admin password"
              className="pr-10 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
        </div>
        <Button
          size="sm"
          disabled={isResetting || !newPassword}
          onClick={handleReset}
          className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
        >
          {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          <span className="ml-1.5">Reset</span>
        </Button>
      </div>
    </div>
  )
}

function ClinicAdminEditPanel({ clinic }: { clinic: Clinic }) {
  const { user } = useAuth()

  const buildInitialForm = () => ({
    name: (user as any)?.name || user?.full_name || "",
    email: user?.email || "",
    phone: (user as any)?.phone || "",
    clinic_name: clinic.name || "",
    clinic_email: clinic.email || "",
    clinic_phone: clinic.phone || "",
    clinic_region: clinic.region || "",
    clinic_district: clinic.district || "",
    clinic_address: clinic.address || "",
  })

  const [form, setForm] = useState(buildInitialForm)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await afiaAPI.updateOwnProfile(form)
      if (res.error) throw new Error(String(res.error))
      toast.success("Profile and clinic details updated. Changes have been logged.")
    } catch (e: any) {
      toast.error(e.message || "Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  const field = (key: keyof ReturnType<typeof buildInitialForm>) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  })

  return (
    <form onSubmit={handleSave} className="space-y-5 pt-2">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <User className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Your Admin Details</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Full Name</Label>
            <Input {...field("name")} placeholder="Your name" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input {...field("email")} type="email" placeholder="your@email.com" className="h-9 text-sm pl-8" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input {...field("phone")} type="tel" placeholder="+233 20 000 0000" className="h-9 text-sm pl-8" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Building className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Clinic Contact Details</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Clinic Name</Label>
            <Input {...field("clinic_name")} placeholder="Clinic display name" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Clinic Email</Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input {...field("clinic_email")} type="email" placeholder="clinic@facility.org" className="h-9 text-sm pl-8" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Clinic Phone</Label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input {...field("clinic_phone")} type="tel" placeholder="+233 20 000 0000" className="h-9 text-sm pl-8" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Region / Province</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input {...field("clinic_region")} placeholder="Region or province" className="h-9 text-sm pl-8" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">District</Label>
            <Input {...field("clinic_district")} placeholder="District name" className="h-9 text-sm" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Physical Address</Label>
            <Input {...field("clinic_address")} placeholder="Street address" className="h-9 text-sm" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 h-9 text-sm">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
        <Button type="button" variant="outline" onClick={() => setForm(buildInitialForm())} className="h-9 text-sm">
          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
        </Button>
      </div>
      <p className="text-xs text-slate-400">All changes are recorded in the system audit log.</p>
    </form>
  )
}

function ClinicSettingsPanel({ clinic, onSaved }: { clinic: Clinic; onSaved: () => void }) {
  const [requireStaffId, setRequireStaffId] = useState(clinic.require_staff_id)
  const [requireDepartment, setRequireDepartment] = useState(clinic.require_department)
  const [isSaving, setIsSaving] = useState(false)

  const hasChanges = requireStaffId !== clinic.require_staff_id || requireDepartment !== clinic.require_department

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await afiaAPI.updateClinic(clinic.id, {
        require_staff_id: requireStaffId,
        require_department: requireDepartment,
      } as any)
      if (res.error) throw new Error(String(res.error))
      toast.success(`Login settings for ${clinic.name} updated.`)
      onSaved()
    } catch (e: any) {
      toast.error(e.message || "Failed to update clinic settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
      <div className="flex items-center gap-2 mb-2">
        <Settings2 className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Login Requirements</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Control what fields staff must provide when logging into this clinic.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 mb-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={requireStaffId}
            onCheckedChange={(v) => setRequireStaffId(!!v)}
            id={`staff-id-${clinic.id}`}
          />
          <span className="text-sm">Require Staff ID at login</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={requireDepartment}
            onCheckedChange={(v) => setRequireDepartment(!!v)}
            id={`dept-${clinic.id}`}
          />
          <span className="text-sm">Require Department at login</span>
        </label>
      </div>
      {hasChanges && (
        <Button
          size="sm"
          disabled={isSaving}
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs gap-1"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Settings
        </Button>
      )}
    </div>
  )
}

export function ClinicManagement() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === "super_admin"
  const isClinicAdmin = user?.role === "clinic_admin"

  // The AFIA Administration clinic is the superadmin's own system account
  const isAdminClinic = (clinic: Clinic) =>
    clinic.code === "ADMIN-001" || clinic.id === user?.clinic_id

  const [clinics, setClinics] = useState<Clinic[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Typed delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Clinic | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  const emptyCreateForm = {
    name: "", code: "", country_code: "GH" as "GH" | "ZW",
    region: "", district: "", address: "", phone: "", email: "",
    admin_email: "", admin_name: "", admin_temp_password: "",
    admin_staff_id: "", admin_department: "",
    require_staff_id: false, require_department: false
  }
  const [createForm, setCreateForm] = useState(emptyCreateForm)

  const loadClinics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (isSuperAdmin) {
        const response = await afiaAPI.listClinics()
        if (response.data && Array.isArray(response.data)) {
          setClinics(response.data as Clinic[])
        }
      } else if (isClinicAdmin && user?.clinic_id) {
        const response = await afiaAPI.getClinic(user.clinic_id)
        if (response.data) {
          setClinics([response.data as unknown as Clinic])
        }
      }
    } catch {
      setError("Failed to load clinic information")
    } finally {
      setIsLoading(false)
    }
  }, [isSuperAdmin, isClinicAdmin, user?.clinic_id])

  useEffect(() => {
    if (isSuperAdmin || isClinicAdmin) loadClinics()
  }, [loadClinics])

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault()
    const pwErr = validatePassword(createForm.admin_temp_password)
    if (pwErr) { setPasswordError(pwErr); return }
    setPasswordError(null)
    setIsLoading(true)
    setError(null)
    try {
      const sanitized = {
        ...createForm,
        code: createForm.code.toUpperCase().trim(),
        region: createForm.region.trim() || undefined,
        district: createForm.district.trim() || undefined,
        address: createForm.address.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        email: createForm.email.trim() || undefined,
      }
      const response = await afiaAPI.createClinic(sanitized as any)
      if (response && !response.error) {
        toast.success("Clinic created successfully")
        setCreateForm(emptyCreateForm)
        setIsCreateDialogOpen(false)
        await loadClinics()
      } else {
        if (Array.isArray(response.error)) {
          setError(response.error.map((e: any) => `${e.loc?.join('.') || 'field'}: ${e.msg}`).join('; '))
        } else {
          setError(String(response.error || "Failed to create clinic"))
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to create clinic")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuspend = async (clinicId: string, isSuspended: boolean) => {
    if (!isSuspended && !confirm("Suspend this clinic? All users will lose access.")) return
    try {
      isSuspended ? await afiaAPI.unsuspendClinic(clinicId) : await afiaAPI.suspendClinic(clinicId)
      toast.success(isSuspended ? "Clinic reactivated" : "Clinic suspended")
      await loadClinics()
    } catch { toast.error("Action failed") }
  }

  const handleArchive = async (clinicId: string) => {
    if (!confirm("Archive this clinic? This soft-deletes all clinic data.")) return
    try {
      await afiaAPI.archiveClinic(clinicId)
      toast.success("Clinic archived")
      await loadClinics()
    } catch { toast.error("Failed to archive clinic") }
  }

  const handleDelete = async (clinicId: string) => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return
    try {
      await afiaAPI.deleteClinic(clinicId)
      toast.success("Clinic permanently deleted")
      setDeleteTarget(null)
      setDeleteConfirmText("")
      await loadClinics()
    } catch (e: any) {
      toast.error(e.message || "Failed to delete clinic")
    }
  }

  if (!user || (!isSuperAdmin && !isClinicAdmin)) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {isSuperAdmin ? "Clinic Management" : "My Clinic"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSuperAdmin
              ? "Manage all registered healthcare facilities"
              : "View and update your clinic profile and contact details"}
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Plus className="h-4 w-4" /> Add Clinic
          </Button>
        )}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Typed Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Delete Clinic</h3>
                <p className="text-xs text-slate-500">This action is permanent and cannot be undone.</p>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-400">
                All patients, encounters, users and data associated with <strong>{deleteTarget.name}</strong> will be permanently erased.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">
                Type <span className="font-mono font-bold text-red-600">{deleteTarget.name}</span> to confirm:
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteTarget.name}
                className="border-red-300 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText("") }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-1"
                disabled={deleteConfirmText !== deleteTarget.name}
                onClick={() => handleDelete(deleteTarget.id)}
              >
                <Trash2 className="h-4 w-4" /> Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      {isCreateDialogOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-emerald-600" /> Create New Clinic
            </CardTitle>
            <CardDescription>
              Add a new healthcare facility and create its initial administrator account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateClinic} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-name">Clinic Name</Label>
                  <Input id="c-name" value={createForm.name}
                    onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                    required placeholder="CHPS Compound, District Hospital..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-code">Clinic Code</Label>
                  <Input id="c-code" value={createForm.code}
                    onChange={e => setCreateForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    required placeholder="Unique uppercase code" />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={createForm.country_code}
                    onValueChange={(v: "GH" | "ZW") => setCreateForm(p => ({ ...p, country_code: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GH">Ghana</SelectItem>
                      <SelectItem value="ZW">Zimbabwe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-region">Region/Province</Label>
                  <Input id="c-region" value={createForm.region}
                    onChange={e => setCreateForm(p => ({ ...p, region: e.target.value }))}
                    placeholder="Region or province name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-district">District</Label>
                  <Input id="c-district" value={createForm.district}
                    onChange={e => setCreateForm(p => ({ ...p, district: e.target.value }))}
                    placeholder="District name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-address">Address</Label>
                  <Input id="c-address" value={createForm.address}
                    onChange={e => setCreateForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="Physical address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-phone">Phone</Label>
                  <Input id="c-phone" value={createForm.phone}
                    onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="Clinic phone number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-email">Clinic Contact Email</Label>
                  <Input id="c-email" type="email" value={createForm.email}
                    onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="clinic@facility.org" />
                </div>
              </div>
              <div className="flex items-center gap-6 pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox id="req-staff" checked={createForm.require_staff_id}
                    onCheckedChange={v => setCreateForm(p => ({ ...p, require_staff_id: !!v }))} />
                  <Label htmlFor="req-staff">Require Staff ID</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="req-dept" checked={createForm.require_department}
                    onCheckedChange={v => setCreateForm(p => ({ ...p, require_department: !!v }))} />
                  <Label htmlFor="req-dept">Require Department</Label>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Clinic Administrator Account</h3>
                <p className="text-sm text-slate-500 mb-4">Create the initial admin account for this clinic.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="a-email">Admin Email</Label>
                    <Input id="a-email" type="email" value={createForm.admin_email}
                      onChange={e => setCreateForm(p => ({ ...p, admin_email: e.target.value }))}
                      required placeholder="admin@clinic.org" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="a-name">Admin Name</Label>
                    <Input id="a-name" value={createForm.admin_name}
                      onChange={e => setCreateForm(p => ({ ...p, admin_name: e.target.value }))}
                      required placeholder="Full name of clinic admin" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="a-pass">Initial Password</Label>
                    <div className="relative">
                      <Input id="a-pass"
                        type={showPassword ? "text" : "password"}
                        value={createForm.admin_temp_password}
                        onChange={e => {
                          setCreateForm(p => ({ ...p, admin_temp_password: e.target.value }))
                          setPasswordError(validatePassword(e.target.value))
                        }}
                        required placeholder="Min 8 chars, upper, lower, digit, special"
                        className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                  </div>
                </div>
                {createForm.require_staff_id && (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="a-staff">Admin Staff ID</Label>
                    <Input id="a-staff" value={createForm.admin_staff_id}
                      onChange={e => setCreateForm(p => ({ ...p, admin_staff_id: e.target.value }))}
                      required placeholder="Staff ID for authentication" />
                  </div>
                )}
                {createForm.require_department && (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="a-dept">Admin Department</Label>
                    <Input id="a-dept" value={createForm.admin_department}
                      onChange={e => setCreateForm(p => ({ ...p, admin_department: e.target.value }))}
                      required placeholder="e.g. OPD, Pharmacy, Laboratory" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Clinic
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && !clinics.length ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-emerald-600" />
              {isSuperAdmin ? `All Clinics (${clinics.length})` : "My Clinic"}
            </CardTitle>
            <CardDescription>
              {isSuperAdmin
                ? "Click a clinic to expand its details and management options"
                : "View and update your clinic information and admin contact details"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {clinics.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No clinics found.</p>
            ) : (
              <Accordion type="multiple" className="w-full space-y-2">
                {clinics.map((clinic) => {
                  const isAdmin = isAdminClinic(clinic)
                  return (
                  <AccordionItem
                    key={clinic.id}
                    value={clinic.id}
                    className={`border rounded-lg overflow-hidden ${
                      isAdmin
                        ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/10"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50 [&[data-state=open]]:bg-emerald-50 dark:[&[data-state=open]]:bg-emerald-950/20">
                      <div className="flex items-center justify-between w-full pr-3">
                        <div className="flex items-center gap-3 text-left">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isAdmin
                              ? "bg-emerald-600 text-white"
                              : "bg-emerald-100 dark:bg-emerald-900/50"
                          }`}>
                            {isAdmin
                              ? <ShieldAlert className="h-4 w-4" />
                              : <Building className="h-4 w-4 text-emerald-600" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{clinic.name}</p>
                              {isAdmin && (
                                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium uppercase tracking-wide">
                                  Global Admin
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-mono">{clinic.code}  {clinic.country_code}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Users className="h-3.5 w-3.5" />{clinic.user_count ?? 0}
                            <Activity className="h-3.5 w-3.5 ml-2" />{clinic.patient_count ?? 0}
                          </div>
                          <Badge
                            className={
                              clinic.is_suspended
                                ? "bg-yellow-500 text-white"
                                : clinic.is_active
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-400 text-white"
                            }
                          >
                            {clinic.is_suspended ? "Suspended" : clinic.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 pb-5 pt-0">
                      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 mb-3 text-xs text-slate-500 dark:text-slate-400">
                        {clinic.region && <span><span className="font-medium text-slate-600 dark:text-slate-300">Region:</span> {clinic.region}</span>}
                        {clinic.district && <span><span className="font-medium text-slate-600 dark:text-slate-300">District:</span> {clinic.district}</span>}
                        {clinic.email && <span><span className="font-medium text-slate-600 dark:text-slate-300">Email:</span> {clinic.email}</span>}
                        {clinic.phone && <span><span className="font-medium text-slate-600 dark:text-slate-300">Phone:</span> {clinic.phone}</span>}
                        {clinic.address && <span><span className="font-medium text-slate-600 dark:text-slate-300">Address:</span> {clinic.address}</span>}
                      </div>

                      {isSuperAdmin && (
                        <>
                          {/* AFIA Administration: show a protected notice, no destructive actions */}
                          {isAdmin ? (
                            <div className="flex items-center gap-2 border-t border-slate-200 dark:border-slate-700 pt-3 text-xs text-emerald-700 dark:text-emerald-400">
                              <ShieldAlert className="h-4 w-4 shrink-0" />
                              <span>This is the global administrator account. Suspend, archive, and delete actions are not available for this account.</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                              <span className="text-xs text-slate-400 mr-1">Actions:</span>
                              {clinic.is_suspended ? (
                                <Button size="sm" variant="outline" onClick={() => handleSuspend(clinic.id, true)}
                                  className="h-8 text-xs gap-1">
                                  <CheckCircle className="h-3.5 w-3.5" /> Unsuspend
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => handleSuspend(clinic.id, false)}
                                  className="h-8 text-xs gap-1 text-yellow-600 border-yellow-300 hover:bg-yellow-50">
                                  <Ban className="h-3.5 w-3.5" /> Suspend
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => handleArchive(clinic.id)}
                                className="h-8 text-xs gap-1">
                                <Archive className="h-3.5 w-3.5" /> Archive
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => { setDeleteTarget(clinic); setDeleteConfirmText("") }}
                                className="h-8 w-8 p-0 ml-auto"
                                title="Permanently delete this clinic"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                          {!isAdmin && <ClinicSettingsPanel clinic={clinic} onSaved={loadClinics} />}
                          <AdminPasswordResetPanel clinic={clinic} />
                        </>
                      )}

                      {isClinicAdmin && (
                        <ClinicAdminEditPanel clinic={clinic} />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                  )
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
