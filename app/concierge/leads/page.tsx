"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { Phone, Calendar, Users, MapPin, MessageSquare, CheckCircle2, XCircle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

interface Lead {
  id: string
  phone: string
  name: string | null
  stage: string
  dates_requested: string | null
  checkin: string | null
  checkout: string | null
  num_guests: number | null
  unit_preference: string | null
  pets: boolean
  notes: string | null
  last_msg_at: string
  created_at: string
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeads()
  }, [])

  useEffect(() => {
    filterLeads()
  }, [searchQuery, stageFilter, leads])

  async function loadLeads() {
    const supabase = createBrowserClient()
    const { data } = await supabase.from("leads").select("*").order("last_msg_at", { ascending: false })

    setLeads(data || [])
    setLoading(false)
  }

  function filterLeads() {
    let filtered = leads

    if (stageFilter !== "all") {
      filtered = filtered.filter((lead) => lead.stage === stageFilter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (lead) =>
          lead.phone.toLowerCase().includes(query) ||
          lead.name?.toLowerCase().includes(query) ||
          lead.notes?.toLowerCase().includes(query),
      )
    }

    setFilteredLeads(filtered)
  }

  async function updateLeadStage(leadId: string, newStage: string) {
    const supabase = createBrowserClient()
    const { error } = await supabase.from("leads").update({ stage: newStage }).eq("id", leadId)

    if (!error) {
      loadLeads()
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, stage: newStage })
      }
    }
  }

  async function convertToReservation(lead: Lead) {
    // This would typically open a dialog to create a reservation
    // For now, just update stage
    await updateLeadStage(lead.id, "converted")
    alert("Lead converted! Create the reservation in the Bookings section.")
  }

  const getStageBadge = (stage: string) => {
    const variants: Record<string, any> = {
      new: "default",
      qualified: "secondary",
      contacted: "outline",
      converted: "default",
      lost: "destructive",
    }
    return <Badge variant={variants[stage] || "secondary"}>{stage}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Management</h1>
          <p className="text-muted-foreground">WhatsApp inquiries & booking requests</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search by phone, name, or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Leads Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Leads List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="text-muted-foreground">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">No leads found</CardContent>
            </Card>
          ) : (
            filteredLeads.map((lead) => (
              <Card
                key={lead.id}
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  selectedLead?.id === lead.id ? "border-primary" : ""
                }`}
                onClick={() => setSelectedLead(lead)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{lead.phone}</span>
                        {getStageBadge(lead.stage)}
                      </div>

                      {lead.name && (
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{lead.name}</span>
                        </div>
                      )}

                      {lead.dates_requested && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{lead.dates_requested}</span>
                          {lead.num_guests && <span>• {lead.num_guests} guests</span>}
                        </div>
                      )}

                      {lead.unit_preference && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{lead.unit_preference}</span>
                        </div>
                      )}

                      {lead.notes && <p className="text-sm text-muted-foreground line-clamp-2">{lead.notes}</p>}
                    </div>

                    <div className="text-xs text-muted-foreground">{format(new Date(lead.last_msg_at), "MMM d")}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Lead Detail Panel */}
        <div className="lg:col-span-1">
          {selectedLead ? (
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Lead Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Phone</div>
                  <div className="flex items-center justify-between">
                    <span>{selectedLead.phone}</span>
                    <a
                      href={`https://wa.me/${selectedLead.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <Button size="sm" variant="outline">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        WhatsApp
                      </Button>
                    </a>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Stage</div>
                  <Select value={selectedLead.stage} onValueChange={(v) => updateLeadStage(selectedLead.id, v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedLead.name && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Name</div>
                    <div>{selectedLead.name}</div>
                  </div>
                )}

                {selectedLead.dates_requested && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Dates Requested</div>
                    <div>{selectedLead.dates_requested}</div>
                  </div>
                )}

                {selectedLead.num_guests && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Guests</div>
                    <div>{selectedLead.num_guests}</div>
                  </div>
                )}

                {selectedLead.unit_preference && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Unit Preference</div>
                    <div>{selectedLead.unit_preference}</div>
                  </div>
                )}

                {selectedLead.notes && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Notes</div>
                    <div className="text-sm">{selectedLead.notes}</div>
                  </div>
                )}

                <div className="pt-4 space-y-2">
                  {selectedLead.stage !== "converted" && (
                    <Button className="w-full" onClick={() => convertToReservation(selectedLead)}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Convert to Booking
                    </Button>
                  )}
                  <Link href="/concierge/messages" className="block">
                    <Button variant="outline" className="w-full bg-transparent">
                      View Conversation
                    </Button>
                  </Link>
                  {selectedLead.stage === "new" && (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => updateLeadStage(selectedLead.id, "lost")}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Mark as Lost
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Select a lead to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
