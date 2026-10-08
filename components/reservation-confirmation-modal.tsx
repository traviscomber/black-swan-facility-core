"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
    arrivalSummary?: string
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
          <DialogTitle>{copy.confirmTitle}</DialogTitle>
        </DialogHeader>

        <div className="divide-y border-y text-sm">
          <div className="flex justify-between gap-4 py-3"><span className="text-muted-foreground">{copy.guestName}</span><span className="text-right font-medium">{reservationDetails.guestName}</span></div>
          <div className="flex justify-between gap-4 py-3"><span className="text-muted-foreground">{copy.location}</span><span className="text-right font-medium">{reservationDetails.locationName} · {reservationDetails.bedInfo}</span></div>
          <div className="flex justify-between gap-4 py-3"><span className="text-muted-foreground">{copy.duration}</span><span className="text-right font-medium">{format(checkInDate, "dd MMM", { locale: dateLocale })} → {format(checkOutDate, "dd MMM", { locale: dateLocale })} · {reservationDetails.nights} {reservationDetails.nights === 1 ? copy.night : copy.nights}</span></div>
          {reservationDetails.arrivalSummary && <div className="flex justify-between gap-4 py-3"><span className="text-muted-foreground">{copy.howArrives}</span><span className="text-right font-medium">{reservationDetails.arrivalSummary}</span></div>}
          <div className="flex justify-between gap-4 py-3"><span className="font-medium">{copy.totalAmount}</span><span className="text-lg font-semibold">{formatClp(reservationDetails.totalAmount, numberLocale)}</span></div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
          <Button className="h-11" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{copy.cancel}</Button>
          <Button className="h-11" onClick={onConfirm} disabled={loading}>{loading ? copy.confirming : copy.confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
