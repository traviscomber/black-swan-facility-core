import type { Language } from "@/lib/hooks/use-language"

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

export function bookingSourcePolicyLabel(source: string | null | undefined, language: Language = "es") {
  const policy = bookingSourcePolicy(source)

  if (language === "de") {
    if (policy === "external-read-only") return "Synchronisierte Reservierung: Zimmer- oder Datumsänderungen müssen im Ursprungskanal vorgenommen werden."
    if (policy === "review") return "Nicht klassifizierte Quelle: Das System validiert erneut und kann eine Freigabe erfordern."
    return "Reservierung kann im Kalender bearbeitet werden."
  }

  if (language === "en") {
    if (policy === "external-read-only") return "Synced reservation: room or date changes must be made in the source channel."
    if (policy === "review") return "Unclassified source: the system will validate again and may require approval."
    return "Reservation can be edited from the calendar."
  }

  if (policy === "external-read-only") {
    return "Reserva sincronizada: los cambios de habitación o fechas deben realizarse en el canal de origen."
  }
  if (policy === "review") {
    return "Origen no clasificado: el sistema volverá a validar y puede requerir aprobación."
  }
  return "Reserva editable desde el calendario."
}
