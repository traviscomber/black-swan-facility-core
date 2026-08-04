"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { BedDouble, ChevronDown, CircleDollarSign, ClipboardList, Loader2, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BOOKING_TIMELINE_FOCUS_EVENT, type BookingTimelineFocusDetail } from "@/components/booking-timeline-alert-navigator"

const LoadingBlock = () => (
  <div className="flex min-h-28 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando operación
  </div>
)

const BookingPrearrivalControl = dynamic(() => import("@/components/booking-prearrival-control").then((m) => m.BookingPrearrivalControl), { ssr: false, loading: LoadingBlock })
const GuidedCheckInPanel = dynamic(() => import("@/components/guided-check-in-panel").then((m) => m.GuidedCheckInPanel), { ssr: false, loading: LoadingBlock })
const BookingGuestProfile = dynamic(() => import("@/components/booking-guest-profile").then((m) => m.BookingGuestProfile), { ssr: false, loading: LoadingBlock })
const BookingHousekeepingControl = dynamic(() => import("@/components/booking-housekeeping-control").then((m) => m.BookingHousekeepingControl), { ssr: false, loading: LoadingBlock })
const BookingHospitalityControl = dynamic(() => import("@/components/booking-hospitality-control").then((m) => m.BookingHospitalityControl), { ssr: false, loading: LoadingBlock })
const BookingMaintenanceOperations = dynamic(() => import("@/components/booking-maintenance-operations").then((m) => m.BookingMaintenanceOperations), { ssr: false, loading: LoadingBlock })
const BookingCoordinationCenter = dynamic(() => import("@/components/booking-coordination-center").then((m) => m.BookingCoordinationCenter), { ssr: false, loading: LoadingBlock })
const BookingFinancialOperations = dynamic(() => import("@/components/booking-financial-operations").then((m) => m.BookingFinancialOperations), { ssr: false, loading: LoadingBlock })
const BookingServicesControl = dynamic(() => import("@/components/booking-services-control").then((m) => m.BookingServicesControl), { ssr: false, loading: LoadingBlock })
const BookingFolioControl = dynamic(() => import("@/components/booking-folio-control").then((m) => m.BookingFolioControl), { ssr: false, loading: LoadingBlock })
const BookingInvoiceCloseControl = dynamic(() => import("@/components/booking-invoice-close-control").then((m) => m.BookingInvoiceCloseControl), { ssr: false, loading: LoadingBlock })
const BookingStayTimeline = dynamic(() => import("@/components/booking-stay-timeline").then((m) => m.BookingStayTimeline), { ssr: false, loading: LoadingBlock })
const BookingArrivalQueue = dynamic(() => import("@/components/booking-arrival-queue").then((m) => m.BookingArrivalQueue), { ssr: false, loading: LoadingBlock })
const BookingRoomStatusControl = dynamic(() => import("@/components/booking-room-status-control").then((m) => m.BookingRoomStatusControl), { ssr: false, loading: LoadingBlock })
const BookingReassignmentControl = dynamic(() => import("@/components/booking-reassignment-control").then((m) => m.BookingReassignmentControl), { ssr: false, loading: LoadingBlock })
const BookingExceptionsControl = dynamic(() => import("@/components/booking-exceptions-control").then((m) => m.BookingExceptionsControl), { ssr: false, loading: LoadingBlock })

type WorkspaceSection = "stay" | "operations" | "finance"

const sections: Array<{ key: WorkspaceSection; label: string; description: string; icon: typeof BedDouble }> = [
  { key: "stay", label: "Estadía y huésped", description: "Llegada, perfil, historial y excepciones", icon: UserRound },
  { key: "operations", label: "Operación interna", description: "Housekeeping, Hospitality, mantenimiento y turnos", icon: ClipboardList },
  { key: "finance", label: "Servicios y cuenta", description: "Consumos, folio, pagos y cierre", icon: CircleDollarSign },
]

export function BookingOperationsWorkspace() {
  const [active, setActive] = useState<WorkspaceSection | null>(null)
  const [focus, setFocus] = useState<BookingTimelineFocusDetail | null>(null)

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<BookingTimelineFocusDetail>).detail
      setFocus(detail)
      if (!active) setActive("stay")
    }
    window.addEventListener(BOOKING_TIMELINE_FOCUS_EVENT, listener)
    return () => window.removeEventListener(BOOKING_TIMELINE_FOCUS_EVENT, listener)
  }, [active])

  const contextLabel = useMemo(() => {
    if (!focus) return "Sin reserva seleccionada"
    return [focus.guestName, focus.roomNumber ? `Hab. ${focus.roomNumber}` : null, focus.date].filter(Boolean).join(" · ")
  }, [focus])

  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><BedDouble className="h-4 w-4" /> Inspector operacional</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Abre solo el dominio necesario. Los módulos cerrados no consultan datos ni mantienen suscripciones.</p>
          </div>
          <Badge variant={focus?.reservationId ? "default" : "outline"}>{contextLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon
            const selected = active === section.key
            return (
              <Button key={section.key} variant={selected ? "default" : "outline"} className="h-auto justify-between py-3 text-left" onClick={() => setActive(selected ? null : section.key)}>
                <span className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4" /><span><span className="block font-medium">{section.label}</span><span className="block text-xs opacity-75">{section.description}</span></span></span>
                <ChevronDown className={`h-4 w-4 transition-transform ${selected ? "rotate-180" : ""}`} />
              </Button>
            )
          })}
        </div>

        {active === null && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Selecciona un dominio para operar la estadía. El calendario permanece como vista principal.</div>}

        {active === "stay" && <div className="space-y-4"><BookingPrearrivalControl /><GuidedCheckInPanel /><BookingGuestProfile /><BookingStayTimeline /><BookingArrivalQueue /><BookingRoomStatusControl /><BookingReassignmentControl /><BookingExceptionsControl /></div>}
        {active === "operations" && <div className="space-y-4"><BookingHousekeepingControl /><BookingHospitalityControl /><BookingMaintenanceOperations /><BookingCoordinationCenter /></div>}
        {active === "finance" && <div className="space-y-4"><BookingFinancialOperations /><BookingServicesControl /><BookingFolioControl /><BookingInvoiceCloseControl /></div>}
      </CardContent>
    </Card>
  )
}
