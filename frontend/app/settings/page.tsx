"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/AfiaAuthContext"
import { useSync } from "@/contexts/SyncContext"
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
import { Trash2, AlertTriangle, RefreshCcw } from "lucide-react"
import { auditDB, clearClinicalLocalData, getLegacyCacheSummary, migrateLegacyCacheToActiveClinic } from "@/lib/db"
import { syncService } from "@/lib/afia-sync"
import { OfflineSyncManager } from "@/lib/sync-manager"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth()
  const { syncToCloud } = useSync()
  const { theme, setTheme } = useTheme()

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(typeof window === 'undefined' ? true : navigator.onLine)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [legacyCache, setLegacyCache] = useState({ patients: 0, encounters: 0 })
  const [legacyImportOpen, setLegacyImportOpen] = useState(false)
  const [legacyPassword, setLegacyPassword] = useState("")
  const [legacyConfirmation, setLegacyConfirmation] = useState("")
  const [importingLegacy, setImportingLegacy] = useState(false)
  const [facilityDisplayName, setFacilityDisplayName] = useState("")

  useEffect(() => {
    if (user?.id) void refreshUser()
  }, [user?.id, refreshUser])

  useEffect(() => {
    const clinicName = typeof user?.clinic_name === "string" ? user.clinic_name.trim() : ""
    setFacilityDisplayName(clinicName)

    if (user?.role === "super_admin" || !user?.clinic_id || !UUID_PATTERN.test(clinicName)) return

    let cancelled = false
    void afiaAPI.getClinic(String(user.clinic_id)).then((response) => {
      if (cancelled) return
      const clinic = response.data
      const name = typeof clinic?.name === "string" ? clinic.name.trim() : ""
      const code = typeof clinic?.code === "string" ? clinic.code.trim() : ""
      setFacilityDisplayName(
        name && !UUID_PATTERN.test(name)
          ? name
          : code && !UUID_PATTERN.test(code)
            ? code
            : "Facility name unavailable"
      )
    }).catch(() => {
      if (!cancelled) setFacilityDisplayName("Facility name unavailable")
    })

    return () => { cancelled = true }
  }, [user?.clinic_id, user?.clinic_name, user?.role])

  useEffect(() => {
    if (user?.role !== "clinic_admin") return
    getLegacyCacheSummary().then(setLegacyCache).catch((error) => {
      console.warn("Could not inspect the previous local cache:", error)
    })
  }, [user?.role])

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match")
      return
    }

    if (!passwordForm.currentPassword) {
      setError("Enter your current password to confirm your identity")
      return
    }

    if (passwordForm.newPassword.length < 12) {
      setError("New password must be at least 12 characters long")
      return
    }
    if (!/[A-Z]/.test(passwordForm.newPassword) || !/[a-z]/.test(passwordForm.newPassword) ||
        !/[0-9]/.test(passwordForm.newPassword) || !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(passwordForm.newPassword)) {
      setError("Use at least 12 characters with uppercase, lowercase, a number, and a special character")
      return
    }

    setIsLoading(true)
    try {
      if (!isOnline) throw new Error("You must be online to update your account password.")
      const response = await afiaAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      if (response.error) throw new Error(String(response.error))
      if (!(response.data as { success?: boolean } | undefined)?.success) {
        throw new Error("The server did not confirm the password change.")
      }
      toast.success("Password updated successfully")
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearData = async () => {
    if (confirmText !== "RESET LOCAL DATA") {
      toast.error('Type "RESET LOCAL DATA" exactly to confirm')
      return
    }
    if (!isOnline) {
      toast.error("Connect to the facility server before resetting this device, so unsynced records are not lost.")
      return
    }
    const legacySummary = await getLegacyCacheSummary()
    if (legacySummary.patients || legacySummary.encounters) {
      toast.error("The old shared cache still contains records. It may include another facility's data, so this facility-only reset will not delete it. Reconcile it through the legacy-cache migration or have the device securely decommissioned.")
      return
    }
    setDeleting(true)
    try {
      await syncToCloud()
      await afiaAPI.syncPendingAuditEvents()
      const unsyncedChanges = syncService.getQueuedChanges().filter((change) => change.status !== "synced")
      const legacyUnresolvedCount = await new OfflineSyncManager().getUnresolvedCount()
      const legacyUnscopedCount = syncService.getLegacyUnscopedPendingCount()
      const pendingAuditEvents = await auditDB.getPending()
      if (unsyncedChanges.length || legacyUnresolvedCount || legacyUnscopedCount || pendingAuditEvents.length) {
        throw new Error("Clinical changes remain unresolved, including changes in the old unscoped queue. Do not reset this device; reconnect with the original facility account or contact support to safely reconcile them.")
      }
      await clearClinicalLocalData()
      syncService.clearQueue()
      if (typeof window !== 'undefined') localStorage.removeItem('afia_sync_queue')
      await new OfflineSyncManager().clearQueue()
      if (typeof window !== 'undefined') {
        localStorage.removeItem('afia_last_cloud_sync')
        localStorage.removeItem('afia_last_sync')
      }
      toast.success("Local clinical cache cleared. No records were deleted from the facility server.")
      setConfirmOpen(false)
      setConfirmText("")
      await logout()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to clear data')
    } finally {
      setDeleting(false)
    }
  }

  const handleLegacyImport = async () => {
    const facilityName = String(user?.clinic_name || "").trim()
    if (!facilityName || legacyConfirmation !== facilityName) {
      toast.error("Type the facility name exactly to confirm ownership of the old cache.")
      return
    }
    if (!legacyPassword || !isOnline) {
      toast.error("Enter the password used to encrypt the old cache and connect to the facility server first.")
      return
    }

    setImportingLegacy(true)
    try {
      const imported = await migrateLegacyCacheToActiveClinic(legacyPassword)
      toast.success(`Copied ${imported.patients} patient and ${imported.encounters} encounter record(s). The old cache was retained.`)
      setLegacyImportOpen(false)
      setLegacyPassword("")
      setLegacyConfirmation("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Legacy cache import failed")
    } finally {
      setImportingLegacy(false)
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
                  <Input value={user.full_name || user.name || user.email || "Name unavailable"} disabled className="bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <Label>Staff ID</Label>
                  <Input value={user.staff_id && user.staff_id !== user.id ? user.staff_id : "Not assigned"} disabled className="bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input value={String(user.role || "").replaceAll("_", " ")} disabled className="bg-slate-50 capitalize" />
                </div>
                <div className="space-y-2">
                  <Label>{user.role === "super_admin" ? "Access Scope" : "Facility"}</Label>
                  <Input
                    value={user.role === "super_admin" ? "Global — all facilities" : (facilityDisplayName || "Facility unavailable")}
                    disabled
                    className="bg-slate-50"
                  />
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
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      className="pl-9"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input 
                      id="new-password" 
                      type="password" 
                      autoComplete="new-password"
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
                      autoComplete="new-password"
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
          
          {user.role === "clinic_admin" && <>
          {(legacyCache.patients > 0 || legacyCache.encounters > 0) && <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="text-amber-800">Previous local cache found</CardTitle>
              <CardDescription>
                This browser has {legacyCache.patients} patient and {legacyCache.encounters} encounter record(s) in the old, unpartitioned cache. They are not copied automatically because the old cache has no reliable facility ownership tag.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertDescription className="text-amber-900">
                  Import only if you are certain every record in that old cache belongs to {user.clinic_name || "this facility"}. The old source is retained after import. This imports patients and encounters only.
                </AlertDescription>
              </Alert>
              <Button variant="outline" onClick={() => setLegacyImportOpen(true)} disabled={!isOnline}>
                Review and Import Previous Cache
              </Button>
            </CardContent>
          </Card>}

          <AlertDialog open={legacyImportOpen} onOpenChange={setLegacyImportOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm old-cache ownership</AlertDialogTitle>
                <AlertDialogDescription>
                  This copies legacy patients and encounters into {user.clinic_name || "this facility"}&apos;s isolated local cache. It does not upload or delete records. Only continue if the entire old cache belongs to this facility.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="legacy-cache-password">Password used for the old local cache</Label>
                  <Input id="legacy-cache-password" type="password" autoComplete="current-password" value={legacyPassword} onChange={(event) => setLegacyPassword(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legacy-cache-confirm">Type the facility name: {user.clinic_name}</Label>
                  <Input id="legacy-cache-confirm" value={legacyConfirmation} onChange={(event) => setLegacyConfirmation(event.target.value)} />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={importingLegacy}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleLegacyImport() }} disabled={importingLegacy || !isOnline}>
                  {importingLegacy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Copy legacy records
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCcw className="h-5 w-5 text-amber-600" />
                Local Device Reset
              </CardTitle>
              <CardDescription>
                Clear this facility&apos;s isolated clinical cache from this browser. This does not delete server records or other facilities&apos; local caches.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <Alert className="bg-amber-50 border-amber-200">
                <AlertDescription className="text-amber-800">
                  This affects only <strong>{user.clinic_name || "this facility"}&apos;s isolated cache</strong>. Synced clinical records remain in Neon. Unsynced activity must be resolved first. A detected legacy shared cache is retained until its ownership and records are safely reconciled.
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setConfirmOpen(true)} disabled={legacyCache.patients > 0 || legacyCache.encounters > 0} className="gap-2 border-amber-200 hover:bg-amber-50">
                  <RefreshCcw className="h-4 w-4" />
                  Reset Local Cache
                </Button>
                <span className="text-xs text-slate-500">Facility: {user.clinic_name || "Your facility"}</span>
              </div>
            </CardContent>
          </Card>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>System Reset Confirmation</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears only {user.clinic_name || "this facility"}&apos;s isolated local cache and signs you out. It does not delete server records, other facility caches, or legacy shared data. Type <span className="font-mono text-slate-900 font-bold">RESET LOCAL DATA</span> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Confirmation phrase</Label>
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESET LOCAL DATA" />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleClearData() }} disabled={deleting || confirmText !== "RESET LOCAL DATA" || !isOnline} className="bg-red-600 text-white hover:bg-red-700">
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Clear Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </>}
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
