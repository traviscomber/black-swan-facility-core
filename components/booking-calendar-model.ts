"use client"

import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { bookingStaysOverlap, type BookingDragMode } from "@/lib/booking-drag"
import type { BookingSourcePolicy } from "@/lib/booking-source-policy"

export type BookingCalendarLocation = { id: string; name: string }
export type BookingCalendarRoom = {
  id: string
  room_number: string
  room_type: string | null
  location_id: string
  operational_status: string
  location: BookingCalendarLocation | null
}
export type BookingCalendarBed = {
  id: string
  room_id: string
  bed_number: string
  bed_type: string | null
  is_available: boolean
  room: BookingCalendarRoom
}
export type BookingCalendarReservation = {
  id: string
  bed_id: string | null
  room_id: string | null
  location_id: string | null
  booking_type?: string | null
  guest_name: string
  guest_email?: string | null
  guest_phone?: string | null
  check_in: string
  check_out: string
  status: string
  arrival_status: string | null
  payment_status?: string | null
  num_guests: number | null
  total_amount?: number | null
  special_requests?: string | null
  source: string | null
}
export type BookingCalendarBlock = {
  id: string
  room_id: string
  start_date: string
  end_date: string
  block_type: string
  reason: string
  status: string
}
export type BookingCalendarHousekeeping = {
  reservation_id: string | null
  room_id: string | null
}
export type BookingCalendarHospitality = {
  reservation_id: string | null
  room_id: string | null
  guest_name: string | null
}
export type BookingCalendarRoomGroup = {
  room: BookingCalendarRoom
  beds: BookingCalendarBed[]
}
export type BookingCalendarLocationGroup = {
  location: BookingCalendarLocation
  rooms: BookingCalendarRoomGroup[]
}

export type MutationResult = {
  result?: "applied" | "queued" | "unchanged"
  message?: string
  request_id?: string
  change_id?: string
  undo_until?: string
}

export type ContextReservation = Pick<
  BookingCalendarReservation,
  | "id"
  | "bed_id"
  | "room_id"
  | "location_id"
  | "booking_type"
  | "guest_name"
  | "check_in"
  | "check_out"
  | "status"
  | "arrival_status"
  | "source"
>

export type CalendarContext = {
  pendingReservationIds: string[]
  unavailableBedIds: string[]
  activeReservations: ContextReservation[]
  blocks: BookingCalendarBlock[]
}

export type ApplyChangeInput = {
  reservationId: string
  targetBedId: string
  checkIn: string
  checkOut: string
  expectedBedId: string
  expectedCheckIn: string
  expectedCheckOut: string
  reason: string
}

export type ApplySwapInput = {
  reservationAId: string
  reservationBId: string
  expectedA: ContextReservation
  expectedB: ContextReservation
  reason: string
}

export type BookingCalendarTransport = {
  loadContext: () => Promise<CalendarContext>
  applyChange: (input: ApplyChangeInput) => Promise<MutationResult>
  applySwap: (input: ApplySwapInput) => Promise<MutationResult>
  undoChange: (changeId: string) => Promise<MutationResult>
}

export type Validation = {
  valid: boolean
  state: "valid" | "warning" | "invalid"
  message: string
  intent: "move" | "resize" | "swap"
  swapReservation: ContextReservation | null
}

export type Feedback = {
  guestName: string
  targetLabel: string
  checkIn: string
  checkOut: string
  nights: number
  mode: BookingDragMode | "create" | "swap"
  valid: boolean
  state: "valid" | "warning" | "invalid"
  message: string
}

export type DragSession = {
  pointerId: number
  pointerType: string
  element: HTMLButtonElement
  reservation: BookingCalendarReservation
  sourceBed: BookingCalendarBed
  targetBed: BookingCalendarBed
  mode: BookingDragMode
  startX: number
  startY: number
  lastX: number
  lastY: number
  initialScrollLeft: number
  initialScrollTop: number
  originalWidth: number
  active: boolean
  touchReady: boolean
  longPressTimer: number | null
  targetCheckIn: string
  targetCheckOut: string
  validation: Validation
}

