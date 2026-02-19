"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Edit, Trash2, Mail, Phone, Star, FileText, MessageCircle, Building2 } from "lucide-react"
import { AddGuestDialog } from "@/components/add-guest-dialog"
import { EditGuestDialog } from "@/components/edit-guest-dialog"
import { format } from "date-fns"
import { AppLayout } from "@/components/app-layout"
import { useLanguage } from "@/lib/use-language"

interface Guest {
  id: string
  name: string
  email: string
  phone: string
  address: string
  company_name: string // Added company_name field
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
  const { t } = useLanguage()

  useEffect(() => {
    loadGuests()
  }, [])

  useEffect(() => {
    filterGuests()
  }, [searchQuery, guests])

  async function loadGuests() {
    setLoading(true)

    const { data: guestsData } = await supabase
      .from("guests")
      .select(`
        *,
        reservations:reservations(count)
      `)
      .order("name")

    if (guestsData) {
      // Transform the data to extract booking counts
      const transformedGuests = guestsData.map((guest) => ({
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        address: guest.address,
        company_name: guest.company_name,
        notes: guest.notes,
        vip_status: guest.vip_status,
        created_at: guest.created_at,
      }))

      const bookingCounts: Record<string, number> = {}
      guestsData.forEach((guest) => {
        bookingCounts[guest.id] = guest.reservations?.[0]?.count || 0
      })

      setGuests(transformedGuests)
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
    } else {
      loadGuests()
    }
  }

  function handleEditGuest(guest: Guest) {
    setSelectedGuest(guest)
    setShowEditDialog(true)
  }

  function handleSendInvoice(guest: Guest) {
    // Navigate to invoice creation with pre-filled customer data
    window.location.href = `/bookings/invoices?customer=${encodeURIComponent(guest.name)}&email=${encodeURIComponent(guest.email || "")}`
  }

  function handleWhatsApp(guest: Guest) {
    if (!guest.phone) {
      alert("Guest has no phone number")
      return
    }
    // Clean phone number (remove spaces, dashes, etc)
    const cleanPhone = guest.phone.replace(/\D/g, "")
    // Open WhatsApp Web with the phone number
    window.open(`https://wa.me/${cleanPhone}`, "_blank")
  }

  return (
    <AppLayout>
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">{t("guests.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("guests.description")}</p>
          </div>
          <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" />
            {t("guests.add_guest")}
          </Button>
        </div>

        {/* Search Bar */}
        <div className="border-b bg-card px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("guests.search_placeholder")}
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
              <div className="text-muted-foreground">{t("guests.loading")}</div>
            </div>
          ) : filteredGuests.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="text-muted-foreground">
                {searchQuery ? t("guests.no_guests") : t("guests.no_guests")}
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
                      {guest.company_name && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span className="truncate">{guest.company_name}</span>
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

                    <div className="flex gap-2 border-t pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-2 bg-transparent"
                        onClick={() => handleSendInvoice(guest)}
                      >
                        <FileText className="h-4 w-4" />
                        Invoice
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-2 bg-transparent"
                        onClick={() => handleWhatsApp(guest)}
                        disabled={!guest.phone}
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </Button>
                    </div>

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
    </AppLayout>
  )
}
