export type BookingSourcePolicy = "editable" | "review" | "external-read-only"

const EDITABLE_SOURCES = new Set([
  "",
  "internal",
  "manual",
  "direct",
  "phone",
  "email",
  "walk_in",
  "walk-in",
  "website",
  "canonical_event_xls",
  "legacy_import",
])

const EXTERNAL_READ_ONLY_PATTERN = /(ical|airbnb|booking(?:\.|_)?com|expedia|vrbo|agoda|trip(?:\.|_)?com|ota|channel(?:_|-)?manager)/i

export function normalizeBookingSource(source: string | null | undefined) {
  return (source ?? "").trim().toLocaleLowerCase("es-CL")
}

export function bookingSourcePolicy(source: string | null | undefined): BookingSourcePolicy {
  const normalized = normalizeBookingSource(source)
  if (EDITABLE_SOURCES.has(normalized)) return "editable"
  if (EXTERNAL_READ_ONLY_PATTERN.test(normalized)) return "external-read-only"
  return "review"
}

export function bookingSourcePolicyLabel(source: string | null | undefined) {
  const policy = bookingSourcePolicy(source)
  if (policy === "external-read-only") {
    return "Reserva sincronizada: los cambios de habitación o fechas deben realizarse en el canal de origen."
  }
  if (policy === "review") {
    return "Origen no clasificado: el sistema volverá a validar y puede requerir aprobación."
  }
  return "Reserva editable desde el calendario."
}
