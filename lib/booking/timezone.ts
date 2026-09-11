export const BOOKING_TIME_ZONE = "America/Santiago" as const

const bookingDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOOKING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function bookingDateKey(value: Date | number | string = new Date()): string {
  const date = value instanceof Date ? value : new Date(value)
  const parts = bookingDateFormatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) throw new Error("Unable to resolve booking date in America/Santiago")
  return `${year}-${month}-${day}`
}

export function bookingTodayDate(): Date {
  return new Date(`${bookingDateKey()}T12:00:00`)
}

export function formatBookingTimestamp(value: Date | number | string, locale = "es-CL", options: Intl.DateTimeFormatOptions = {}): string {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(locale, { timeZone: BOOKING_TIME_ZONE, ...options }).format(date)
}
