"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"
import { AlertTriangle, CheckCircle2, MoveHorizontal } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

type DragMode = "move" | "resize-start" | "resize-end"

type DragPreview = {
  guestName: string
  targetLabel: string
  checkIn: string
  checkOut: string
  valid: boolean
  message: string
}

type DragSession = {
  bar: HTMLButtonElement
  sourceRow: HTMLElement
  targetRow: HTMLElement
  mode: DragMode
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

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && endA > startB
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
    if (distance > 48) return nearest
    if (!nearest) return row
    const nearestRect = nearest.getBoundingClientRect()
    const nearestDistance = Math.abs(clientY - (nearestRect.top + nearestRect.height / 2))
    return distance < nearestDistance ? row : nearest
  }, null)
}

function clearDropStates() {
  document.querySelectorAll<HTMLElement>('[data-booking-bed-row="true"]').forEach((row) => {
    delete row.dataset.bookingDropState
  })
}

function restoreBar(session: DragSession) {
  session.bar.style.left = session.originalLeft
  session.bar.style.width = session.originalWidth
  session.bar.style.transform = session.originalTransform
  session.bar.style.transition = session.originalTransition
  session.bar.style.pointerEvents = ""
  session.bar.style.opacity = ""
  session.bar.style.zIndex = ""
  session.bar.removeAttribute("aria-grabbed")
  delete session.bar.dataset.bookingDragging
  clearDropStates()
}

function targetLabel(row: HTMLElement) {
  const location = row.dataset.locationName ?? "Propiedad"
  const room = row.dataset.roomNumber ?? "Habitación"
  const bed = row.dataset.bedNumber ?? ""
  return `${location} · ${room}${bed ? ` · Cama ${bed}` : ""}`
}

