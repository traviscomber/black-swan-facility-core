"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Edit, Trash2, Mail, Phone, Star } from "lucide-react"
import { AddGuestDialog } from "@/components/add-guest-dialog"
import { EditGuestDialog } from "@/components/edit-guest-dialog"
import { format } from "date-fns"

interface Guest {
  id: string
  name: string
  email: string
  phone: string
  address: string
  notes: string
  vip_status: boolean
  created_at: string
}

export default function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [guestBookings, setGuestBookings] = useState<Record<string, number>>({})

  const supabase = createBrowserClient()

  useEffect(() => {
    loadGuests()
  }, [])

  useEffect(() => {
    filterGuests()
  }, [searchQuery, guests])

  async function loadGuests() {
    setLoading(true)

    const { data: guestsData } = await supabase.from("guests").select("*").order("name")

    setGuests(guestsData || [])

    // Load booking counts for each guest
    if (guestsData) {
      const bookingCounts: Record<string, number> = {}
      for (const guest of guestsData) {
        const { count } = await supabase
          .from("reservations")
          .select("*", { count: "exact", head: true })
          .eq("guest_name", guest.name)

        bookingCounts[guest.id] = count || 0
      }
      setGuestBookings(bookingCounts)
    }

    setLoading(false)
  }

  function filterGuests() {
    if (!searchQuery) {
      setFilteredGuests(guests)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = guests.filter(
      (guest) =>
        guest.name.toLowerCase().includes(query) ||
        guest.email?.toLowerCase().includes(query) ||
        guest.phone?.toLowerCase().includes(query),
    )
    setFilteredGuests(filtered)
  }

  async function handleDeleteGuest(guestId: string) {
    if (!confirm("Are you sure you want to delete this guest?")) return

    const { error } = await supabase.from("guests").delete().eq("id", guestId)

    if (error) {
      console.error("Error deleting guest:", error)
      alert("Failed to delete guest")
    } else {
      loadGuests()
    }
  }

  function handleEditGuest(guest: Guest) {
    setSelectedGuest(guest)
    setShowEditDialog(true)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">Guest Management</h1>
          <p className="text-sm text-muted-foreground">Manage guest profiles and information</p>
        </div>
        <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Guest
        </Button>
      </div>

      {/* Search Bar */}
      <div className="border-b bg-card px-6 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search guests by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading guests...</div>
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="text-muted-foreground">
              {searchQuery ? "No guests found matching your search" : "No guests yet. Add your first guest!"}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGuests.map((guest) => (
              <Card key={guest.id} className="relative overflow-hidden">
                {guest.vip_status && (
                  <div className="absolute right-4 top-4">
                    <Badge className="gap-1 bg-yellow-500">
                      <Star className="h-3 w-3" />
                      VIP
                    </Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <span className="pr-12">{guest.name}</span>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {guest.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{guest.email}</span>
                      </div>
                    )}
                    {guest.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{guest.phone}</span>
                      </div>
                    )}
                  </div>

                  {guest.address && (
                    <div className="text-sm text-muted-foreground">
                      <div className="font-medium">Address</div>
                      <div className="line-clamp-2">{guest.address}</div>
                    </div>
                  )}

                  {guest.notes && (
                    <div className="text-sm text-muted-foreground">
                      <div className="font-medium">Notes</div>
                      <div className="line-clamp-2">{guest.notes}</div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-semibold">{guestBookings[guest.id] || 0}</span> bookings
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditGuest(guest)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteGuest(guest.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Added {format(new Date(guest.created_at), "MMM d, yyyy")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddGuestDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadGuests} />

      {selectedGuest && (
        <EditGuestDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          guest={selectedGuest}
          onSuccess={loadGuests}
        />
      )}
    </div>
  )
}
