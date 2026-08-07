"use client"

import type React from "react"
import { AlertTriangle, ConciergeBell, Sparkles } from "lucide-react"
import { bookingSourcePolicy, bookingSourcePolicyLabel } from "@/lib/booking-source-policy"
import {
  RESERVATION_STYLES,
  futureEditable,
  iso,
  roomReady,
  sourceDescription,
  type BookingCalendarBed,
  type BookingCalendarReservation,
} from "@/components/booking-calendar-model"
import { useLanguage } from "@/lib/hooks/use-language"

type Geometry = { left: number; width: number }
type DragVisual = { reservationId: string; transform: string; width: number }

type BookingCalendarReservationBarProps = {
  reservation: BookingCalendarReservation
  bed: BookingCalendarBed
  roomStatus: string
  requestCount: number
  housekeepingCount: number
  geometry: (start: string, end: string) => Geometry
  dragVisual: DragVisual | null
  pending: boolean
  keyboardReservationId: string | null
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>, reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
  onClick: (reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
}

export function BookingCalendarReservationBar({
  reservation,
  bed,
  roomStatus,
  requestCount,
  housekeepingCount,
  geometry,
  dragVisual,
  pending,
  keyboardReservationId,
  onPointerDown,
  onKeyDown,
  onClick,
}: BookingCalendarReservationBarProps) {
  const { language } = useLanguage()
  const arrivalState = reservation.arrival_status
    && ["waiting_for_room", "ready_for_checkin"].includes(reservation.arrival_status)
    ? reservation.arrival_status
    : reservation.status
  const readinessWarning = reservation.check_in === iso(new Date())
    && !roomReady(roomStatus)
    && reservation.status === "confirmed"
  const baseGeometry = geometry(reservation.check_in, reservation.check_out)
  const visual = dragVisual?.reservationId === reservation.id ? dragVisual : null
  const policy = bookingSourcePolicy(reservation.source)
  const disabled = pending || policy === "external-read-only" || !futureEditable(reservation)
  const sourceLabel = sourceDescription(reservation.source, policy)
  const ariaLabel = language === "de"
    ? `${reservation.guest_name}. ${reservation.check_in} bis ${reservation.check_out}. Quelle ${sourceLabel}.`
    : language === "en"
      ? `${reservation.guest_name}. ${reservation.check_in} to ${reservation.check_out}. Source ${sourceLabel}.`
      : `${reservation.guest_name}. ${reservation.check_in} a ${reservation.check_out}. Origen ${sourceLabel}.`

  return (
    <button
      type="button"
      onPointerDown={(event) => onPointerDown(event, reservation, bed)}
      onKeyDown={(event) => onKeyDown(event, reservation, bed)}
      onClick={() => onClick(reservation, bed)}
      className={`absolute bottom-2 z-20 flex h-10 items-center justify-between gap-2 overflow-hidden rounded-md border px-3 text-left text-xs shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${disabled ? "cursor-not-allowed opacity-75" : "hover:-translate-y-0.5 hover:shadow"} ${RESERVATION_STYLES[arrivalState] ?? RESERVATION_STYLES[reservation.status] ?? "border-violet-300 bg-violet-100 text-violet-950"}`}
      style={{
        ...baseGeometry,
        width: visual?.width ?? baseGeometry.width,
        transform: visual?.transform,
        touchAction: visual ? "none" : "pan-y",
      }}
      aria-label={ariaLabel}
      title={policy === "external-read-only" ? bookingSourcePolicyLabel(reservation.source, language) : undefined}
      aria-grabbed={keyboardReservationId === reservation.id || Boolean(visual)}
      aria-disabled={disabled}
      aria-keyshortcuts="Space Enter Escape ArrowLeft ArrowRight ArrowUp ArrowDown Alt+ArrowLeft Alt+ArrowRight Shift+ArrowLeft Shift+ArrowRight"
      data-booking-reservation="true"
      data-booking-reservation-id={reservation.id}
      data-booking-bed-id={bed.id}
      data-booking-room-id={bed.room_id}
      data-booking-check-in={reservation.check_in}
      data-booking-check-out={reservation.check_out}
      data-booking-source-policy={policy}
      data-booking-pending-approval={pending ? "true" : "false"}
      data-booking-keyboard-grabbed={keyboardReservationId === reservation.id ? "true" : "false"}
      data-testid={`booking-reservation-${reservation.id}`}
    >
      <span
        data-booking-resize-edge="start"
        aria-hidden="true"
        className="absolute inset-y-0 left-0 z-10 w-7 cursor-ew-resize opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
      />
      <span className="flex min-w-0 items-center gap-1 truncate font-semibold">
        {readinessWarning && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{reservation.guest_name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 opacity-80">
        {housekeepingCount > 0 && (
          <span className="flex items-center gap-0.5 rounded bg-black/10 px-1.5 py-0.5">
            <Sparkles className="h-3 w-3" />{housekeepingCount}
          </span>
        )}
        {requestCount > 0 && (
          <span className="flex items-center gap-0.5 rounded bg-black/10 px-1.5 py-0.5">
            <ConciergeBell className="h-3 w-3" />{requestCount}
          </span>
        )}
        <span>{reservation.num_guests ?? 1}p</span>
      </span>
      <span
        data-booking-resize-edge="end"
        aria-hidden="true"
        className="absolute inset-y-0 right-0 z-10 w-7 cursor-ew-resize opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
      />
    </button>
  )
}