export function BookingTimelineDragDrop() {
  const supabase = useMemo(() => createClient(), [])
  const [preview, setPreview] = useState<DragPreview | null>(null)

  useEffect(() => {
    let disposed = false
    let session: DragSession | null = null
    let suppressClickUntil = 0
    let blocks: RoomBlock[] = []
    let pendingReservationIds = new Set<string>()

    const applyPendingState = () => {
      document.querySelectorAll<HTMLButtonElement>('[data-booking-reservation="true"]').forEach((bar) => {
        const pending = Boolean(bar.dataset.reservationId && pendingReservationIds.has(bar.dataset.reservationId))
        bar.dataset.bookingPendingApproval = pending ? "true" : "false"
        if (pending) bar.title = "Cambio pendiente de aprobación de Santiago"
      })
    }

    const ensureInteractionElements = () => {
      document.querySelectorAll<HTMLButtonElement>('[data-booking-reservation="true"]').forEach((bar) => {
        bar.draggable = false
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
      const [pendingResult, blocksResult] = await Promise.all([
        supabase
          .from("operational_approval_requests")
          .select("reservation_id")
          .eq("status", "pending")
          .eq("action_key", "booking.modify"),
        supabase
          .from("room_blocks")
          .select("room_id, start_date, end_date")
          .eq("status", "active"),
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
      ensureInteractionElements()
    }

    const validateTarget = (
      current: DragSession,
      targetRow: HTMLElement,
      targetCheckIn: string,
      targetCheckOut: string,
    ) => {
      if (targetCheckOut <= targetCheckIn) return { valid: false, message: "La salida debe ser posterior a la llegada" }

      const status = targetRow.dataset.roomStatus
      if (status === "out_of_service" || status === "out_of_inventory") {
        return { valid: false, message: "La habitación está fuera de servicio o inventario" }
      }

      const targetBedId = targetRow.dataset.bedId
      const targetRoomId = targetRow.dataset.roomId
      if (!targetBedId || !targetRoomId) return { valid: false, message: "Destino no identificado" }

      const reservationConflict = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-booking-reservation="true"]'),
      ).some((bar) => {
        if (bar.dataset.reservationId === current.reservationId) return false
        if (bar.dataset.bedId !== targetBedId) return false
        const checkIn = bar.dataset.checkIn
        const checkOut = bar.dataset.checkOut
        return Boolean(checkIn && checkOut && overlaps(targetCheckIn, targetCheckOut, checkIn, checkOut))
      })

      if (reservationConflict) return { valid: false, message: "La cama ya tiene una reserva en esas fechas" }

      const blockConflict = blocks.some(
        (block) => block.room_id === targetRoomId && overlaps(targetCheckIn, targetCheckOut, block.start_date, block.end_date),
      )
      if (blockConflict) return { valid: false, message: "La habitación tiene un bloqueo operativo" }

      return { valid: true, message: "Destino disponible. Se validará nuevamente al soltar." }
    }

    const updatePreview = (event: PointerEvent) => {
      if (!session) return

      const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY)
      if (!session.active && distance < 5) return

      if (!session.active) {
        session.active = true
        session.bar.dataset.bookingDragging = "true"
        session.bar.setAttribute("aria-grabbed", "true")
        session.bar.style.transition = "none"
        session.bar.style.pointerEvents = "none"
        session.bar.style.opacity = "0.88"
        session.bar.style.zIndex = "80"
      }

      event.preventDefault()
      const dayDelta = Math.round((event.clientX - session.startX) / session.dayWidth)
      const nextRow = session.mode === "move" ? rowAtPoint(event.clientX, event.clientY) ?? session.sourceRow : session.sourceRow
      const originalCheckIn = parseISO(session.originalCheckIn)
      const originalCheckOut = parseISO(session.originalCheckOut)

      let targetCheckIn = session.originalCheckIn
      let targetCheckOut = session.originalCheckOut
      if (session.mode === "move") {
        targetCheckIn = format(addDays(originalCheckIn, dayDelta), "yyyy-MM-dd")
        targetCheckOut = format(addDays(originalCheckOut, dayDelta), "yyyy-MM-dd")
      } else if (session.mode === "resize-start") {
        targetCheckIn = format(addDays(originalCheckIn, dayDelta), "yyyy-MM-dd")
      } else {
        targetCheckOut = format(addDays(originalCheckOut, dayDelta), "yyyy-MM-dd")
      }

      const validation = validateTarget(session, nextRow, targetCheckIn, targetCheckOut)
      const sourceRect = session.sourceRow.getBoundingClientRect()
      const targetRect = nextRow.getBoundingClientRect()
      const translateY = session.mode === "move" ? targetRect.top - sourceRect.top : 0
      const translateX = dayDelta * session.dayWidth
      const originalWidth = Number.parseFloat(session.originalWidth || `${session.bar.getBoundingClientRect().width}`)

      if (session.mode === "move") {
        session.bar.style.transform = `translate(${translateX}px, ${translateY}px)`
      } else if (session.mode === "resize-start") {
        session.bar.style.transform = `translateX(${translateX}px)`
        session.bar.style.width = `${Math.max(20, originalWidth - translateX)}px`
      } else {
        session.bar.style.width = `${Math.max(20, originalWidth + translateX)}px`
      }

      clearDropStates()
      nextRow.dataset.bookingDropState = validation.valid ? "valid" : "invalid"

      session.targetRow = nextRow
      session.targetBedId = nextRow.dataset.bedId ?? session.originalBedId
      session.targetRoomId = nextRow.dataset.roomId ?? session.originalRoomId
      session.targetCheckIn = targetCheckIn
      session.targetCheckOut = targetCheckOut
      session.valid = validation.valid
      session.validationMessage = validation.message

      setPreview({
        guestName: session.bar.dataset.guestName ?? "Reserva",
        targetLabel: targetLabel(nextRow),
        checkIn: targetCheckIn,
        checkOut: targetCheckOut,
        valid: validation.valid,
        message: validation.message,
      })
    }

    const finishDrag = async (event: PointerEvent) => {
      if (!session) return
      const current = session
      session = null

      if (!current.active) return
      event.preventDefault()
      suppressClickUntil = Date.now() + 350
      setPreview(null)

      if (!current.valid) {
        toast.error(current.validationMessage)
        restoreBar(current)
        return
      }

      const changed =
        current.targetBedId !== current.originalBedId ||
        current.targetCheckIn !== current.originalCheckIn ||
        current.targetCheckOut !== current.originalCheckOut

      if (!changed) {
        restoreBar(current)
        return
      }

      current.bar.style.opacity = "0.55"
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
      const mode: DragMode = edge === "start" ? "resize-start" : edge === "end" ? "resize-end" : "move"
      const timelineRect = timeline.getBoundingClientRect()

      session = {
        bar,
        sourceRow: row,
        targetRow: row,
        mode,
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

    const onClickCapture = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil && (event.target as HTMLElement).closest('[data-booking-reservation="true"]')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    void loadOperationalContext()
    const observer = new MutationObserver(ensureInteractionElements)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("click", onClickCapture, true)
    window.addEventListener("pointermove", updatePreview, { passive: false })
    window.addEventListener("pointerup", finishDrag, { passive: false })
    window.addEventListener("pointercancel", cancelDrag)
    window.addEventListener("keydown", (event) => { if (event.key === "Escape") cancelDrag() })

    const approvalChannel = supabase
      .channel("booking-timeline-drag-approvals")
      .on("postgres_changes", { event: "*", schema: "public", table: "operational_approval_requests" }, () => void loadOperationalContext())
      .subscribe()

    return () => {
      disposed = true
      observer.disconnect()
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("click", onClickCapture, true)
      window.removeEventListener("pointermove", updatePreview)
      window.removeEventListener("pointerup", finishDrag)
      window.removeEventListener("pointercancel", cancelDrag)
      void supabase.removeChannel(approvalChannel)
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
          width: 9px;
          opacity: 0;
          background: color-mix(in srgb, var(--text-primary) 42%, transparent);
          transition: opacity 120ms ease;
          cursor: ew-resize;
        }
        [data-booking-resize-edge="start"] { left: 0; }
        [data-booking-resize-edge="end"] { right: 0; }
        [data-booking-reservation="true"]:hover [data-booking-resize-edge],
        [data-booking-reservation="true"][data-booking-dragging="true"] [data-booking-resize-edge] {
          opacity: 1;
        }
        [data-booking-bed-row="true"][data-booking-drop-state="valid"] [data-booking-timeline-row="true"] {
          box-shadow: inset 0 0 0 2px var(--primary);
        }
        [data-booking-bed-row="true"][data-booking-drop-state="invalid"] [data-booking-timeline-row="true"] {
          box-shadow: inset 0 0 0 2px var(--destructive);
        }
      `}</style>

      {preview && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-[90] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 bg-[var(--surface-2)] px-4 py-3 text-[var(--text-primary)] shadow-none">
          <div className="flex items-start gap-3">
            {preview.valid ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]" />}
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium"><MoveHorizontal className="h-4 w-4" />{preview.guestName}</p>
              <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{preview.targetLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{format(parseISO(preview.checkIn), "dd MMM yyyy")} → {format(parseISO(preview.checkOut), "dd MMM yyyy")}</p>
              <p className="mt-2 text-xs">{preview.message}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
