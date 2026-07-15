"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Building, User, Mail, Phone } from "lucide-react"
import { toast } from "sonner"
import { afiaAPI } from "@/lib/afia-api"
import { useAuth } from "@/contexts/AfiaAuthContext"

export function ClinicProfile() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    clinic_name: "",
    clinic_email: "",
    clinic_phone: "",
  })

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || "",
        phone: (user as any).phone || "",
        clinic_name: "",
        clinic_email: "",
        clinic_phone: "",
      })
      
      // Load clinic details if user has a clinic
      if (user.clinic_id) {
        loadClinicDetails()
      }
    }
  }, [user])

  const loadClinicDetails = async () => {
    try {
      if (!user?.clinic_id) return
      const clinic = await afiaAPI.getClinic(user.clinic_id)
      setFormData(prev => ({
        ...prev,
        clinic_name: clinic.data?.name || "",
        clinic_email: clinic.data?.email || "",
        clinic_phone: clinic.data?.phone || "",
      }))
    } catch (err: any) {
      console.error("Failed to load clinic details:", err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await afiaAPI.updateOwnProfile(formData)
      toast.success("Profile updated successfully")
      
      // Reload user data to reflect changes
      // Note: You may need to refresh the user context here
    } catch (err: any) {
      setError(err.message || "Failed to update profile")
      toast.error("Failed to update profile")
    } finally {
      setIsLoading(false)
    }
  }

  if (!user || user.role !== "clinic_admin") {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only clinic admins can access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Clinic Profile</h2>
        <p className="text-muted-foreground">
          Update your personal information and clinic details
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Update your contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-9"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-9"
                    placeholder="+233 20 000 0000"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clinic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Clinic Information
            </CardTitle>
            <CardDescription>
              Update your clinic's contact details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinic-name">Clinic Name</Label>
              <Input
                id="clinic-name"
                value={formData.clinic_name}
                onChange={(e) => setFormData(prev => ({ ...prev, clinic_name: e.target.value }))}
                placeholder="Your Clinic Name"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-email">Clinic Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="clinic-email"
                    type="email"
                    value={formData.clinic_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, clinic_email: e.target.value }))}
                    className="pl-9"
                    placeholder="clinic@facility.org"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-phone">Clinic Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="clinic-phone"
                    type="tel"
                    value={formData.clinic_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, clinic_phone: e.target.value }))}
                    className="pl-9"
                    placeholder="+233 20 000 0000"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={() => {
            if (user) {
              setFormData({
                email: user.email || "",
                phone: (user as any).phone || "",
                clinic_name: "",
                clinic_email: "",
                clinic_phone: "",
              })
              if (user.clinic_id) {
                loadClinicDetails()
              }
            }
          }}>
            Reset
          </Button>
        </div>
      </form>
    </div>
  )
}
