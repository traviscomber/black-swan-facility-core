export const ACTIVE_RESERVATION_STATUSES = new Set([
  "pending",
  "confirmed",
  "waiting_for_room",
  "ready_for_checkin",
  "checked_in",
  "checked-in",
])

export function hasValidStayDates(checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn}T00:00:00Z`)
  const end = Date.parse(`${checkOut}T00:00:00Z`)
  return Number.isFinite(start) && Number.isFinite(end) && end > start
}

export function staysOverlap(
  firstCheckIn: string,
  firstCheckOut: string,
  secondCheckIn: string,
  secondCheckOut: string,
) {
  if (!hasValidStayDates(firstCheckIn, firstCheckOut) || !hasValidStayDates(secondCheckIn, secondCheckOut)) {
    return false
  }

  return firstCheckIn < secondCheckOut && firstCheckOut > secondCheckIn
}

export function isActiveReservationStatus(status: string | null | undefined) {
  return ACTIVE_RESERVATION_STATUSES.has((status ?? "").trim().toLowerCase())
}
