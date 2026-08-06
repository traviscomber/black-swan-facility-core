"use client"

import { useEffect, useMemo, useState } from "react"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { AlertTriangle, CheckCircle2, MoveHorizontal } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  bookingDragDates,
  bookingDragDayDelta,
  bookingEdgeScrollVelocity,
  bookingStaysOverlap,
  type BookingDragMode,
} from "@/lib/booking-drag"

type DragPreview = {
  guestName: string
  targetLabel: string
  checkIn: string
  checkOut: string
  nights: number
  mode: BookingDragMode
  valid: boolean
  message: string
}

type DragSession = {
  bar: HTMLButtonElement
  sourceRow: HTMLElement
  targetRow: HTMLElement
  scrollContainer: HTMLElement | null
  mode: BookingDragMode
  pointerId: number
  pointerType: string
  reservationId: string
  originalBedId: string
  originalRoomId: string
  originalCheckIn: string
  originalCheckOut: string
  originalLeft: string
  originalWidth: string
  originalTransform: string
  originalTransition: string
  startX: number
  startY: number
  initialScrollLeft: number
  initialScrollTop: number
  lastClientX: number
  lastClientY: number
  dayWidth: number
  active: boolean
  targetBedId: string
  targetRoomId: string
  targetCheckIn: string
  targetCheckOut: string
  valid: boolean
  validationMessage: string
}

type DragResult = {
  result?: "applied" | "queued" | "unchanged"
  message?: string
  request_id?: string
}

type RoomBlock = {
  room_id: string
  start_date: string
  end_date: string
}

type ActiveReservation = {
  id: string
  bed_id: string | null
  room_id: string | null
  location_id: string | null
  booking_type: string | null
  check_in: string
  check_out: string
}

type BedAvailability = {
  id: string
  is_available: boolean
}

function rowAtPoint(clientX: number, clientY: number) {
  const direct = document
    .elementsFromPoint(clientX, clientY)
    .map((element) => element.closest<HTMLElement>('[data-booking-bed-row="true"]'))
    .find(Boolean)

  if (direct) return direct

  const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-booking-bed-row="true"]'))
  return rows.reduce<HTMLElement | null>((nearest, row) => {
    const rect = row.getBoundingClientRect()
    const distance = Math.abs(clientY - (rect.top + rect.height / 2))
    if (distance > 56) return nearest
    if (!nearest) return row
    const nearestRect = nearest.getBoundingClientRect()
    const nearestDistance = Math.abs(clientY - (nearestRect.top + nearestRect.height / 2))
    return distance < nearestDistance ? row : nearest
  }, null)
}

function clearRowStates() {
  document.querySelectorAll<HTMLElement>('[data-booking-bed-row="true"]').forEach((row) => {
    delete row.dataset.bookingDropState
    delete row.dataset.bookingCandidateState
  })
}

function releasePointer(session: DragSession) {
  try {
    if (session.bar.hasPointerCapture(session.pointerId)) session.bar.releasePointerCapture(session.pointerId)
  } catch {
    // The browser can release capture before pointercancel or window blur.
  }
}

function restoreBar(session: DragSession) {
  releasePointer(session)
  session.bar.style.left = session.originalLeft
  session.bar.style.width = session.originalWidth
  session.bar.style.transform = session.originalTransform
  session.bar.style.transition = session.originalTransition
  session.bar.style.pointerEvents = ""
  session.bar.style.opacity = ""
  session.bar.style.zIndex = ""
  session.bar.setAttribute("aria-grabbed", "false")
  delete session.bar.dataset.bookingDragging
  clearRowStates()
}

function targetLabel(row: HTMLElement) {
  const location = row.dataset.locationName ?? "Propiedad"
  const room = row.dataset.roomNumber ?? "Habitación"
  const bed = row.dataset.bedNumber ?? ""
  return `${location} · ${room}${bed ? ` · Cama ${bed}` : ""}`
}

function modeLabel(mode: BookingDragMode) {
  if (mode === "resize-start") return "Ajustar llegada"
  if (mode === "resize-end") return "Ajustar salida"
  return "Mover reserva"
}

