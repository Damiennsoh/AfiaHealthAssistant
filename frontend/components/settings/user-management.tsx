"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AfiaAuthContext"
import { afiaAPI } from "@/lib/afia-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Trash2, Shield, ShieldCheck, ShieldAlert, UserPlus, MoreVertical, X } from "lucide-react"
import { toast } from "sonner"
import CreateAccountForm from "@/components/auth/CreateAccountForm"

interface ApiUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  clinic_id?: string;
  staff_id?: string;
  department?: string;
}

export function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ApiUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<ApiUser | null>(null)
  const [deletionReason, setDeletionReason] = useState("")

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await afiaAPI.listUsers(currentUser?.clinic_id)
      if (response.data) {
        setUsers(response.data as ApiUser[])
      } else {
        setError("Failed to load users")
      }
    } catch (err) {
      setError("An error occurred while loading users")
    } finally {
      setIsLoading(false)
    }
  }, [currentUser?.clinic_id])

  useEffect(() => {
    if (currentUser) {
      fetchUsers()
    }
  }, [fetchUsers, currentUser])

  const handleDelete = async (userId: string, reason: string) => {
    if (currentUser?.role !== "clinic_admin" && currentUser?.role !== "super_admin") {
      toast.error("Access Denied: Only administrators can delete users.")
      return
    }

    // Clinical admins can only delete users from their own clinic
    if (currentUser?.role === "clinic_admin") {
      const userToDelete = users.find(u => u.id === userId)
      if (userToDelete?.clinic_id !== currentUser?.clinic_id) {
        toast.error("Access Denied: You can only manage users from your clinic.")
        return
      }
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for deletion")
      return
    }

    try {
      const response = await afiaAPI.deactivateUser(userId, { reason })
      if (response.status === 200 || response.status === 204) {
        toast.success("User deactivated successfully")
        setDeleteDialogOpen(false)
        setUserToDelete(null)
        setDeletionReason("")
        fetchUsers()
      } else {
        toast.error(response.error || "Failed to deactivate user")
      }
    } catch (err) {
      toast.error("An error occurred")
    }
  }

  const openDeleteDialog = (user: ApiUser) => {
    setUserToDelete(user)
    setDeletionReason("")
    setDeleteDialogOpen(true)
  }

  const handleToggleAdmin = async (userToUpdate: ApiUser) => {
    if (currentUser?.role !== "clinic_admin" && currentUser?.role !== "super_admin") {
      toast.error("Access Denied: Only administrators can modify roles.")
      return
    }

    // Clinical admins can only modify roles of users from their own clinic
    if (currentUser?.role === "clinic_admin") {
      if (userToUpdate.clinic_id !== currentUser?.clinic_id) {
        toast.error("Access Denied: You can only manage users from your clinic.")
        return
      }
    }

    const newRole = userToUpdate.role === "clinic_admin" ? "healthworker" : "clinic_admin"
    try {
      const response = await afiaAPI.updateUser(userToUpdate.id, { role: newRole })
      if (response.data) {
        toast.success(`User role updated to ${newRole}`)
        fetchUsers()
      } else {
        toast.error(response.error || "Failed to update role")
      }
    } catch (err) {
      toast.error("An error occurred")
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage registered users and their roles for your clinic.
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Staff Account</DialogTitle>
              <DialogDescription>
                Create a new account for a staff member at this facility.
              </DialogDescription>
            </DialogHeader>
            <CreateAccountForm 
              onSuccess={() => {
                setIsDialogOpen(false);
                fetchUsers();
              }}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.staff_id || '-'}</TableCell>
                    <TableCell>{u.department || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "clinic_admin" || u.role === "super_admin" ? "default" : "secondary"}>
                        {u.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {currentUser?.id !== u.id && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleAdmin(u)}
                            title={u.role === "clinic_admin" ? "Remove Admin Access" : "Grant Admin Access"}
                          >
                            {u.role === "clinic_admin" ? (
                              <ShieldAlert className="h-4 w-4 text-orange-500" />
                            ) : (
                              <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(u)}
                            title="Deactivate User"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {users.map((u) => (
              <Card key={u.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{u.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant={u.role === "clinic_admin" || u.role === "super_admin" ? "default" : "secondary"}>
                    {u.role.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Staff ID:</span>
                    <span className="ml-1">{u.staff_id || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Department:</span>
                    <span className="ml-1">{u.department || '-'}</span>
                  </div>
                </div>
                {currentUser?.id !== u.id && (
                  <div className="flex gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleToggleAdmin(u)}
                    >
                      {u.role === "clinic_admin" ? (
                        <><ShieldAlert className="h-4 w-4 mr-2 text-orange-500" />Remove Admin</>
                      ) : (
                        <><ShieldCheck className="h-4 w-4 mr-2 text-emerald-500" />Make Admin</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => openDeleteDialog(u)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />Deactivate
                    </Button>
                  </div>
                )}
              </Card>
            ))}
            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No users found.
              </div>
            )}
          </div>
        </div>

        {/* Deletion Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Deactivate User Account</DialogTitle>
              <DialogDescription>
                For compliance purposes, please provide a reason for deactivating this user account. This action will be logged.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {userToDelete && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="font-medium">{userToDelete.full_name}</p>
                  <p className="text-sm text-muted-foreground">{userToDelete.email}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="deletion-reason">Reason for Deactivation *</Label>
                <Input
                  id="deletion-reason"
                  placeholder="e.g., Staff resignation, role change, policy violation"
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This reason will be recorded in the audit log for compliance tracking.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => userToDelete && handleDelete(userToDelete.id, deletionReason)}
                disabled={!deletionReason.trim()}
              >
                Deactivate Account
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
