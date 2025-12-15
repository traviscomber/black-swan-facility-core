"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { AlertTriangle, MapPin, User, Clock, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"

interface Incident {
  id: string
  severity: "low" | "medium" | "high" | "critical"
  title: string
  description: string | null
  status: "open" | "in_progress" | "resolved" | "closed"
  reported_by: string | null
  created_at: string
  resolved_at: string | null
  rooms: {
    id: string
    room_number: string
  } | null
  employees: {
    id: string
    name: string
  } | null
}

const severityColors = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
}

const statusColors = {
  open: "destructive",
  in_progress: "default",
  resolved: "secondary",
  closed: "outline",
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadIncidents()
  }, [])

  async function loadIncidents() {
    const supabase = createBrowserClient()
    const { data } = await supabase
      .from("incidents")
      .select(
        `
        *,
        rooms(id, room_number),
        employees(id, name)
      `,
      )
      .order("created_at", { ascending: false })

    setIncidents(data || [])
    setLoading(false)
  }

  async function updateIncidentStatus(incidentId: string, newStatus: string) {
    const supabase = createBrowserClient()
    const updateData: any = { status: newStatus }

    if (newStatus === "resolved" || newStatus === "closed") {
      updateData.resolved_at = new Date().toISOString()
    }

    const { error } = await supabase.from("incidents").update(updateData).eq("id", incidentId)

    if (!error) {
      loadIncidents()
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident({ ...selectedIncident, status: newStatus as any, ...updateData })
      }
    }
  }

  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter === "all") return true
    return inc.status === statusFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incident Management</h1>
          <p className="text-muted-foreground">Track and resolve facility issues</p>
        </div>
        <Button>
          <AlertTriangle className="h-4 w-4 mr-2" />
          Report Incident
        </Button>
      </div>

      {/* Filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>

      {/* Incidents Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Incident List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="text-muted-foreground">Loading incidents...</div>
          ) : filteredIncidents.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">No incidents found</CardContent>
            </Card>
          ) : (
            filteredIncidents.map((incident) => (
              <Card
                key={incident.id}
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  selectedIncident?.id === incident.id ? "border-primary" : ""
                }`}
                onClick={() => setSelectedIncident(incident)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`h-5 w-5 ${
                          incident.severity === "critical"
                            ? "text-red-600"
                            : incident.severity === "high"
                              ? "text-orange-600"
                              : "text-yellow-600"
                        }`}
                      />
                      <h3 className="font-semibold">{incident.title}</h3>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={severityColors[incident.severity]}>{incident.severity}</Badge>
                      <Badge variant={statusColors[incident.status] as any}>{incident.status.replace("_", " ")}</Badge>
                    </div>
                  </div>

                  {incident.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{incident.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {incident.rooms && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{incident.rooms.room_number}</span>
                      </div>
                    )}
                    {incident.employees && (
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{incident.employees.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{format(new Date(incident.created_at), "MMM d")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Incident Detail Panel */}
        <div className="lg:col-span-1">
          {selectedIncident ? (
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Incident Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Title</div>
                  <div>{selectedIncident.title}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Description</div>
                  <div className="text-sm">{selectedIncident.description || "No description"}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Severity</div>
                  <Badge className={severityColors[selectedIncident.severity]}>{selectedIncident.severity}</Badge>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  <Select
                    value={selectedIncident.status}
                    onValueChange={(v) => updateIncidentStatus(selectedIncident.id, v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedIncident.rooms && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Location</div>
                    <div>{selectedIncident.rooms.room_number}</div>
                  </div>
                )}

                {selectedIncident.employees && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Assigned To</div>
                    <div>{selectedIncident.employees.name}</div>
                  </div>
                )}

                {selectedIncident.reported_by && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Reported By</div>
                    <div>{selectedIncident.reported_by}</div>
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Created</div>
                  <div>{format(new Date(selectedIncident.created_at), "PPp")}</div>
                </div>

                {selectedIncident.resolved_at && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Resolved</div>
                    <div>{format(new Date(selectedIncident.resolved_at), "PPp")}</div>
                  </div>
                )}

                <div className="pt-4 space-y-2">
                  {selectedIncident.status === "open" && (
                    <Button className="w-full" onClick={() => updateIncidentStatus(selectedIncident.id, "in_progress")}>
                      Start Working
                    </Button>
                  )}
                  {(selectedIncident.status === "open" || selectedIncident.status === "in_progress") && (
                    <Button
                      variant="outline"
                      className="w-full bg-transparent"
                      onClick={() => updateIncidentStatus(selectedIncident.id, "resolved")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Resolved
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Select an incident to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