export function BookingTimelineDragDrop() {
  const supabase = useMemo(() => createClient(), [])
  const [preview, setPreview] = useState<DragPreview | null>(null)

  useEffect(() => {
    let disposed = false
    let session: DragSession | null = null
    let suppressClickUntil = 0
    let autoScrollFrame: number | null = null
    let blocks: RoomBlock[] = []
    let activeReservations: ActiveReservation[] = []
    let unavailableBedIds = new Set<string>()
    let pendingReservationIds = new Set<string>()

    const stopAutoScroll = () => {
      if (autoScrollFrame !== null) window.cancelAnimationFrame(autoScrollFrame)
      autoScrollFrame = null
    }

    const applyPendingState = () => {
      document.querySelectorAll<HTMLButtonElement>('[data-booking-reservation="true"]').forEach((bar) => {
        if (bar.dataset.bookingOriginalTitle === undefined) bar.dataset.bookingOriginalTitle = bar.title
        const pending = Boolean(bar.dataset.reservationId && pendingReservationIds.has(bar.dataset.reservationId))
        bar.dataset.bookingPendingApproval = pending ? "true" : "false"
        bar.setAttribute("aria-disabled", pending ? "true" : "false")
        bar.title = pending
          ? "Cambio pendiente de aprobación de Santiago"
          : (bar.dataset.bookingOriginalTitle ?? "")
      })
    }

    const ensureInteractionElements = () => {
      document.querySelectorAll<HTMLButtonElement>('[data-booking-reservation="true"]').forEach((bar) => {
        bar.draggable = false
        bar.setAttribute("aria-grabbed", "false")
        bar.setAttribute("aria-keyshortcuts", "Escape")

        if (!bar.querySelector('[data-booking-resize-edge="start"]')) {
          const startHandle = document.createElement("span")
          startHandle.dataset.bookingResizeEdge = "start"
          startHandle.setAttribute("aria-hidden", "true")
          bar.appendChild(startHandle)
        }
        if (!bar.querySelector('[data-booking-resize-edge="end"]')) {
          const endHandle = document.createElement("span")
          endHandle.dataset.bookingResizeEdge = "end"
          endHandle.setAttribute("aria-hidden", "true")
          bar.appendChild(endHandle)
        }
      })
      applyPendingState()
    }

    const loadOperationalContext = async () => {
      const today = format(new Date(), "yyyy-MM-dd")
      const [pendingResult, blocksResult, reservationsResult, bedsResult] = await Promise.all([
        supabase
          .from("operational_approval_requests")
          .select("reservation_id")
          .eq("status", "pending")
          .eq("action_key", "booking.modify"),
        supabase
          .from("room_blocks")
          .select("room_id, start_date, end_date")
          .eq("status", "active"),
        supabase
          .from("reservations")
          .select("id, bed_id, room_id, location_id, booking_type, check_in, check_out")
          .gt("check_out", today)
          .not("status", "in", "(cancelled,canceled,void,voided,checked_out,checked-out,no_show)"),
        supabase.from("beds").select("id, is_available"),
      ])

      if (disposed) return
      if (!pendingResult.error) {
        pendingReservationIds = new Set(
          (pendingResult.data ?? [])
            .map((item) => item.reservation_id)
            .filter((value): value is string => Boolean(value)),
        )
      }
      if (!blocksResult.error) blocks = (blocksResult.data ?? []) as RoomBlock[]
      if (!reservationsResult.error) activeReservations = (reservationsResult.data ?? []) as ActiveReservation[]
      if (!bedsResult.error) {
        unavailableBedIds = new Set(
          ((bedsResult.data ?? []) as BedAvailability[])
            .filter((bed) => !bed.is_available)
            .map((bed) => bed.id),
        )
      }
      ensureInteractionElements()
    }

    const validateTarget = (
      current: DragSession,
      targetRow: HTMLElement,
      targetCheckIn: string,
      targetCheckOut: string,
    ) => {
      if (targetCheckOut <= targetCheckIn) {
        return { valid: false, message: "La salida debe ser posterior a la llegada" }
      }

      const status = targetRow.dataset.roomStatus
      if (status === "out_of_service" || status === "out_of_inventory") {
        return { valid: false, message: "La habitación está fuera de servicio o inventario" }
      }

      const targetBedId = targetRow.dataset.bedId
      const targetRoomId = targetRow.dataset.roomId
      const targetLocationId = targetRow.dataset.locationId
      if (!targetBedId || !targetRoomId) return { valid: false, message: "Destino no identificado" }
      if (unavailableBedIds.has(targetBedId)) return { valid: false, message: "La cama está deshabilitada" }

      const reservationConflict = activeReservations.some((reservation) => {
        if (reservation.id === current.reservationId) return false
        if (!bookingStaysOverlap(targetCheckIn, targetCheckOut, reservation.check_in, reservation.check_out)) return false
        if (reservation.bed_id === targetBedId) return true
        if (!reservation.bed_id && reservation.room_id === targetRoomId) return true
        return Boolean(
          reservation.booking_type === "LOCATION"
          && targetLocationId
          && reservation.location_id === targetLocationId,
        )
      })

      if (reservationConflict) return { valid: false, message: "Existe otra reserva activa en ese inventario" }

      const blockConflict = blocks.some(
        (block) => block.room_id === targetRoomId
          && bookingStaysOverlap(targetCheckIn, targetCheckOut, block.start_date, block.end_date),
      )
      if (blockConflict) return { valid: false, message: "La habitación tiene un bloqueo operativo" }

      return { valid: true, message: "Destino disponible. Se validará nuevamente al soltar." }
    }

    const markCandidateRows = (
      current: DragSession,
      targetCheckIn: string,
      targetCheckOut: string,
    ) => {
      document.querySelectorAll<HTMLElement>('[data-booking-bed-row="true"]').forEach((row) => {
        if (current.mode !== "move" && row !== current.sourceRow) {
          delete row.dataset.bookingCandidateState
          return
        }
        row.dataset.bookingCandidateState = validateTarget(current, row, targetCheckIn, targetCheckOut).valid
          ? "valid"
          : "invalid"
      })
    }

    const activateSession = (current: DragSession) => {
      current.active = true
      current.bar.dataset.bookingDragging = "true"
      current.bar.setAttribute("aria-grabbed", "true")
      current.bar.style.transition = "none"
      current.bar.style.pointerEvents = "none"
      current.bar.style.opacity = "0.78"
      current.bar.style.zIndex = "80"
      markCandidateRows(current, current.originalCheckIn, current.originalCheckOut)
    }

    const updateFromPointer = (clientX: number, clientY: number) => {
      if (!session) return
      session.lastClientX = clientX
      session.lastClientY = clientY

      const distance = Math.hypot(clientX - session.startX, clientY - session.startY)
      const activationThreshold = session.pointerType === "touch" ? 9 : 5
      if (!session.active && distance < activationThreshold) return
      if (!session.active) activateSession(session)

      const scrollDeltaX = session.scrollContainer
        ? session.scrollContainer.scrollLeft - session.initialScrollLeft
        : 0
      const dayDelta = bookingDragDayDelta(clientX - session.startX, scrollDeltaX, session.dayWidth)
      const nextRow = session.mode === "move"
        ? rowAtPoint(clientX, clientY) ?? session.sourceRow
        : session.sourceRow
      const dates = bookingDragDates(
        session.mode,
        session.originalCheckIn,
        session.originalCheckOut,
        dayDelta,
      )
      const validation = validateTarget(session, nextRow, dates.checkIn, dates.checkOut)
      const sourceRect = session.sourceRow.getBoundingClientRect()
      const targetRect = nextRow.getBoundingClientRect()
      const translateY = session.mode === "move" ? targetRect.top - sourceRect.top : 0
      const translateX = dayDelta * session.dayWidth
      const originalWidth = Number.parseFloat(
        session.originalWidth || `${session.bar.getBoundingClientRect().width}`,
      )

      if (session.mode === "move") {
        session.bar.style.transform = `translate(${translateX}px, ${translateY}px)`
      } else if (session.mode === "resize-start") {
        session.bar.style.transform = `translateX(${translateX}px)`
        session.bar.style.width = `${Math.max(20, originalWidth - translateX)}px`
      } else {
        session.bar.style.width = `${Math.max(20, originalWidth + translateX)}px`
      }

      markCandidateRows(session, dates.checkIn, dates.checkOut)
      document.querySelectorAll<HTMLElement>('[data-booking-bed-row="true"]').forEach((row) => {
        delete row.dataset.bookingDropState
      })
      nextRow.dataset.bookingDropState = validation.valid ? "valid" : "invalid"

      session.targetRow = nextRow
      session.targetBedId = nextRow.dataset.bedId ?? session.originalBedId
      session.targetRoomId = nextRow.dataset.roomId ?? session.originalRoomId
      session.targetCheckIn = dates.checkIn
      session.targetCheckOut = dates.checkOut
      session.valid = validation.valid
      session.validationMessage = validation.message

      setPreview({
        guestName: session.bar.dataset.guestName ?? "Reserva",
        targetLabel: targetLabel(nextRow),
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        nights: Math.max(0, differenceInCalendarDays(parseISO(dates.checkOut), parseISO(dates.checkIn))),
        mode: session.mode,
        valid: validation.valid,
        message: validation.message,
      })
    }

    const runAutoScroll = () => {
      autoScrollFrame = null
      if (!session?.active || !session.scrollContainer) return

      const container = session.scrollContainer
      const rect = container.getBoundingClientRect()
      const velocityX = bookingEdgeScrollVelocity(session.lastClientX, rect.left, rect.right, 84, 22)
      const velocityY = bookingEdgeScrollVelocity(session.lastClientY, rect.top, rect.bottom, 72, 16)
      if (velocityX === 0 && velocityY === 0) return

      const beforeLeft = container.scrollLeft
      const beforeTop = container.scrollTop
      container.scrollBy(velocityX, velocityY)
      if (container.scrollLeft !== beforeLeft || container.scrollTop !== beforeTop) {
        updateFromPointer(session.lastClientX, session.lastClientY)
      }
      autoScrollFrame = window.requestAnimationFrame(runAutoScroll)
    }

    const ensureAutoScroll = () => {
      if (autoScrollFrame === null) autoScrollFrame = window.requestAnimationFrame(runAutoScroll)
    }

    const finishDrag = async (event: PointerEvent) => {
      if (!session || event.pointerId !== session.pointerId) return
      stopAutoScroll()
      const current = session
      session = null

      if (!current.active) {
        releasePointer(current)
        return
      }

      event.preventDefault()
      suppressClickUntil = Date.now() + 400
      setPreview(null)

      if (!current.valid) {
        toast.error(current.validationMessage)
        restoreBar(current)
        return
      }

      const changed =
        current.targetBedId !== current.originalBedId
        || current.targetCheckIn !== current.originalCheckIn
        || current.targetCheckOut !== current.originalCheckOut

      if (!changed) {
        restoreBar(current)
        return
      }

      current.bar.style.opacity = "0.5"
      const reason = `Ajuste drag-and-drop: ${current.originalCheckIn}–${current.originalCheckOut} a ${current.targetCheckIn}–${current.targetCheckOut}; destino ${targetLabel(current.targetRow)}.`
      const { data, error } = await supabase.rpc("apply_or_queue_booking_drag", {
        p_reservation_id: current.reservationId,
        p_target_bed_id: current.targetBedId,
        p_check_in: current.targetCheckIn,
        p_check_out: current.targetCheckOut,
        p_reason: reason,
      })

      restoreBar(current)
      if (error) {
        toast.error(error.message)
        return
      }

      const result = (data ?? {}) as DragResult
      if (result.result === "queued") {
        pendingReservationIds.add(current.reservationId)
        applyPendingState()
        toast.warning(result.message ?? "Cambio enviado a aprobación")
      } else if (result.result === "applied") {
        toast.success(result.message ?? "Reserva actualizada")
      } else {
        toast.info(result.message ?? "La reserva no cambió")
      }
    }

    const cancelDrag = () => {
      stopAutoScroll()
      if (!session) return
      restoreBar(session)
      session = null
      setPreview(null)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      const bar = target.closest<HTMLButtonElement>('[data-booking-reservation="true"]')
      if (!bar || bar.dataset.bookingPendingApproval === "true") return

      const row = bar.closest<HTMLElement>('[data-booking-bed-row="true"]')
      const timeline = row?.querySelector<HTMLElement>('[data-booking-timeline-row="true"]')
      const dayCells = timeline?.querySelectorAll<HTMLButtonElement>(":scope > div.absolute.inset-0.flex > button")
      const reservationId = bar.dataset.reservationId
      const bedId = bar.dataset.bedId
      const roomId = bar.dataset.roomId
      const checkIn = bar.dataset.checkIn
      const checkOut = bar.dataset.checkOut
      if (!row || !timeline || !dayCells?.length || !reservationId || !bedId || !roomId || !checkIn || !checkOut) return

      const edge = target.closest<HTMLElement>("[data-booking-resize-edge]")?.dataset.bookingResizeEdge
      const mode: BookingDragMode = edge === "start"
        ? "resize-start"
        : edge === "end"
          ? "resize-end"
          : "move"
      const timelineRect = timeline.getBoundingClientRect()
      const scrollContainer = timeline.closest<HTMLElement>(".overflow-auto")

      try {
        bar.setPointerCapture(event.pointerId)
      } catch {
        // Window listeners remain as the fallback when capture is unavailable.
      }
      bar.focus({ preventScroll: true })

      session = {
        bar,
        sourceRow: row,
        targetRow: row,
        scrollContainer,
        mode,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        reservationId,
        originalBedId: bedId,
        originalRoomId: roomId,
        originalCheckIn: checkIn,
        originalCheckOut: checkOut,
        originalLeft: bar.style.left,
        originalWidth: bar.style.width || `${bar.getBoundingClientRect().width}px`,
        originalTransform: bar.style.transform,
        originalTransition: bar.style.transition,
        startX: event.clientX,
        startY: event.clientY,
        initialScrollLeft: scrollContainer?.scrollLeft ?? 0,
        initialScrollTop: scrollContainer?.scrollTop ?? 0,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        dayWidth: timelineRect.width / dayCells.length,
        active: false,
        targetBedId: bedId,
        targetRoomId: roomId,
        targetCheckIn: checkIn,
        targetCheckOut: checkOut,
        valid: true,
        validationMessage: "",
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!session || event.pointerId !== session.pointerId) return
      updateFromPointer(event.clientX, event.clientY)
      if (session.active) {
        event.preventDefault()
        ensureAutoScroll()
      }
    }

    const onClickCapture = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil && (event.target as HTMLElement).closest('[data-booking-reservation="true"]')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelDrag()
    }

    void loadOperationalContext()
    const observer = new MutationObserver(ensureInteractionElements)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("click", onClickCapture, true)
    window.addEventListener("pointermove", onPointerMove, { passive: false })
    window.addEventListener("pointerup", finishDrag, { passive: false })
    window.addEventListener("pointercancel", cancelDrag)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("blur", cancelDrag)

    const contextChannel = supabase
      .channel("booking-timeline-drag-context")
      .on("postgres_changes", { event: "*", schema: "public", table: "operational_approval_requests" }, () => void loadOperationalContext())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadOperationalContext())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, () => void loadOperationalContext())
      .on("postgres_changes", { event: "*", schema: "public", table: "beds" }, () => void loadOperationalContext())
      .subscribe()

    return () => {
      disposed = true
      stopAutoScroll()
      cancelDrag()
      observer.disconnect()
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("click", onClickCapture, true)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", finishDrag)
      window.removeEventListener("pointercancel", cancelDrag)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("blur", cancelDrag)
      void supabase.removeChannel(contextChannel)
    }
  }, [supabase])

  return (
    <>
      <style jsx global>{`
        [data-booking-reservation="true"] {
          cursor: grab;
          touch-action: none;
          user-select: none;
        }
        [data-booking-reservation="true"][data-booking-dragging="true"] {
          cursor: grabbing;
        }
        [data-booking-reservation="true"][data-booking-pending-approval="true"] {
          cursor: not-allowed;
          outline: 1px dashed var(--primary);
          outline-offset: 2px;
        }
        [data-booking-resize-edge] {
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: 4;
          width: 18px;
          opacity: 0;
          cursor: ew-resize;
          transition: opacity 120ms ease;
        }
        [data-booking-resize-edge]::after {
          position: absolute;
          top: 22%;
          bottom: 22%;
          width: 2px;
          content: "";
          background: color-mix(in srgb, var(--text-primary) 50%, transparent);
        }
        [data-booking-resize-edge="start"] { left: 0; }
        [data-booking-resize-edge="start"]::after { left: 5px; }
        [data-booking-resize-edge="end"] { right: 0; }
        [data-booking-resize-edge="end"]::after { right: 5px; }
        [data-booking-reservation="true"]:hover [data-booking-resize-edge],
        [data-booking-reservation="true"]:focus-visible [data-booking-resize-edge],
        [data-booking-reservation="true"][data-booking-dragging="true"] [data-booking-resize-edge] {
          opacity: 1;
        }
        [data-booking-bed-row="true"][data-booking-candidate-state="valid"] [data-booking-timeline-row="true"] {
          background: color-mix(in srgb, var(--primary) 7%, transparent);
        }
        [data-booking-bed-row="true"][data-booking-candidate-state="invalid"] [data-booking-timeline-row="true"] {
          opacity: 0.48;
        }
        [data-booking-bed-row="true"][data-booking-drop-state="valid"] [data-booking-timeline-row="true"] {
          opacity: 1;
          box-shadow: inset 0 0 0 2px var(--primary);
        }
        [data-booking-bed-row="true"][data-booking-drop-state="invalid"] [data-booking-timeline-row="true"] {
          opacity: 1;
          box-shadow: inset 0 0 0 2px var(--destructive);
        }
        @media (pointer: coarse) {
          [data-booking-resize-edge] {
            width: 24px;
            opacity: 0.62;
          }
          [data-booking-resize-edge="start"]::after { left: 7px; }
          [data-booking-resize-edge="end"]::after { right: 7px; }
        }
      `}</style>

      {preview && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="pointer-events-none fixed left-1/2 top-20 z-[90] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 bg-[var(--surface-2)] px-4 py-3 text-[var(--text-primary)] shadow-none"
        >
          <div className="flex items-start gap-3">
            {preview.valid
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
              : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]" />}
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <MoveHorizontal className="h-4 w-4" />
                {modeLabel(preview.mode)} · {preview.guestName}
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
    </>
  )
}
