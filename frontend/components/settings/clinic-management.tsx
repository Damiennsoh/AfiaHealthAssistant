"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Building, Users, Activity } from "lucide-react"
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
  require_staff_id: boolean
  require_department: boolean
  features: Record<string, any>
  tier: string
  status: string
  created_at: string
  user_count: number
  patient_count: number
}

export function ClinicManagement() {
  const { user } = useAuth()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "",
    code: "",
    country_code: "GH" as "GH" | "ZW",
    region: "",
    district: "",
    address: "",
    phone: "",
    email: "",
    admin_email: "",
    admin_name: "",
    admin_temp_password: "",
    require_staff_id: false,
    require_department: false
  })

  const loadClinics = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await afiaAPI.listClinics()
      if (response.data && Array.isArray(response.data)) {
        setClinics(response.data as Clinic[])
      }
    } catch (err) {
      setError("Failed to load clinics")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === "super_admin") {
      loadClinics()
    }
  }, [user])

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      // 1. Sanitize the payload: Force code to uppercase, convert empty strings to undefined
      const sanitizedForm = {
        ...createForm,
        code: createForm.code.toUpperCase().trim(),
        region: createForm.region.trim() || undefined,
        district: createForm.district.trim() || undefined,
        address: createForm.address.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        email: createForm.email.trim() || undefined,
        tier: "BASIC"
      }

      const response = await afiaAPI.createClinic(sanitizedForm)

      if (!response.error) {
        toast.success("Clinic created successfully")
        setCreateForm({
          name: "",
          code: "",
          country_code: "GH",
          region: "",
          district: "",
          address: "",
          phone: "",
          email: "",
          admin_email: "",
          admin_name: "",
          admin_temp_password: "",
          require_staff_id: false,
          require_department: false
        })
        setIsCreateDialogOpen(false)
        await loadClinics()
      } else {
        // Handle custom format errors returned inside response
        if (Array.isArray(response.error)) {
          const messages = response.error.map((e: any) => `${e.loc?.join('.') || 'field'}: ${e.msg}`).join('; ')
          setError(messages)
        } else if (typeof response.error === 'object' && response.error !== null) {
          setError(JSON.stringify(response.error))
        } else {
          setError(String(response.error || "Failed to create clinic"))
        }
      }
    } catch (err: any) {
      // 2. Safe error catching to prevent React Error #31
      if (err?.response?.data?.detail) {
        const backendError = err.response.data.detail
        if (Array.isArray(backendError)) {
          const messages = backendError.map((e: any) => {
            // Get the field name (last element in location array)
            const field = e.loc && e.loc.length > 0 ? e.loc[e.loc.length - 1] : 'field';
            return `${field}: ${e.msg}`;
          }).join('; ')
          setError(messages)
        } else if (typeof backendError === 'object' && backendError !== null) {
          // If the error is a single object, format it safely
          const message = backendError.msg || backendError.detail || JSON.stringify(backendError)
          setError(message)
        } else {
          setError(String(backendError))
        }
      } else {
        setError(err.message || "Failed to create clinic")
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!user || user.role !== "super_admin") {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Clinic Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage all clinics and facilities
          </p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)} 
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Clinic
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isCreateDialogOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-emerald-600" />
              Create New Clinic
            </CardTitle>
            <CardDescription>
              Add a new healthcare facility and create its initial administrator account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateClinic} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Clinic Name</Label>
                  <Input 
                    id="name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="CHPS Compound, District Hospital, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Clinic Code</Label>
                  <Input
                    id="code"
                    value={createForm.code}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    required
                    placeholder="Unique facility code (uppercase)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country-code">Country</Label>
                  <Select 
                    value={createForm.country_code} 
                    onValueChange={(v: "GH" | "ZW") => setCreateForm(prev => ({ ...prev, country_code: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GH">Ghana</SelectItem>
                      <SelectItem value="ZW">Zimbabwe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region/Province</Label>
                  <Input 
                    id="region"
                    value={createForm.region}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, region: e.target.value }))}
                    placeholder="Region or province name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <Input 
                    id="district"
                    value={createForm.district}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, district: e.target.value }))}
                    placeholder="District name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input 
                    id="address"
                    value={createForm.address}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Physical address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input 
                    id="phone"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Clinic phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic-email">Clinic Contact Email</Label>
                  <Input 
                    id="clinic-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="clinic@facility.org (general contact email)"
                  />
                  <p className="text-[10px] text-slate-500">General contact email for the facility</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="require-staff-id" 
                    checked={createForm.require_staff_id}
                    onCheckedChange={(v) => setCreateForm(prev => ({ ...prev, require_staff_id: !!v }))}
                  />
                  <Label htmlFor="require-staff-id">Require Staff ID</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="require-department" 
                    checked={createForm.require_department}
                    onCheckedChange={(v) => setCreateForm(prev => ({ ...prev, require_department: !!v }))}
                  />
                  <Label htmlFor="require-department">Require Department</Label>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-800 mb-4">Clinic Administrator Account</h3>
                <p className="text-sm text-slate-600 mb-4">Create the initial administrator account for this clinic. This user will have full access to manage the clinic and its staff.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Admin Email (Login)</Label>
                    <Input 
                      id="admin-email"
                      type="email"
                      value={createForm.admin_email}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, admin_email: e.target.value }))}
                      required
                      placeholder="admin@clinic.org"
                    />
                    <p className="text-[10px] text-slate-500">Email address for admin login</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-name">Admin Name</Label>
                    <Input 
                      id="admin-name"
                      value={createForm.admin_name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, admin_name: e.target.value }))}
                      required
                      placeholder="Full name of clinic admin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Initial Password</Label>
                    <div className="relative">
                      <Input
                        id="admin-password"
                        type={showPassword ? "text" : "password"}
                        value={createForm.admin_temp_password}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, admin_temp_password: e.target.value }))}
                        required
                        placeholder="Min 8 characters"
                        minLength={8}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-sm"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">Admin will be prompted to change on first login</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Clinic
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-emerald-600" />
              All Clinics
            </CardTitle>
            <CardDescription>
              Overview of all registered healthcare facilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Patients</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clinics.map((clinic) => (
                  <TableRow key={clinic.id}>
                    <TableCell className="font-medium">{clinic.name}</TableCell>
                    <TableCell className="font-mono">{clinic.code}</TableCell>
                    <TableCell>{clinic.country_code}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={clinic.is_active ? "default" : "secondary"}
                        className={clinic.is_active ? "bg-emerald-600" : "bg-slate-400"}
                      >
                        {clinic.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="h-3 w-3 text-slate-500" />
                        {clinic.user_count}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Activity className="h-3 w-3 text-slate-500" />
                        {clinic.patient_count}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
