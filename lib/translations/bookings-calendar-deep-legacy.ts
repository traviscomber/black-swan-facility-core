import type { Language } from "@/lib/hooks/use-language"

const exact: Record<Exclude<Language, "es">, Record<string, string>> = {
  en: {
    "Hitos": "Milestones",
    "Servicios": "Services",
    "Actividades": "Activities",
    "Pagos": "Payments",
    "Mantenimiento": "Maintenance",
    "Incidencias": "Issues",
    "Servicio": "Service",
    "Actividad": "Activity",
    "transporte": "transport",
    "Incidencia": "Issue",
    "Cargando operación relacionada…": "Loading related operations…",
    "Activa al menos una capa operacional.": "Enable at least one operational layer.",
    "Sin eventos": "No events",
    "Reserva": "Reservation",
    "Hospedado": "Checked in",
    "Finalizada": "Completed",
    "Cancelada": "Cancelled",
    "Habitación": "Room",
    "Sin asignar": "Unassigned",
    "Huéspedes": "Guests",
    "Pago": "Payment",
    "Operación relacionada": "Related operations",
    "Excepciones operacionales": "Operational exceptions",
    "Sin excepciones operacionales abiertas.": "No open operational exceptions.",
    "Mantenimiento": "Maintenance",
    "Incidencia": "Issue",
    "Estado": "Status",
    "Bloquea check-in": "Blocks check-in",
    "Vencida": "Overdue",
    "Objetivo": "Due",
    "Contacto": "Contact",
    "Confirmar reserva": "Confirm reservation",
    "Registrar check-in": "Register check-in",
    "Registrar check-out": "Register check-out",
    "Abrir ficha completa": "Open full record",
    "Los valores, estados y excepciones provienen de datos operacionales reales.": "Values, statuses and exceptions come from real operational data.",
    "Cargando reserva…": "Loading reservation…",
    "Hab.": "Room",
  },
  de: {
    "Hitos": "Meilensteine",
    "Servicios": "Services",
    "Actividades": "Aktivitäten",
    "Pagos": "Zahlungen",
    "Mantenimiento": "Wartung",
    "Incidencias": "Vorfälle",
    "Servicio": "Service",
    "Actividad": "Aktivität",
    "transporte": "Transport",
    "Incidencia": "Vorfall",
    "Cargando operación relacionada…": "Verknüpfte Vorgänge werden geladen…",
    "Activa al menos una capa operacional.": "Aktiviere mindestens eine betriebliche Ebene.",
    "Sin eventos": "Keine Ereignisse",
    "Reserva": "Reservierung",
    "Hospedado": "Eingecheckt",
    "Finalizada": "Abgeschlossen",
    "Cancelada": "Storniert",
    "Habitación": "Zimmer",
    "Sin asignar": "Nicht zugewiesen",
    "Huéspedes": "Gäste",
    "Pago": "Zahlung",
    "Operación relacionada": "Verknüpfte Vorgänge",
    "Excepciones operacionales": "Betriebliche Ausnahmen",
    "Sin excepciones operacionales abiertas.": "Keine offenen betrieblichen Ausnahmen.",
    "Estado": "Status",
    "Bloquea check-in": "Blockiert Check-in",
    "Vencida": "Überfällig",
    "Objetivo": "Fällig",
    "Contacto": "Kontakt",
    "Confirmar reserva": "Reservierung bestätigen",
    "Registrar check-in": "Check-in erfassen",
    "Registrar check-out": "Check-out erfassen",
    "Abrir ficha completa": "Vollständigen Datensatz öffnen",
    "Los valores, estados y excepciones provienen de datos operacionales reales.": "Werte, Status und Ausnahmen stammen aus realen Betriebsdaten.",
    "Cargando reserva…": "Reservierung wird geladen…",
    "Hab.": "Zi.",
  },
}

export function translateDeepCalendarValue(value: string, locale: Language) {
  if (locale === "es") return value
  const direct = exact[locale][value]
  if (direct) return direct

  if (locale === "de") {
    return value
      .replace(/^(\d+) bloquea check-in$/, "$1 blockiert Check-in")
      .replace(/^(\d+) vencidas?$/, "$1 überfällig")
      .replace(/^Estado: /, "Status: ")
      .replace(/^Objetivo: /, "Fällig: ")
      .replace(/^Hab\. (.+)$/, "Zi. $1")
      .replace(/ · transporte$/, " · Transport")
  }

  return value
    .replace(/^(\d+) bloquea check-in$/, "$1 blocks check-in")
    .replace(/^(\d+) vencidas?$/, "$1 overdue")
    .replace(/^Estado: /, "Status: ")
    .replace(/^Objetivo: /, "Due: ")
    .replace(/^Hab\. (.+)$/, "Room $1")
    .replace(/ · transporte$/, " · transport")
}
