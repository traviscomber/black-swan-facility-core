"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ClipboardList, User, MapPin, Phone } from "lucide-react"
import { format } from "date-fns"

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
  location?: { name: string }
  created_at: string
  completed_at?: string
  notes?: string
  assigned_to?: string
}

const PRIORITY_COLORS = {
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  normal: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  high: "bg-red-500/10 text-red-500 border-red-500/20",
}

const STATUS_COLORS = {
  pending: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  in_progress: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  declined: "bg-red-500/10 text-red-500 border-red-500/20",
}

export default function HospitalityRequestsPage() {
  const [requests, setRequests] = useState<HospitalityRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<HospitalityRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedRequest, setSelectedRequest] = useState<HospitalityRequest | null>(null)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState("")
  const [notes, setNotes] = useState("")
  const [updating, setUpdating] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadRequests()
  }, [])

  useEffect(() => {
    filterRequests()
  }, [requests, statusFilter])

  async function loadRequests() {
    try {
      const { data, error } = await supabase
        .from("hospitality_requests")
        .select(`
          *,
          room:rooms(room_number),
          location:locations(name)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setRequests(data || [])
    } catch (error) {
      console.error("Error loading requests:", error)
    } finally {
      setLoading(false)
    }
  }

  function filterRequests() {
    if (statusFilter === "all") {
      setFilteredRequests(requests)
    } else {
      setFilteredRequests(requests.filter((r) => r.status === statusFilter))
    }
  }

  async function handleUpdateRequest() {
    if (!selectedRequest || !newStatus) return

    setUpdating(true)
    try {
      const { error } = await supabase
        .from("hospitality_requests")
        .update({
          status: newStatus,
          notes: notes,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id)

      if (error) throw error

      setUpdateDialogOpen(false)
      setSelectedRequest(null)
      setNewStatus("")
      setNotes("")
      loadRequests()
    } catch (error) {
      console.error("Error updating request:", error)
      alert("Failed to update request")
    } finally {
      setUpdating(false)
    }
  }

  const stats = {
    pending: requests.filter((r) => r.status === "pending").length,
    in_progress: requests.filter((r) => r.status === "in_progress").length,
    completed: requests.filter((r) => r.status === "completed").length,
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

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{stats.total}</div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">{stats.pending}</div>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-500">{stats.in_progress}</div>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500">{stats.completed}</div>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {statusFilter === "all" ? "No requests yet" : `No ${statusFilter} requests`}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <Card key={request.id} className="border-border/50 hover:border-border/80 transition-colors">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg capitalize">{request.category}</h3>
                          <Badge className={`${PRIORITY_COLORS[request.priority as keyof typeof PRIORITY_COLORS]}`}>
                            {request.priority}
                          </Badge>
                          <Badge className={`${STATUS_COLORS[request.status as keyof typeof STATUS_COLORS]}`}>
                            {request.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(request.created_at), "MMM d, yyyy • h:mm a")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (request.status !== "in_progress" && newStatus === "in_progress") {
                            const whatsappMessage = `✅ *Request Started*\n\n👤 Guest: ${request.guest_name}\n📋 ${request.category}\n🛏️ Room: ${request.room?.room_number}\n\nOur team is now working on your request.`

                            fetch("/api/send-whatsapp", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                to: "+56979752758", // Updated to Antonia Valencia's WhatsApp
                                message: whatsappMessage,
                              }),
                            })
                          }

                          setSelectedRequest(request)
                          setNewStatus(request.status)
                          setNotes(request.notes || "")
                          setUpdateDialogOpen(true)
                        }}
                      >
                        Update
                      </Button>
                    </div>

                    {/* Guest Info */}
                    <div className="grid gap-2 md:grid-cols-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{request.guest_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {request.room?.room_number} • {request.location?.name}
                        </span>
                      </div>
                      {request.guest_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{request.guest_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {request.description && (
                      <div className="p-3 bg-secondary/30 rounded border border-border/50">
                        <p className="text-sm">{request.description}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {request.notes && (
                      <div className="p-3 bg-accent/10 rounded border border-accent/20">
                        <p className="text-sm text-muted-foreground">
                          <strong>Staff Notes:</strong> {request.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Update Dialog */}
        <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Request Status</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Staff Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this request..."
                  rows={3}
                  className="bg-input"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setUpdateDialogOpen(false)} disabled={updating}>
                Cancel
              </Button>
              <Button onClick={handleUpdateRequest} disabled={updating} className="bg-primary">
                {updating ? "Updating..." : "Update Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
