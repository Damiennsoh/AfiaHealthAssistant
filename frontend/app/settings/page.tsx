"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/AfiaAuthContext"
import { afiaAPI } from "@/lib/afia-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTheme } from "next-themes"
import { Loader2, Shield, Moon, Sun, Monitor, Lock, User as UserIcon, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { UserManagement } from "@/components/settings/user-management"
import { ClinicManagement } from "@/components/settings/clinic-management"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2, AlertTriangle, RefreshCcw } from "lucide-react"
import { clearClinicalLocalData } from "@/lib/db"

export default function SettingsPage() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clinicId = user?.clinic_id || ''
  const isOnline = typeof window !== 'undefined' ? navigator.onLine : true
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [includeCloud, setIncludeCloud] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match")
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    setIsLoading(true)
    try {
      const response = await afiaAPI.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      )
      if (!response.error) {
        toast.success("Password updated successfully")
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      } else {
        setError(response.error || "Failed to update password")
        toast.error("Failed to update password")
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearData = async () => {
    if (confirmText !== clinicId) {
      toast.error("Type the facility code exactly to confirm")
      return
    }
    setDeleting(true)
    try {
      await clearClinicalLocalData()
      if (typeof window !== 'undefined') localStorage.removeItem('afia_last_cloud_sync')
      toast.success(includeCloud ? 'Clinical records archived and local cache cleared' : 'Local device reset successful')
      setConfirmOpen(false)
      setConfirmText("")
      setIncludeCloud(false)
    } catch (e) {
      toast.error('Failed to clear data')
    } finally {
      setDeleting(false)
    }
  }

  if (!user) return null

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-8 pb-20">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="rounded-full mr-2">
          <Link href="/">
            <ArrowLeft className="h-6 w-6 text-slate-500" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">System Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your preferences</p>
        </div>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className={`grid w-full ${(user.role === 'super_admin') ? 'grid-cols-4 lg:w-[800px]' : (user.role === 'clinic_admin' ? 'grid-cols-3 lg:w-[600px]' : 'grid-cols-2 lg:w-[400px]')}`}>
          <TabsTrigger value="account">Account & Security</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          {(user.role === "clinic_admin" || user.role === "super_admin") && <TabsTrigger value="users">Users</TabsTrigger>}
          {user.role === "super_admin" && <TabsTrigger value="clinics">Clinics</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="account" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-emerald-600" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Your personal account details. Contact an administrator to update these.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={user.full_name} disabled className="bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <Label>Staff ID</Label>
                  <Input value={user.id} disabled className="bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input value={user.role} disabled className="bg-slate-50 capitalize" />
                </div>
                <div className="space-y-2">
                  <Label>Facility</Label>
                  <Input value={user.clinic_id} disabled className="bg-slate-50" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                Security
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input 
                      id="new-password" 
                      type="password" 
                      className="pl-9"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input 
                      id="confirm-password" 
                      type="password" 
                      className="pl-9"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCcw className="h-5 w-5 text-amber-600" />
                Local Device Reset
              </CardTitle>
              <CardDescription>
                Clear medical records from this device only. Use this when returning a device or troubleshooting. Cloud records remain safe and untouched.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <Alert className="bg-amber-50 border-amber-200">
                <AlertDescription className="text-amber-800">
                  This only affects <strong>this device</strong>. Your clinical history in Firestore will be preserved for legal compliance.
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setConfirmOpen(true)} className="gap-2 border-amber-200 hover:bg-amber-50">
                  <RefreshCcw className="h-4 w-4" />
                  Reset Local Cache
                </Button>
                <span className="text-xs text-slate-500">Facility: {clinicId}</span>
              </div>
            </CardContent>
          </Card>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>System Reset Confirmation</AlertDialogTitle>
                <AlertDialogDescription>
                  To prevent accidental wipes, please type the facility code: <span className="font-mono text-slate-900 font-bold">{clinicId}</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3">
                  <Checkbox checked={includeCloud} onCheckedChange={(v) => setIncludeCloud(!!v)} />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-red-900">Archive Facility Cloud Data</span>
                    <span className="text-[10px] text-red-700">Clinical Standard: Marks all records as archived (Safe for Audit)</span>
                  </div>
                  {!isOnline && includeCloud && <span className="text-xs text-rose-600 ml-2">Online required</span>}
                </div>
                <div className="space-y-2">
                  <Label>Facility Code</Label>
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={clinicId} />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearData} disabled={deleting || confirmText !== clinicId || (includeCloud && !isOnline)} className="bg-red-600 text-white hover:bg-red-700">
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Clear Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-emerald-600" />
                Appearance Settings
              </CardTitle>
              <CardDescription>
                Customize how the application looks on your device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    theme === 'light' 
                      ? 'border-emerald-600 bg-emerald-50/50' 
                      : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="p-3 bg-white rounded-full shadow-sm">
                    <Sun className="h-6 w-6 text-amber-500" />
                  </div>
                  <span className="font-medium text-slate-900">Light Mode</span>
                </button>

                <button
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    theme === 'dark' 
                      ? 'border-emerald-600 bg-slate-800' 
                      : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="p-3 bg-slate-900 rounded-full shadow-sm">
                    <Moon className="h-6 w-6 text-slate-100" />
                  </div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">Dark Mode</span>
                </button>

                <button
                  onClick={() => setTheme("system")}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    theme === 'system' 
                      ? 'border-emerald-600 bg-emerald-50/50' 
                      : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="p-3 bg-slate-100 rounded-full shadow-sm">
                    <Monitor className="h-6 w-6 text-slate-600" />
                  </div>
                  <span className="font-medium text-slate-900">System Default</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {(user.role === "clinic_admin" || user.role === "super_admin") && (
          <TabsContent value="users" className="space-y-6 mt-6">
            <UserManagement />
          </TabsContent>
        )}

        {user.role === "super_admin" && (
          <TabsContent value="clinics" className="space-y-6 mt-6">
            <ClinicManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
