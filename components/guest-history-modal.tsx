"use client"

import { format } from "date-fns"
import { Building2, Calendar, DollarSign, FileText, Mail, MapPin, MessageCircle, Phone, User } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface GuestHistoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guest: {
    id: string
    name: string
    email: string
    phone: string
    company_name?: string
    address?: string
    vip_status: boolean
  } | null
  reservationHistory: Array<{
    id: string
    check_in: string
    check_out: string
    status: string
    total_amount: number
    room_name?: string
  }>
}

export function GuestHistoryModal({ open, onOpenChange, guest, reservationHistory }: GuestHistoryModalProps) {
  if (!guest) return null
  const activeGuest = guest

  const totalSpent = reservationHistory.reduce((sum, reservation) => sum + (reservation.total_amount || 0), 0)
  const completedBookings = reservationHistory.filter((reservation) => reservation.status === "checked_out").length
  const upcomingBookings = reservationHistory.filter((reservation) => new Date(reservation.check_in) > new Date()).length

  function handleSendInvoice() {
    window.location.href = `/bookings/invoices?guest=${activeGuest.id}`
  }

  function handleSendWhatsApp() {
    if (!activeGuest.phone) {
      alert("This guest has no phone number registered")
      return
    }
    const cleanPhone = activeGuest.phone.replace(/\D/g, "")
    const message = encodeURIComponent(`Hello ${activeGuest.name}, this is Black Swan Facility. How can we assist you today?`)
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank", "noopener,noreferrer")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Guest Profile: {activeGuest.name}
            {activeGuest.vip_status && <Badge className="bg-primary">VIP</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-secondary bg-secondary/10">
            <CardContent className="space-y-2 pt-6">
              {activeGuest.company_name && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{activeGuest.company_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{activeGuest.email || "No email"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{activeGuest.phone || "No phone"}</span>
              </div>
              {activeGuest.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{activeGuest.address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSendInvoice} variant="outline" className="flex-1 bg-transparent">
              <FileText className="mr-2 h-4 w-4" />Send Invoice
            </Button>
            <Button onClick={handleSendWhatsApp} variant="outline" className="flex-1 bg-transparent" disabled={!activeGuest.phone}>
              <MessageCircle className="mr-2 h-4 w-4" />WhatsApp
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">${totalSpent.toFixed(2)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Completed Stays</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-accent">{completedBookings}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Stays</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{upcomingBookings}</div></CardContent>
            </Card>
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-accent">Booking History</h3>
            <div className="space-y-2">
              {reservationHistory.length > 0 ? reservationHistory.map((booking) => {
                const checkInDate = new Date(booking.check_in)
                const checkOutDate = new Date(booking.check_out)
                const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))

                return (
                  <Card key={booking.id} className="border-secondary/50">
                    <CardContent className="pt-4">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">{format(checkInDate, "MMM dd, yyyy")} → {format(checkOutDate, "MMM dd, yyyy")}</span>
                          </div>
                          <p className="ml-6 text-xs text-muted-foreground">{nights} night{nights === 1 ? "" : "s"}</p>
                        </div>
                        <div className="flex items-end justify-between gap-3 sm:justify-end">
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-semibold">{booking.total_amount.toFixed(2)}</span>
                            </div>
                            <Badge variant={booking.status === "checked_out" ? "default" : "outline"} className="text-xs">{booking.status}</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              }) : <p className="text-sm text-muted-foreground">No booking history</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
