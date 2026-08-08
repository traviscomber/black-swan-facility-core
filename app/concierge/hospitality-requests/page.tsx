"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ClipboardList, MapPin, Phone, Smartphone, User } from "lucide-react"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface HospitalityRequest {
  id: string
  guest_name: string
  guest_phone?: string
  guest_email?: string
  category: string
  description?: string
  priority: string
  status: string
  room_id: string
  location_id: string
  room?: { room_number: string }
  location?: { id: string; name: string }
  created_at: string
  completed_at?: string
  notes?: string
  assigned_to?: string
}

interface Employee {
  id: string
  name: string
  role?: string | null
}

const PRIORITY_COLORS = {
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  normal: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  high: "bg-red-500/10 text-red-500 border-red-500/20",
  urgent: "bg-red-500/15 text-red-500 border-red-500/30",
}

const STATUS_COLORS = {
  pending: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  assigned: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  in_progress: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  blocked: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
}

export default function HospitalityRequestsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [requests, setRequests] = useState<HospitalityRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [selectedRequest, setSelectedRequest] = useState<HospitalityRequest | null>(null)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [notes, setNotes] = useState("")
  const [updating, setUpdating] = useState(false)

  async function loadRequests() {
    setLoading(true)
    try {
      const [requestsResult, employeesResult] = await Promise.all([
        supabase
          .from("hospitality_requests")
          .select(`
            *,
            room:rooms(room_number),
            location:locations(id, name)
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("employees")
          .select("id, name, role")
          .eq("is_active", true)
          .order("name"),
      ])

      if (requestsResult.error) throw requestsResult.error
      if (employeesResult.error) throw employeesResult.error
      setRequests((requestsResult.data ?? []) as HospitalityRequest[])
      setEmployees((employeesResult.data ?? []) as Employee[])
    } catch (error) {
      console.error("Error loading requests:", error)
      toast.error("Failed to load hospitality requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRequests()
    const channel = supabase
      .channel("hospitality-requests-workflow")
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void loadRequests())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [supabase])

  const filteredRequests = useMemo(() => requests.filter((request) => {
    if (statusFilter !== "all" && request.status !== statusFilter) return false
    if (locationFilter !== "all" && request.location_id !== locationFilter) return false
    return true
  }), [locationFilter, requests, statusFilter])

  const locations = useMemo(() => Array.from(
    new Map(
      requests
        .filter((request) => request.location?.id)
        .map((request) => [request.location!.id, request.location!]),
    ).values(),
  ), [requests])

  function openUpdateDialog(request: HospitalityRequest) {
    setSelectedRequest(request)
    setNewStatus(request.status)
    setAssignedTo(request.assigned_to ?? "")
    setNotes(request.notes ?? "")
    setUpdateDialogOpen(true)
  }

  function closeUpdateDialog() {
    setUpdateDialogOpen(false)
    setSelectedRequest(null)
    setNewStatus("")
    setAssignedTo("")
    setNotes("")
  }

  async function handleUpdateRequest() {
    if (!selectedRequest || !newStatus) return

    const effectiveStatus = newStatus === "pending" && assignedTo ? "assigned" : newStatus
    if (["assigned", "in_progress", "completed"].includes(effectiveStatus) && !assignedTo) {
      toast.error("Assign a responsible employee before progressing this request")
      return
    }
    if (effectiveStatus === "blocked" && !notes.trim()) {
      toast.error("Add the blocking reason before marking this request as blocked")
      return
    }
    if (effectiveStatus === "completed" && !notes.trim()) {
      toast.error("Add completion notes before closing this request")
      return
    }

    setUpdating(true)
    try {
      const { error } = await supabase.rpc("update_hospitality_request", {
        p_request_id: selectedRequest.id,
        p_status: effectiveStatus,
        p_assigned_to: assignedTo || null,
        p_priority: null,
        p_department: null,
        p_promised_at: null,
        p_sla_minutes: null,
        p_notes: notes.trim() || null,
        p_blocked_reason: effectiveStatus === "blocked" ? notes.trim() : null,
        p_escalation_reason: null,
        p_evidence_url: null,
        p_completion_notes: effectiveStatus === "completed" ? notes.trim() : null,
        p_guest_confirmed: false,
        p_satisfaction_score: null,
      })

      if (error) throw error
      toast.success("Hospitality request updated")
      closeUpdateDialog()
      await loadRequests()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update request"
      console.error("Error updating request:", error)
      toast.error(message)
    } finally {
      setUpdating(false)
    }
  }

  const stats = {
    pending: requests.filter((request) => request.status === "pending").length,
    inProgress: requests.filter((request) => request.status === "in_progress").length,
    completed: requests.filter((request) => request.status === "completed").length,
    total: requests.length,
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageHeader
          title="Hospitality Requests"
          description="Manage guest requests and service orders"
          icon={ClipboardList}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard value={stats.total} label="Total Requests" className="text-primary" />
          <StatCard value={stats.pending} label="Pending" className="text-blue-500" />
          <StatCard value={stats.inProgress} label="In Progress" className="text-amber-500" />
          <StatCard value={stats.completed} label="Completed" className="text-green-500" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filter by location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No requests match the current filters.</div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <Card key={request.id} className="border-border/50 transition-colors hover:border-border/80">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold capitalize">{request.category}</h3>
                          <Badge className={PRIORITY_COLORS[request.priority as keyof typeof PRIORITY_COLORS] ?? ""}>
                            {request.priority}
                          </Badge>
                          <Badge className={STATUS_COLORS[request.status as keyof typeof STATUS_COLORS] ?? ""}>
                            {STATUS_LABELS[request.status] ?? request.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(request.created_at), "MMM d, yyyy • h:mm a")}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => openUpdateDialog(request)}>Update</Button>
                    </div>

                    <div className="grid gap-2 text-sm md:grid-cols-3">
                      <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span>{request.guest_name}</span></div>
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{request.room?.room_number} • {request.location?.name}</span></div>
                      {request.guest_phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{request.guest_phone}</span></div>}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Responsible: {employees.find((employee) => employee.id === request.assigned_to)?.name ?? "Unassigned"}
                    </p>

                    {request.description && <div className="rounded border border-border/50 bg-secondary/30 p-3"><p className="text-sm">{request.description}</p></div>}
                    {request.notes && <div className="rounded border border-accent/20 bg-accent/10 p-3"><p className="text-sm text-muted-foreground"><strong>Staff Notes:</strong> {request.notes}</p></div>}
                    {request.description?.includes("Tablet ID:") && (
                      <div className="mt-4 border-t border-border/50 pt-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2"><Smartphone className="h-3 w-3" /><span>From: {request.description.split("Tablet ID: ")[1]?.split("\n")[0] || "Unknown"}</span></div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={updateDialogOpen} onOpenChange={(open) => open ? setUpdateDialogOpen(true) : closeUpdateDialog()}>
          <DialogContent>
            <DialogHeader><DialogTitle>Update Hospitality Request</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Responsible employee</label>
                <Select value={assignedTo || undefined} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Assign employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {newStatus === "blocked" ? "Blocking reason" : newStatus === "completed" ? "Completion notes" : "Staff notes"}
                </label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add operational notes..."
                  rows={3}
                  className="bg-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeUpdateDialog} disabled={updating}>Cancel</Button>
              <Button onClick={() => void handleUpdateRequest()} disabled={updating} className="bg-primary">
                {updating ? "Updating..." : "Update Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

function StatCard({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className={`text-3xl font-bold ${className}`}>{value}</div>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
