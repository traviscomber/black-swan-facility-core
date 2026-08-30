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

const POLICY_COPY: Record<Language, Record<BookingSourcePolicy, string>> = {
  en: {
    "external-read-only": "Synced reservation: room or date changes must be made in the source channel.",
    review: "Unclassified source: the system will validate again and may require approval.",
    editable: "Reservation can be edited from the calendar.",
  },
  es: {
    "external-read-only": "Reserva sincronizada: los cambios de habitación o fechas deben realizarse en el canal de origen.",
    review: "Origen no clasificado: el sistema volverá a validar y puede requerir aprobación.",
    editable: "Reserva editable desde el calendario.",
  },
  de: {
    "external-read-only": "Synchronisierte Reservierung: Zimmer- oder Datumsänderungen müssen im Ursprungskanal vorgenommen werden.",
    review: "Nicht klassifizierte Quelle: Das System validiert erneut und kann eine Freigabe erfordern.",
    editable: "Reservierung kann im Kalender bearbeitet werden.",
  },
}

export function normalizeBookingSource(source: string | null | undefined) {
  return (source ?? "").trim().toLowerCase()
}

export function bookingSourcePolicy(source: string | null | undefined): BookingSourcePolicy {
  const normalized = normalizeBookingSource(source)
  if (EDITABLE_SOURCES.has(normalized)) return "editable"
  if (EXTERNAL_READ_ONLY_PATTERN.test(normalized)) return "external-read-only"
  return "review"
}

export function bookingSourcePolicyLabel(source: string | null | undefined, language: Language = "es") {
  return POLICY_COPY[language][bookingSourcePolicy(source)]
}
