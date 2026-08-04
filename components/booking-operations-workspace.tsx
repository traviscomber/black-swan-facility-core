"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { BedDouble, ChevronDown, CircleDollarSign, ClipboardList, Loader2, RefreshCw, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BOOKING_REALTIME_EVENT, type BookingRealtimeDetail } from "@/components/booking-realtime-pulse"
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

function sectionForTable(table: string): WorkspaceSection {
  if (["housekeeping", "hospitality_requests", "incidents", "messages", "booking_shift_handovers"].includes(table)) return "operations"
  if (["reservation_extras", "reservation_payments", "reservation_adjustments"].includes(table)) return "finance"
  return "stay"
}

export function BookingOperationsWorkspace() {
  const [active, setActive] = useState<WorkspaceSection | null>(null)
  const [focus, setFocus] = useState<BookingTimelineFocusDetail | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [pendingSections, setPendingSections] = useState<WorkspaceSection[]>([])
  const [lastRealtime, setLastRealtime] = useState<BookingRealtimeDetail | null>(null)

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<BookingTimelineFocusDetail>).detail
      setFocus(detail)
      setActive((current) => current ?? "stay")
    }
    window.addEventListener(BOOKING_TIMELINE_FOCUS_EVENT, listener)
    return () => window.removeEventListener(BOOKING_TIMELINE_FOCUS_EVENT, listener)
  }, [])

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<BookingRealtimeDetail>).detail
      const affected = sectionForTable(detail.table)
      setLastRealtime(detail)
      setPendingSections((current) => current.includes(affected) ? current : [...current, affected])
      setActive((current) => {
        if (current === affected) {
          setRefreshVersion((version) => version + 1)
          setPendingSections((sectionsState) => sectionsState.filter((section) => section !== affected))
        }
        return current
      })
    }
    window.addEventListener(BOOKING_REALTIME_EVENT, listener)
    return () => window.removeEventListener(BOOKING_REALTIME_EVENT, listener)
  }, [])

  const contextLabel = useMemo(() => {
    if (!focus) return "Sin reserva seleccionada"
    return [focus.guestName, focus.roomNumber ? `Hab. ${focus.roomNumber}` : null, focus.date].filter(Boolean).join(" · ")
  }, [focus])

  function openSection(section: WorkspaceSection) {
    const next = active === section ? null : section
    setActive(next)
    if (next) {
      setPendingSections((current) => current.filter((item) => item !== next))
      setRefreshVersion((version) => version + 1)
    }
  }

  return (
    <Card className="mx-2 mb-4 sm:mx-4">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><BedDouble className="h-4 w-4" /> Inspector operacional</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Abre solo el dominio necesario. Los cambios operativos actualizan automáticamente la sección activa.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={focus?.reservationId ? "default" : "outline"}>{contextLabel}</Badge>
            {lastRealtime && <Badge variant="secondary" className="gap-1"><RefreshCw className="h-3 w-3" /> {lastRealtime.table}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-3 sm:px-6">
        <div className="sticky top-2 z-20 grid gap-2 rounded-lg bg-background/95 py-2 backdrop-blur md:static md:grid-cols-3 md:bg-transparent md:py-0">
          {sections.map((section) => {
            const Icon = section.icon
            const selected = active === section.key
            const pending = pendingSections.includes(section.key)
            return (
              <Button key={section.key} variant={selected ? "default" : "outline"} className="h-auto min-h-14 justify-between py-3 text-left" onClick={() => openSection(section.key)}>
                <span className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0" /><span><span className="flex items-center gap-2 font-medium">{section.label}{pending && <span className="h-2 w-2 rounded-full bg-current" aria-label="Cambios pendientes" />}</span><span className="hidden text-xs opacity-75 sm:block">{section.description}</span></span></span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${selected ? "rotate-180" : ""}`} />
              </Button>
            )
          })}
        </div>

        {active === null && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Selecciona un dominio para operar la estadía. El calendario permanece como vista principal.</div>}

        <div key={`${active ?? "closed"}-${refreshVersion}`}>
          {active === "stay" && <div className="space-y-4"><BookingPrearrivalControl /><GuidedCheckInPanel /><BookingGuestProfile /><BookingStayTimeline /><BookingArrivalQueue /><BookingRoomStatusControl /><BookingReassignmentControl /><BookingExceptionsControl /></div>}
          {active === "operations" && <div className="space-y-4"><BookingHousekeepingControl /><BookingHospitalityControl /><BookingMaintenanceOperations /><BookingCoordinationCenter /></div>}
          {active === "finance" && <div className="space-y-4"><BookingFinancialOperations /><BookingServicesControl /><BookingFolioControl /><BookingInvoiceCloseControl /></div>}
        </div>
      </CardContent>
    </Card>
  )
}
