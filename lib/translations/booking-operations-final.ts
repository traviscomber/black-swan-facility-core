import type { Language } from "@/lib/hooks/use-language"

const exact: Record<Language, Record<string, string>> = {
  en: {
    "Cerrar panel": "Close panel",
    "Operación de estadía": "Stay operations",
    "Huéspedes": "Guests",
    "Monto": "Amount",
    "Solicitudes especiales": "Special requests",
    "Preparación de habitación": "Room preparation",
    "Estado operativo actual": "Current operational status",
    "El check-in solo se completa cuando la habitación está lista o inspeccionada.": "Check-in can only be completed when the room is ready or inspected.",
    "Sin estado": "No status",
    "Marcar lista": "Mark ready",
    "Cargando operaciones vinculadas…": "Loading linked operations…",
    "Reintentar": "Retry",
    "Operaciones": "Operations",
    "Servicios / cargos": "Services / charges",
    "Monto extras": "Extras amount",
    "Servicios y cargos": "Services and charges",
    "No hay servicios cargados y el catálogo aún está vacío.": "No services have been added and the catalog is still empty.",
    "No hay servicios cargados a esta reserva.": "No services have been added to this reservation.",
    "Prioridad": "Priority",
    "normal": "normal",
    "No fue posible cargar el timeline": "Could not load the timeline",
    "Pago": "Payment",
    "sin registrar": "not recorded",
    "Origen": "Source",
    "interno": "internal",
  },
  es: {},
  de: {
    "Cerrar panel": "Panel schließen",
    "Operación de estadía": "Aufenthaltsbetrieb",
    "Huéspedes": "Gäste",
    "Monto": "Betrag",
    "Solicitudes especiales": "Sonderwünsche",
    "Preparación de habitación": "Zimmervorbereitung",
    "Estado operativo actual": "Aktueller Betriebsstatus",
    "El check-in solo se completa cuando la habitación está lista o inspeccionada.": "Der Check-in kann erst abgeschlossen werden, wenn das Zimmer bereit oder geprüft ist.",
    "Sin estado": "Kein Status",
    "Marcar lista": "Als bereit markieren",
    "Cargando operaciones vinculadas…": "Verknüpfte Vorgänge werden geladen…",
    "Reintentar": "Erneut versuchen",
    "Operaciones": "Vorgänge",
    "Servicios / cargos": "Leistungen / Gebühren",
    "Monto extras": "Betrag für Zusatzleistungen",
    "Servicios y cargos": "Leistungen und Gebühren",
    "No hay servicios cargados y el catálogo aún está vacío.": "Es wurden keine Leistungen hinzugefügt und der Katalog ist noch leer.",
    "No hay servicios cargados a esta reserva.": "Für diese Reservierung wurden keine Leistungen hinzugefügt.",
    "Prioridad": "Priorität",
    "normal": "normal",
    "No fue posible cargar el timeline": "Die Zeitleiste konnte nicht geladen werden",
    "Pago": "Zahlung",
    "sin registrar": "nicht erfasst",
    "Origen": "Quelle",
    "interno": "intern",
  },
}

const months: Record<Language, Record<string, string>> = {
  en: {},
  es: { Jan: "ene", Feb: "feb", Mar: "mar", Apr: "abr", May: "may", Jun: "jun", Jul: "jul", Aug: "ago", Sep: "sep", Oct: "oct", Nov: "nov", Dec: "dic" },
  de: { Jan: "Jan", Feb: "Feb", Mar: "Mär", Apr: "Apr", May: "Mai", Jun: "Jun", Jul: "Jul", Aug: "Aug", Sep: "Sep", Oct: "Okt", Nov: "Nov", Dec: "Dez" },
}

const dynamicPrefixes: Record<Language, { payment: string; source: string; bed: string; priority: string; timelineError: string }> = {
  en: { payment: "Payment: ", source: "Source: ", bed: "Bed $1", priority: "Priority $1", timelineError: "Could not load the timeline: $1" },
  es: { payment: "Pago: ", source: "Origen: ", bed: "Cama $1", priority: "Prioridad $1", timelineError: "No fue posible cargar el timeline: $1" },
  de: { payment: "Zahlung: ", source: "Quelle: ", bed: "Bett $1", priority: "Priorität $1", timelineError: "Die Zeitleiste konnte nicht geladen werden: $1" },
}

export function translateBookingOperationsFinal(value: string, language: Language) {
  const direct = exact[language][value]
  if (direct) return replaceMonths(direct, language)

  const prefix = dynamicPrefixes[language]
  let result = value
  result = result.replace(/^Pago:\s*/u, prefix.payment)
  result = result.replace(/^Origen:\s*/u, prefix.source)
  result = result.replace(/^Cama\s+(\S+)$/u, prefix.bed)
  result = result.replace(/^Prioridad\s+(.+)$/u, prefix.priority)
  result = result.replace(/^No fue posible cargar el timeline:\s*(.+)$/u, prefix.timelineError)
  return replaceMonths(result, language)
}

function replaceMonths(value: string, language: Language) {
  let result = value
  for (const [source, target] of Object.entries(months[language])) {
    result = result.replace(new RegExp(`\\b${source}\\b`, "g"), target)
  }
  return result
}
