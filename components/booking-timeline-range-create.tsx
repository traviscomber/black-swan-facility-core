"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"
import { CalendarPlus2, CheckCircle2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { createClient } from "@/lib/supabase/client"
import { bookingEdgeScrollVelocity, bookingStaysOverlap } from "@/lib/booking-drag"

type ActiveReservation = {
  id: string
  bed_id: string | null
  room_id: string | null
  location_id: string | null
  booking_type: string | null
  check_in: string
  check_out: string
}

type RoomBlock = {
  room_id: string
  start_date: string
  end_date: string
}

type CreateSession = {
  pointerId: number
  pointerType: string
  row: HTMLElement
  timeline: HTMLElement
  cells: HTMLButtonElement[]
  startCell: HTMLButtonElement
  scrollContainer: HTMLElement | null
  startIndex: number
  currentIndex: number
  startX: number
  initialScrollLeft: number
  lastClientX: number
  active: boolean
  valid: boolean
  message: string
}

type RangePreview = {
  checkIn: string
  checkOut: string
  nights: number
  targetLabel: string
  valid: boolean
  message: string
}

function dateFromCell(cell: HTMLButtonElement) {
  return cell.getAttribute("aria-label")?.match(/(\d{4}-\d{2}-\d{2})$/)?.[1] ?? null
}

function clearSelection() {
  document.querySelectorAll<HTMLButtonElement>("[data-booking-create-state]").forEach((cell) => {
    delete cell.dataset.bookingCreateState
  })
}

function releasePointer(session: CreateSession) {
  try {
    if (session.startCell.hasPointerCapture(session.pointerId)) {
      session.startCell.releasePointerCapture(session.pointerId)
    }
  } catch {
    // Pointer capture may already be released by the browser.
  }
}

function rowLabel(row: HTMLElement) {
  const location = row.dataset.locationName ?? "Propiedad"
  const room = row.dataset.roomNumber ?? "Habitación"
  const bed = row.dataset.bedNumber ?? ""
  return `${location} · ${room}${bed ? ` · Cama ${bed}` : ""}`
}

export function BookingTimelineRangeCreate() {
  const supabase = useMemo(() => createClient(), [])
  const [preview, setPreview] = useState<RangePreview | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bedId, setBedId] = useState<string | undefined>()
  const [locationName, setLocationName] = useState<string | undefined>()
  const [checkIn, setCheckIn] = useState<Date | undefined>()
  const [checkOut, setCheckOut] = useState<Date | undefined>()

  useEffect(() => {
    let disposed = false
    let session: CreateSession | null = null
    let suppressClickUntil = 0
    let autoScrollFrame: number | null = null
    let activeReservations: ActiveReservation[] = []
    let blocks: RoomBlock[] = []

    const loadContext = async () => {
      const today = format(new Date(), "yyyy-MM-dd")
      const [reservationsResult, blocksResult] = await Promise.all([
        supabase
          .from("reservations")
          .select("id, bed_id, room_id, location_id, booking_type, check_in, check_out")
          .gt("check_out", today)
          .not("status", "in", "(cancelled,canceled,void,voided,checked_out,checked-out,no_show)"),
        supabase
          .from("room_blocks")
          .select("room_id, start_date, end_date")
          .eq("status", "active"),
      ])
      if (disposed) return
      if (!reservationsResult.error) activeReservations = (reservationsResult.data ?? []) as ActiveReservation[]
      if (!blocksResult.error) blocks = (blocksResult.data ?? []) as RoomBlock[]
    }

    const stopAutoScroll = () => {
      if (autoScrollFrame !== null) window.cancelAnimationFrame(autoScrollFrame)
      autoScrollFrame = null
    }

    const rangeForSession = (current: CreateSession) => {
      const first = Math.min(current.startIndex, current.currentIndex)
      const last = Math.max(current.startIndex, current.currentIndex)
      const startValue = dateFromCell(current.cells[first])
      const endValue = dateFromCell(current.cells[last])
      if (!startValue || !endValue) return null
      return {
        first,
        last,
        checkIn: startValue,
        checkOut: format(addDays(parseISO(endValue), 1), "yyyy-MM-dd"),
      }
    }

    const validateRange = (current: CreateSession, range: NonNullable<ReturnType<typeof rangeForSession>>) => {
      const targetBedId = current.row.dataset.bedId
      const targetRoomId = current.row.dataset.roomId
      const targetLocationId = current.row.dataset.locationId
      if (!targetBedId || !targetRoomId) return { valid: false, message: "No se identificó el inventario seleccionado" }
      if (current.row.dataset.bedAvailable === "false") return { valid: false, message: "La cama está deshabilitada" }
      if (["out_of_service", "out_of_inventory"].includes(current.row.dataset.roomStatus ?? "")) {
        return { valid: false, message: "La habitación no admite nuevas reservas" }
      }

      const reservationConflict = activeReservations.some((reservation) => {
        if (!bookingStaysOverlap(range.checkIn, range.checkOut, reservation.check_in, reservation.check_out)) return false
        if (reservation.bed_id === targetBedId) return true
        if (!reservation.bed_id && reservation.room_id === targetRoomId) return true
        return Boolean(
          reservation.booking_type === "LOCATION"
          && targetLocationId
          && reservation.location_id === targetLocationId,
        )
      })
      if (reservationConflict) return { valid: false, message: "El rango cruza una reserva activa" }

      const blockConflict = blocks.some(
        (block) => block.room_id === targetRoomId
          && bookingStaysOverlap(range.checkIn, range.checkOut, block.start_date, block.end_date),
      )
      if (blockConflict) return { valid: false, message: "El rango cruza un bloqueo operativo" }

      return { valid: true, message: "Rango disponible para crear una reserva" }
    }

    const updateSelection = (clientX: number) => {
      if (!session) return
      session.lastClientX = clientX
      const scrollDelta = session.scrollContainer
        ? session.scrollContainer.scrollLeft - session.initialScrollLeft
        : 0
      const dayWidth = session.timeline.getBoundingClientRect().width / session.cells.length
      const delta = Math.round((clientX - session.startX + scrollDelta) / dayWidth)
      const nextIndex = Math.max(0, Math.min(session.cells.length - 1, session.startIndex + delta))
      const distance = Math.abs(clientX - session.startX)
      const activationThreshold = session.pointerType === "touch" ? 12 : 6
      if (!session.active && distance < activationThreshold) return
      session.active = true
      session.currentIndex = nextIndex

      const range = rangeForSession(session)
      if (!range) return
      const validation = validateRange(session, range)
      session.valid = validation.valid
      session.message = validation.message

      clearSelection()
      for (let index = range.first; index <= range.last; index += 1) {
        session.cells[index].dataset.bookingCreateState = validation.valid ? "valid" : "invalid"
      }

      setPreview({
        checkIn: range.checkIn,
        checkOut: range.checkOut,
        nights: differenceInCalendarDays(parseISO(range.checkOut), parseISO(range.checkIn)),
        targetLabel: rowLabel(session.row),
        valid: validation.valid,
        message: validation.message,
      })
    }

    const runAutoScroll = () => {
      autoScrollFrame = null
      if (!session?.active || !session.scrollContainer) return
      const container = session.scrollContainer
      const rect = container.getBoundingClientRect()
      const velocity = bookingEdgeScrollVelocity(session.lastClientX, rect.left, rect.right, 84, 22)
      if (velocity === 0) return
      const previous = container.scrollLeft
      container.scrollBy(velocity, 0)
      if (container.scrollLeft !== previous) updateSelection(session.lastClientX)
      autoScrollFrame = window.requestAnimationFrame(runAutoScroll)
    }

    const ensureAutoScroll = () => {
      if (autoScrollFrame === null) autoScrollFrame = window.requestAnimationFrame(runAutoScroll)
    }

    const cancel = () => {
      stopAutoScroll()
      if (session) releasePointer(session)
      session = null
      clearSelection()
      setPreview(null)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const cell = (event.target as HTMLElement).closest<HTMLButtonElement>(
        '[data-booking-timeline-row="true"] > div.absolute.inset-0.flex > button',
      )
      if (!cell) return
      const timeline = cell.closest<HTMLElement>('[data-booking-timeline-row="true"]')
      const row = timeline?.closest<HTMLElement>('[data-booking-bed-row="true"]')
      if (!timeline || !row) return
      const cells = Array.from(
        timeline.querySelectorAll<HTMLButtonElement>(":scope > div.absolute.inset-0.flex > button"),
      )
      const startIndex = cells.indexOf(cell)
      if (startIndex < 0) return

      const scrollContainer = timeline.closest<HTMLElement>(".overflow-auto")
      try {
        cell.setPointerCapture(event.pointerId)
      } catch {
        // Window listeners remain as fallback.
      }

      session = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        row,
        timeline,
        cells,
        startCell: cell,
        scrollContainer,
        startIndex,
        currentIndex: startIndex,
        startX: event.clientX,
        initialScrollLeft: scrollContainer?.scrollLeft ?? 0,
        lastClientX: event.clientX,
        active: false,
        valid: true,
        message: "",
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!session || event.pointerId !== session.pointerId) return
      updateSelection(event.clientX)
      if (session.active) {
        event.preventDefault()
        ensureAutoScroll()
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!session || event.pointerId !== session.pointerId) return
      stopAutoScroll()
      const current = session
      session = null
      releasePointer(current)
      if (!current.active) return

      event.preventDefault()
      suppressClickUntil = Date.now() + 400
      const range = rangeForSession(current)
      clearSelection()
      setPreview(null)
      if (!range) return
      if (!current.valid) {
        toast.error(current.message)
        return
      }

      setBedId(current.row.dataset.bedId)
      setLocationName(current.row.dataset.locationName)
      setCheckIn(parseISO(range.checkIn))
      setCheckOut(parseISO(range.checkOut))
      setDialogOpen(true)
    }

    const onClickCapture = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel()
    }

    void loadContext()
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("click", onClickCapture, true)
    window.addEventListener("pointermove", onPointerMove, { passive: false })
    window.addEventListener("pointerup", onPointerUp, { passive: false })
    window.addEventListener("pointercancel", cancel)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("blur", cancel)

    const channel = supabase
      .channel("booking-timeline-range-create-context")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadContext())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, () => void loadContext())
      .subscribe()

    return () => {
      disposed = true
      cancel()
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("click", onClickCapture, true)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", cancel)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("blur", cancel)
      void supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <>
      <style jsx global>{`
        [data-booking-timeline-row="true"] > div.absolute.inset-0.flex > button[data-booking-create-state="valid"] {
          background: color-mix(in srgb, var(--primary) 20%, transparent) !important;
          box-shadow: inset 0 2px 0 var(--primary), inset 0 -2px 0 var(--primary);
        }
        [data-booking-timeline-row="true"] > div.absolute.inset-0.flex > button[data-booking-create-state="invalid"] {
          background: color-mix(in srgb, var(--destructive) 18%, transparent) !important;
          box-shadow: inset 0 2px 0 var(--destructive), inset 0 -2px 0 var(--destructive);
        }
      `}</style>

      {preview && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="pointer-events-none fixed left-1/2 top-20 z-[91] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 bg-[var(--surface-2)] px-4 py-3 text-[var(--text-primary)] shadow-none"
        >
          <div className="flex items-start gap-3">
            {preview.valid
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
              : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]" />}
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CalendarPlus2 className="h-4 w-4" /> Nueva reserva
              </p>
              <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{preview.targetLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {format(parseISO(preview.checkIn), "dd MMM yyyy")} → {format(parseISO(preview.checkOut), "dd MMM yyyy")} · {preview.nights} noches
              </p>
              <p className="mt-2 text-xs">{preview.message}</p>
            </div>
          </div>
        </div>
      )}

      <AddReservationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => setDialogOpen(false)}
        preselectedBed={bedId}
        preselectedDate={checkIn}
        preselectedCheckOut={checkOut}
        preselectedLocation={locationName}
      />
    </>
  )
}
