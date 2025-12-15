"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { User, Mail, Phone, Calendar, DollarSign } from "lucide-react"

interface GuestHistoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guest: {
    name: string
    email: string
    phone: string
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

  const totalSpent = reservationHistory.reduce((sum, r) => sum + (r.total_amount || 0), 0)
  const completedBookings = reservationHistory.filter((r) => r.status === "checked_out").length
  const upcomingBookings = reservationHistory.filter((r) => new Date(r.check_in) > new Date()).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Guest Profile: {guest.name}
            {guest.vip_status && <Badge className="bg-primary">VIP</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Guest Contact Info */}
          <Card className="bg-secondary/10 border-secondary">
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{guest.email || "No email"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{guest.phone || "No phone"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Guest Statistics */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">${totalSpent.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed Stays</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">{completedBookings}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Stays</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{upcomingBookings}</div>
              </CardContent>
            </Card>
          </div>

          {/* Booking History */}
          <div>
            <h3 className="font-semibold text-accent mb-3">Booking History</h3>
            <div className="space-y-2">
              {reservationHistory.length > 0 ? (
                reservationHistory.map((booking) => {
                  const checkInDate = new Date(booking.check_in)
                  const checkOutDate = new Date(booking.check_out)
                  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))

                  return (
                    <Card key={booking.id} className="border-secondary/50">
                      <CardContent className="pt-4">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-semibold">
                                {format(checkInDate, "MMM dd, yyyy")} → {format(checkOutDate, "MMM dd, yyyy")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground ml-6">
                              {nights} night{nights > 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="flex items-end justify-between sm:justify-end gap-3">
                            <div className="text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{booking.total_amount.toFixed(2)}</span>
                              </div>
                              <Badge
                                variant={booking.status === "checked_out" ? "default" : "outline"}
                                className="text-xs"
                              >
                                {booking.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground">No booking history</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
