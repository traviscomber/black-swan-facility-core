export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
  "void",
] as const

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

export const ARRIVAL_STATUSES = [
  "not_arrived",
  "expected",
  "arrived",
  "waiting_for_room",
  "ready_for_checkin",
  "checked_in",
  "departed",
  "no_show",
] as const

export type ArrivalStatus = (typeof ARRIVAL_STATUSES)[number]

export const ROOM_OPERATIONAL_STATUSES = [
  "ready",
  "dirty",
  "cleaning",
  "clean_pending_inspection",
  "inspected",
  "occupied",
  "out_of_service",
  "out_of_inventory",
] as const

export type RoomOperationalStatus = (typeof ROOM_OPERATIONAL_STATUSES)[number]

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  checked_in: "Alojado",
  checked_out: "Salida registrada",
  cancelled: "Cancelada",
  no_show: "No se presentó",
  void: "Anulada",
}

export const ARRIVAL_STATUS_LABELS: Record<ArrivalStatus, string> = {
  not_arrived: "Sin llegada registrada",
  expected: "Llegada esperada",
  arrived: "Huésped presente",
  waiting_for_room: "Esperando habitación",
  ready_for_checkin: "Lista para check-in",
  checked_in: "Check-in completado",
  departed: "Salida completada",
  no_show: "No se presentó",
}

export const ROOM_OPERATIONAL_STATUS_LABELS: Record<RoomOperationalStatus, string> = {
  ready: "Lista",
  dirty: "Sucia",
  cleaning: "En limpieza",
  clean_pending_inspection: "Pendiente de inspección",
  inspected: "Inspeccionada",
  occupied: "Ocupada",
  out_of_service: "Fuera de servicio",
  out_of_inventory: "Fuera de inventario",
}

const LEGACY_RESERVATION_STATUS_MAP: Record<string, ReservationStatus> = {
  "checked-in": "checked_in",
  "checked-out": "checked_out",
  canceled: "cancelled",
  voided: "void",
}

export function normalizeReservationStatus(value: string | null | undefined): ReservationStatus | null {
  if (!value) return null
  const normalized = LEGACY_RESERVATION_STATUS_MAP[value] ?? value
  return RESERVATION_STATUSES.includes(normalized as ReservationStatus)
    ? (normalized as ReservationStatus)
    : null
}

export function isRoomReadyForCheckIn(status: string | null | undefined): boolean {
  return status === "ready" || status === "inspected"
}

export function isClosedReservationStatus(status: string | null | undefined): boolean {
  const normalized = normalizeReservationStatus(status)
  return normalized === "checked_out" || normalized === "cancelled" || normalized === "no_show" || normalized === "void"
}

export const RESERVATION_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  pending: ["confirmed", "cancelled", "void"],
  confirmed: ["checked_in", "cancelled", "no_show", "void"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  no_show: [],
  void: [],
}

export const ROOM_OPERATIONAL_TRANSITIONS: Record<RoomOperationalStatus, readonly RoomOperationalStatus[]> = {
  ready: ["occupied", "dirty", "out_of_service", "out_of_inventory"],
  dirty: ["cleaning", "out_of_service", "out_of_inventory"],
  cleaning: ["clean_pending_inspection", "dirty", "out_of_service"],
  clean_pending_inspection: ["inspected", "dirty", "out_of_service"],
  inspected: ["ready", "occupied", "dirty", "out_of_service"],
  occupied: ["dirty", "out_of_service"],
  out_of_service: ["dirty", "cleaning", "ready", "out_of_inventory"],
  out_of_inventory: ["dirty", "ready", "out_of_service"],
}

export function canTransitionReservation(from: string | null | undefined, to: string): boolean {
  const normalizedFrom = normalizeReservationStatus(from)
  const normalizedTo = normalizeReservationStatus(to)
  if (!normalizedFrom || !normalizedTo) return false
  return RESERVATION_TRANSITIONS[normalizedFrom].includes(normalizedTo)
}

export function canTransitionRoomOperationalStatus(from: string, to: string): boolean {
  if (!ROOM_OPERATIONAL_STATUSES.includes(from as RoomOperationalStatus)) return false
  if (!ROOM_OPERATIONAL_STATUSES.includes(to as RoomOperationalStatus)) return false
  return ROOM_OPERATIONAL_TRANSITIONS[from as RoomOperationalStatus].includes(to as RoomOperationalStatus)
}
