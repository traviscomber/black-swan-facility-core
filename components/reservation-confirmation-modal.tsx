"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { format } from "date-fns"

interface ReservationConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  reservationDetails: {
    guestName: string
    bedInfo: string
    checkIn: string
    checkOut: string
    nights: number
    totalAmount: number
    locationName: string
  } | null
  loading?: boolean
}

export function ReservationConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  reservationDetails,
  loading = false,
}: ReservationConfirmationModalProps) {
  if (!reservationDetails) return null

  const checkInDate = new Date(reservationDetails.checkIn)
  const checkOutDate = new Date(reservationDetails.checkOut)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <DialogTitle>Confirm Reservation</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-secondary bg-secondary/10">
            <CardContent className="pt-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guest Name:</span>
                <span className="font-semibold text-accent">{reservationDetails.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-semibold text-accent">{reservationDetails.locationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bed:</span>
                <span className="font-semibold text-accent">{reservationDetails.bedInfo}</span>
              </div>
              <div className="border-t border-secondary pt-3">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Check-in:</span>
                  <span className="font-semibold">{format(checkInDate, "MMM dd, yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-out:</span>
                  <span className="font-semibold">{format(checkOutDate, "MMM dd, yyyy")}</span>
                </div>
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-semibold">
                    {reservationDetails.nights} night{reservationDetails.nights > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="border-t border-secondary pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-accent">Total Amount:</span>
                  <span className="text-lg font-bold text-primary">${reservationDetails.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            Please review the details above before confirming this reservation.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading} className="bg-primary">
            {loading ? "Confirming..." : "Confirm Reservation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