export type CreateSession = {
  pointerId: number
  pointerType: string
  element: HTMLButtonElement
  bed: BookingCalendarBed
  startIndex: number
  currentIndex: number
  startX: number
  lastX: number
  initialScrollLeft: number
  active: boolean
  touchReady: boolean
  longPressTimer: number | null
  valid: boolean
  message: string
}

export type KeyboardSession = {
  reservation: BookingCalendarReservation
  sourceBed: BookingCalendarBed
  targetBed: BookingCalendarBed
  checkIn: string
  checkOut: string
  mode: BookingDragMode
  validation: Validation
}

export type BookingCalendarTimelineProps = {
  hierarchy: BookingCalendarLocationGroup[]
  reservations: BookingCalendarReservation[]
  blocks: BookingCalendarBlock[]
  housekeeping: BookingCalendarHousekeeping[]
  hospitality: BookingCalendarHospitality[]
  dates: Date[]
  startDate: Date
  endDate: Date
  dayWidth: number
  labelWidth: number
  expandedRooms: Set<string>
  loading: boolean
  onToggleRoom: (roomId: string) => void
  onOpenReservation: (reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
  onOpenNewReservation: (bed: BookingCalendarBed, checkIn: Date, checkOut: Date) => void
  onRefresh: () => Promise<void> | void
  transport?: BookingCalendarTransport
}

export const RESERVATION_STYLES: Record<string, string> = {
  pending: "border-amber-300 bg-amber-100 text-amber-950",
  confirmed: "border-blue-300 bg-blue-100 text-blue-950",
  waiting_for_room: "border-orange-300 bg-orange-100 text-orange-950",
  ready_for_checkin: "border-cyan-300 bg-cyan-100 text-cyan-950",
  checked_in: "border-emerald-300 bg-emerald-100 text-emerald-950",
  "checked-in": "border-emerald-300 bg-emerald-100 text-emerald-950",
  checked_out: "border-slate-300 bg-slate-100 text-slate-700",
  "checked-out": "border-slate-300 bg-slate-100 text-slate-700",
}

export const ROOM_STATUS_LABELS: Record<string, string> = {
  ready: "Lista",
  dirty: "Sucia",
  cleaning: "En limpieza",
  clean_pending_inspection: "Pendiente inspección",
  inspected: "Inspeccionada",
  occupied: "Ocupada",
  out_of_service: "Fuera de servicio",
  out_of_inventory: "Fuera de inventario",
}

export const ROOM_STATUS_CLASSES: Record<string, string> = {
  ready: "border-emerald-300 bg-emerald-50 text-emerald-800",
  inspected: "border-emerald-300 bg-emerald-50 text-emerald-800",
  dirty: "border-rose-300 bg-rose-50 text-rose-800",
  cleaning: "border-sky-300 bg-sky-50 text-sky-800",
  clean_pending_inspection: "border-amber-300 bg-amber-50 text-amber-800",
  occupied: "border-violet-300 bg-violet-50 text-violet-800",
  out_of_service: "border-red-400 bg-red-50 text-red-900",
  out_of_inventory: "border-slate-400 bg-slate-100 text-slate-800",
}

export function iso(date: Date) {
  return format(date, "yyyy-MM-dd")
}

export function roomReady(status: string | null | undefined) {
  return status === "ready" || status === "inspected"
}

export function normalizeName(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("es-CL")
}

export function targetLabel(bed: BookingCalendarBed) {
  const location = bed.room.location?.name ?? "Propiedad"
  return `${location} · ${bed.room.room_number} · Cama ${bed.bed_number}`
}

export function futureEditable(reservation: ContextReservation | BookingCalendarReservation) {
  return ["pending", "confirmed"].includes(reservation.status)
    && [null, "not_arrived", "expected"].includes(reservation.arrival_status)
}

export function sourceDescription(source: string | null | undefined, policy: BookingSourcePolicy) {
  const label = source?.trim() || "interno"
  return policy === "review" ? `${label} · revisar origen` : label
}

export function activeInventoryConflict(
  reservation: ContextReservation,
  bed: BookingCalendarBed,
  checkIn: string,
  checkOut: string,
) {
  if (!bookingStaysOverlap(checkIn, checkOut, reservation.check_in, reservation.check_out)) return false
  if (reservation.bed_id === bed.id) return true
  if (!reservation.bed_id && reservation.room_id === bed.room_id) return true
  return Boolean(
    reservation.booking_type === "LOCATION"
      && bed.room.location_id
      && reservation.location_id === bed.room.location_id,
  )
}

export function stableContextReservation(reservation: BookingCalendarReservation): ContextReservation {
  return {
    id: reservation.id,
    bed_id: reservation.bed_id,
    room_id: reservation.room_id,
    location_id: reservation.location_id,
    booking_type: reservation.booking_type ?? "BED",
    guest_name: reservation.guest_name,
    check_in: reservation.check_in,
    check_out: reservation.check_out,
    status: reservation.status,
    arrival_status: reservation.arrival_status,
    source: reservation.source,
  }
}

export function defaultValidation(mode: BookingDragMode): Validation {
  return {
    valid: true,
    state: "valid",
    message: "Destino disponible. Se validará nuevamente al confirmar.",
    intent: mode === "move" ? "move" : "resize",
    swapReservation: null,
  }
}

export function createSupabaseTransport(): BookingCalendarTransport {
  const supabase = createClient()

  return {
    async loadContext() {
      const today = format(new Date(), "yyyy-MM-dd")
      const [pendingResult, bedsResult, reservationsResult, blocksResult] = await Promise.all([
        supabase
          .from("operational_approval_requests")
          .select("reservation_id")
          .eq("status", "pending")
          .eq("action_key", "booking.modify"),
        supabase.from("beds").select("id, is_available"),
        supabase
          .from("reservations")
          .select("id, bed_id, room_id, location_id, booking_type, guest_name, check_in, check_out, status, arrival_status, source")
          .gt("check_out", today)
          .not("status", "in", "(cancelled,canceled,void,voided,checked_out,checked-out,no_show)"),
        supabase
          .from("room_blocks")
          .select("id, room_id, start_date, end_date, block_type, reason, status")
          .eq("status", "active"),
      ])

      const error = pendingResult.error || bedsResult.error || reservationsResult.error || blocksResult.error
      if (error) throw error

      return {
        pendingReservationIds: (pendingResult.data ?? [])
          .map((item: { reservation_id: string | null }) => item.reservation_id)
          .filter((value: string | null): value is string => Boolean(value)),
        unavailableBedIds: (bedsResult.data ?? [])
          .filter((bed: { id: string; is_available: boolean }) => !bed.is_available)
          .map((bed: { id: string; is_available: boolean }) => bed.id),
        activeReservations: (reservationsResult.data ?? []) as ContextReservation[],
        blocks: (blocksResult.data ?? []) as BookingCalendarBlock[],
      }
    },
    async applyChange(input) {
      const { data, error } = await supabase.rpc("apply_or_queue_booking_change", {
        p_reservation_id: input.reservationId,
        p_target_bed_id: input.targetBedId,
        p_check_in: input.checkIn,
        p_check_out: input.checkOut,
        p_expected_bed_id: input.expectedBedId,
        p_expected_check_in: input.expectedCheckIn,
        p_expected_check_out: input.expectedCheckOut,
        p_reason: input.reason,
      })
      if (error) throw error
      return (data ?? {}) as MutationResult
    },
    async applySwap(input) {
      const { data, error } = await supabase.rpc("apply_or_queue_booking_swap", {
        p_reservation_a_id: input.reservationAId,
        p_reservation_b_id: input.reservationBId,
        p_expected_a: input.expectedA,
        p_expected_b: input.expectedB,
        p_reason: input.reason,
      })
      if (error) throw error
      return (data ?? {}) as MutationResult
    },
    async undoChange(changeId) {
      const { data, error } = await supabase.rpc("undo_booking_change", {
        p_change_id: changeId,
      })
      if (error) throw error
      return (data ?? {}) as MutationResult
    },
  }
}
