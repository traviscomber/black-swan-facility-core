"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { useLanguage } from "@/lib/hooks/use-language"
import { addReservationCopy } from "@/lib/translations/add-reservation"
import { formatClp } from "@/lib/money"

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

const DATE_LOCALES = { en: enUS, es, de } as const
const NUMBER_LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const

export function ReservationConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  reservationDetails,
  loading = false,
}: ReservationConfirmationModalProps) {
  const { language } = useLanguage()
  const copy = addReservationCopy[language]
  const dateLocale = DATE_LOCALES[language]
  const numberLocale = NUMBER_LOCALES[language]
  if (!reservationDetails) return null

  const checkInDate = new Date(reservationDetails.checkIn)
  const checkOutDate = new Date(reservationDetails.checkOut)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <DialogTitle>{copy.confirmTitle}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-secondary bg-secondary/10">
            <CardContent className="space-y-3 pt-6">
              <div className="flex justify-between"><span className="text-muted-foreground">{copy.guestName}:</span><span className="font-semibold text-accent">{reservationDetails.guestName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{copy.location}:</span><span className="font-semibold text-accent">{reservationDetails.locationName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{copy.bed}:</span><span className="font-semibold text-accent">{reservationDetails.bedInfo}</span></div>
              <div className="border-t border-secondary pt-3">
                <div className="mb-2 flex justify-between"><span className="text-muted-foreground">{copy.checkIn}:</span><span className="font-semibold">{format(checkInDate, "dd MMM yyyy", { locale: dateLocale })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{copy.checkOut}:</span><span className="font-semibold">{format(checkOutDate, "dd MMM yyyy", { locale: dateLocale })}</span></div>
                <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">{copy.duration}:</span><span className="font-semibold">{reservationDetails.nights} {reservationDetails.nights === 1 ? copy.night : copy.nights}</span></div>
              </div>
              <div className="border-t border-secondary pt-3">
                <div className="flex justify-between"><span className="text-lg font-semibold text-accent">{copy.totalAmount}:</span><span className="text-lg font-bold text-primary">{formatClp(reservationDetails.totalAmount, numberLocale)}</span></div>
              </div>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">{copy.review}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{copy.cancel}</Button>
          <Button onClick={onConfirm} disabled={loading} className="bg-primary">{loading ? copy.confirming : copy.confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
