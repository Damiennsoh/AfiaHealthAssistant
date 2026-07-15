"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Download, Search, Filter, FileText } from "lucide-react"
import { useAuth } from "@/contexts/AfiaAuthContext"
import { afiaAPI } from "@/lib/afia-api"
import { toast } from "sonner"

interface AuditLog {
  id: string
  user_email: string | null
  user_role: string | null
  clinic_name: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, any>
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  clinic_suspended: "Clinic Suspended",
  clinic_unsuspended: "Clinic Unsuspended",
  clinic_archived: "Clinic Archived",
  clinic_deleted: "Clinic Deleted",
  clinic_updated: "Clinic Updated",
  user_created: "User Created",
  user_deleted: "User Deleted",
  patient_created: "Patient Created",
  patient_updated: "Patient Updated",
  patient_read: "Patient Viewed",
  encounter_created: "Encounter Created",
  encounter_updated: "Encounter Updated",
  encounter_read: "Encounter Viewed",
  staff_added: "Staff Added",
  staff_deleted: "Staff Deleted",
}

const ACTION_COLORS: Record<string, string> = {
  clinic_suspended: "bg-yellow-500",
  clinic_unsuspended: "bg-green-500",
  clinic_archived: "bg-gray-500",
  clinic_deleted: "bg-red-500",
  clinic_updated: "bg-blue-500",
  user_created: "bg-green-500",
  user_deleted: "bg-red-500",
  patient_created: "bg-green-500",
  patient_updated: "bg-blue-500",
  patient_read: "bg-gray-500",
  encounter_created: "bg-green-500",
  encounter_updated: "bg-blue-500",
  encounter_read: "bg-gray-500",
  staff_added: "bg-green-500",
  staff_deleted: "bg-red-500",
}

export default function AuditLogsPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [search, setSearch] = useState("")
  const [action, setAction] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Check permissions
  if (user?.role === "healthworker") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to view audit logs.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const loadLogs = async (resetOffset = false) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const currentOffset = resetOffset ? 0 : offset
      const response = await afiaAPI.getAuditLogs({
        search: search || undefined,
        action: action || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        offset: currentOffset,
        limit: 50,
      })
      
      if (resetOffset) {
        setLogs(response.data || [])
        setOffset(0)
      } else {
        setLogs(prev => [...prev, ...(response.data || [])])
      }
      
      setHasMore((response.data?.length || 0) === 50)
      setOffset(currentOffset + (response.data?.length || 0))
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs")
      toast.error("Failed to load audit logs")
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      await afiaAPI.exportAuditLogs({
        search: search || undefined,
        action: action || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      toast.success("Audit logs exported successfully")
    } catch (err: any) {
      toast.error("Failed to export audit logs")
    }
  }

  const handleFilterReset = () => {
    setSearch("")
    setAction("")
    setStartDate("")
    setEndDate("")
    setOffset(0)
    loadLogs(true)
  }

  useEffect(() => {
    loadLogs(true)
  }, [])

  const handleSearch = () => {
    loadLogs(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getActionLabel = (action: string) => {
    return ACTION_LABELS[action] || action.replace(/_/g, " ").toUpperCase()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            {user?.role === "super_admin" 
              ? "View all clinic-level events and changes"
              : "View your clinic's patient, encounter, and staff events"
            }
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Email, clinic, resource..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Search
            </Button>
            <Button onClick={handleFilterReset} variant="outline">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity Log
            <Badge variant="secondary" className="ml-2">
              {logs.length} entries
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-4">
              {error}
            </div>
          )}
          
          {logs.length === 0 && !isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Timestamp</TableHead>
                    <TableHead className="min-w-[120px]">Action</TableHead>
                    <TableHead className="min-w-[150px]">User</TableHead>
                    <TableHead className="min-w-[150px]">Clinic</TableHead>
                    <TableHead className="min-w-[120px]">Resource</TableHead>
                    <TableHead className="min-w-[200px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`${ACTION_COLORS[log.action] || "bg-gray-500"} text-white`}
                        >
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.user_email || "-"}
                        {log.user_role && (
                          <span className="text-muted-foreground text-xs ml-2">
                            ({log.user_role})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.clinic_name || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.resource_type || "-"}
                        {log.resource_id && (
                          <span className="text-muted-foreground text-xs ml-2">
                            ({log.resource_id.slice(0, 8)}...)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <span className="text-muted-foreground">
                            {JSON.stringify(log.details).slice(0, 50)}...
                          </span>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {hasMore && (
            <div className="mt-4 text-center">
              <Button 
                onClick={() => loadLogs(false)} 
                disabled={isLoading}
                variant="outline"
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Load More"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
