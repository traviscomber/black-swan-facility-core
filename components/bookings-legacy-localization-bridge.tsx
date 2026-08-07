"use client"

import { useEffect } from "react"
import { useLanguage, type Language } from "@/lib/hooks/use-language"

type TargetLocale = Exclude<Language, "es">

const EXACT: Record<TargetLocale, Record<string, string>> = {
  en: {
    "Reservas y operación de hospitalidad": "Reservations and hospitality operations",
    "Timeline único por propiedad, habitación y cama para reservas, estado operativo, housekeeping, atención al huésped, pagos y bloqueos.": "Unified timeline by property, room and bed for reservations, operational status, housekeeping, guest service, payments and blocks.",
    "Nueva reserva": "New reservation",
    "Llegadas hoy": "Today's arrivals",
    "Salidas hoy": "Today's departures",
    "Ocupadas hoy": "Occupied today",
    "Habitaciones no listas": "Rooms not ready",
    "Limpiezas pendientes": "Pending cleanings",
    "Solicitudes abiertas": "Open requests",
    "Hoy": "Today",
    "Todas las propiedades": "All properties",
    "Buscar propiedad, habitación, cama o estado": "Search property, room, bed or status",
    "Propiedad / habitación / cama": "Property / room / bed",
    "Cargando operación…": "Loading operations…",
    "No hay habitaciones para los filtros seleccionados.": "No rooms match the selected filters.",
    "Lista": "Ready", "Sucia": "Dirty", "En limpieza": "Cleaning", "Pendiente inspección": "Pending inspection", "Inspeccionada": "Inspected", "Ocupada": "Occupied", "Fuera de servicio": "Out of service", "Fuera de inventario": "Out of inventory",
    "Pendiente": "Pending", "Confirmada": "Confirmed", "Esperando habitación": "Waiting for room", "Lista para check-in": "Ready for check-in", "Alojado": "Checked in", "Salida registrada": "Checked out", "Cancelada": "Cancelled",
    "Asignada": "Assigned", "En curso": "In progress", "Completada": "Completed", "Resuelta": "Resolved",
    "Limpieza de salida": "Turnover cleaning", "Preparación de habitación": "Room preparation", "Inspección operativa": "Operational inspection", "Limpieza": "Cleaning", "Limpieza profunda": "Deep cleaning", "Preparación previa a llegada": "Pre-arrival preparation", "Inspección previa a llegada": "Pre-arrival inspection", "Limpieza posterior a salida": "Post-checkout cleaning", "Lavandería posterior a salida": "Post-checkout laundry", "Revisión de daños": "Damage review", "Reposición posterior a salida": "Post-checkout restock", "Liberación de habitación": "Room release",
    "Bloqueo": "Block", "Sin tipo": "No type", "Retroceder siete días": "Previous seven days", "Avanzar siete días": "Next seven days", "Filtrar por propiedad": "Filter by property", "Actualizar calendario": "Refresh calendar",
    "Solicitudes históricas del huésped": "Guest request history", "No hay solicitudes históricas vinculadas.": "No linked historical requests.", "Sin fecha": "No date", "sin estado": "no status",
    "Incidencias vinculadas": "Linked issues", "No hay incidencias vinculadas a esta reserva.": "No issues are linked to this reservation.", "Incidencia": "Issue", "prioridad no registrada": "priority not recorded",
    "Housekeeping activo": "Active housekeeping", "No hay tareas abiertas asociadas a esta reserva.": "No open tasks are linked to this reservation.", "Vinculada a reserva": "Linked to reservation", "Histórica por habitación": "Room history", "Iniciar": "Start", "Completar": "Complete",
    "Solicitudes activas de Hospitality": "Active Hospitality requests", "No hay solicitudes abiertas asociadas a esta reserva.": "No open requests are linked to this reservation.", "Tablet de huésped": "Guest tablet", "Registro interno": "Internal record", "Poner en curso": "Start processing",
    "Reserva y estadía": "Reservation and stay", "Confirmar reserva": "Confirm reservation", "Registrar check-in": "Register check-in", "Registrar llegada y enviar a cola": "Register arrival and queue", "Registrar check-out": "Register check-out", "Marcar pago recibido": "Mark payment received", "Marcar pago pendiente": "Mark payment pending",
    "Crear Housekeeping": "Create housekeeping", "Generar limpieza de salida": "Create turnover cleaning", "Preparar habitación": "Prepare room", "Crear inspección operativa": "Create operational inspection",
    "Crear Hospitality": "Create Hospitality", "Solicitud del huésped": "Guest request", "Recepción o traslado": "Reception or transfer", "Amenidad o preparación especial": "Amenity or special preparation", "Sin detalle adicional.": "No additional details.",
    "Fri": "Fri", "Sat": "Sat", "Sun": "Sun", "Mon": "Mon", "Tue": "Tue", "Wed": "Wed", "Thu": "Thu",
  },
  de: {
    "Reservas y operación de hospitalidad": "Reservierungen und Hospitality-Betrieb",
    "Timeline único por propiedad, habitación y cama para reservas, estado operativo, housekeeping, atención al huésped, pagos y bloqueos.": "Einheitliche Zeitleiste nach Unterkunft, Zimmer und Bett für Reservierungen, Betriebsstatus, Housekeeping, Gästeservice, Zahlungen und Sperren.",
    "Nueva reserva": "Neue Reservierung",
    "Llegadas hoy": "Heutige Anreisen",
    "Salidas hoy": "Heutige Abreisen",
    "Ocupadas hoy": "Heute belegt",
    "Habitaciones no listas": "Zimmer nicht bereit",
    "Limpiezas pendientes": "Offene Reinigungen",
    "Solicitudes abiertas": "Offene Anfragen",
    "Hoy": "Heute",
    "Todas las propiedades": "Alle Unterkünfte",
    "Buscar propiedad, habitación, cama o estado": "Unterkunft, Zimmer, Bett oder Status suchen",
    "Propiedad / habitación / cama": "Unterkunft / Zimmer / Bett",
    "Cargando operación…": "Betrieb wird geladen…",
    "No hay habitaciones para los filtros seleccionados.": "Keine Zimmer entsprechen den gewählten Filtern.",
    "Lista": "Bereit", "Sucia": "Schmutzig", "En limpieza": "In Reinigung", "Pendiente inspección": "Prüfung ausstehend", "Inspeccionada": "Geprüft", "Ocupada": "Belegt", "Fuera de servicio": "Außer Betrieb", "Fuera de inventario": "Nicht im Bestand",
    "Pendiente": "Ausstehend", "Confirmada": "Bestätigt", "Esperando habitación": "Wartet auf Zimmer", "Lista para check-in": "Bereit zum Check-in", "Alojado": "Eingecheckt", "Salida registrada": "Ausgecheckt", "Cancelada": "Storniert",
    "Asignada": "Zugewiesen", "En curso": "In Bearbeitung", "Completada": "Abgeschlossen", "Resuelta": "Erledigt",
    "Limpieza de salida": "Abreisereinigung", "Preparación de habitación": "Zimmer vorbereiten", "Inspección operativa": "Betriebsprüfung", "Limpieza": "Reinigung", "Limpieza profunda": "Grundreinigung", "Preparación previa a llegada": "Vorbereitung vor Anreise", "Inspección previa a llegada": "Prüfung vor Anreise", "Limpieza posterior a salida": "Reinigung nach Abreise", "Lavandería posterior a salida": "Wäsche nach Abreise", "Revisión de daños": "Schadensprüfung", "Reposición posterior a salida": "Nachbestückung nach Abreise", "Liberación de habitación": "Zimmer freigeben",
    "Bloqueo": "Sperre", "Sin tipo": "Ohne Typ", "Retroceder siete días": "Sieben Tage zurück", "Avanzar siete Tage": "Sieben Tage vor", "Avanzar siete días": "Sieben Tage vor", "Filtrar por propiedad": "Nach Unterkunft filtern", "Actualizar calendario": "Kalender aktualisieren",
    "Solicitudes históricas del huésped": "Frühere Gästeanfragen", "No hay solicitudes históricas vinculadas.": "Keine verknüpften früheren Anfragen.", "Sin fecha": "Kein Datum", "sin estado": "ohne Status",
    "Incidencias vinculadas": "Verknüpfte Vorfälle", "No hay incidencias vinculadas a esta reserva.": "Mit dieser Reservierung sind keine Vorfälle verknüpft.", "Incidencia": "Vorfall", "prioridad no registrada": "Priorität nicht erfasst",
    "Housekeeping activo": "Aktives Housekeeping", "No hay tareas abiertas asociadas a esta reserva.": "Mit dieser Reservierung sind keine offenen Aufgaben verknüpft.", "Vinculada a reserva": "Mit Reservierung verknüpft", "Histórica por habitación": "Zimmerverlauf", "Iniciar": "Starten", "Completar": "Abschließen",
    "Solicitudes activas de Hospitality": "Aktive Hospitality-Anfragen", "No hay solicitudes abiertas asociadas a esta reserva.": "Mit dieser Reservierung sind keine offenen Anfragen verknüpft.", "Tablet de huésped": "Gäste-Tablet", "Registro interno": "Interner Eintrag", "Poner en curso": "Bearbeitung starten",
    "Reserva y estadía": "Reservierung und Aufenthalt", "Confirmar reserva": "Reservierung bestätigen", "Registrar check-in": "Check-in erfassen", "Registrar llegada y enviar a cola": "Anreise erfassen und einreihen", "Registrar check-out": "Check-out erfassen", "Marcar pago recibido": "Zahlung als erhalten markieren", "Marcar pago pendiente": "Zahlung als ausstehend markieren",
    "Crear Housekeeping": "Housekeeping erstellen", "Generar limpieza de salida": "Abreisereinigung erstellen", "Preparar habitación": "Zimmer vorbereiten", "Crear inspección operativa": "Betriebsprüfung erstellen",
    "Crear Hospitality": "Hospitality erstellen", "Solicitud del huésped": "Gästeanfrage", "Recepción o traslado": "Empfang oder Transfer", "Amenidad o preparación especial": "Ausstattung oder Sondervorbereitung", "Sin detalle adicional.": "Keine zusätzlichen Angaben.",
    "Fri": "Fr", "Sat": "Sa", "Sun": "So", "Mon": "Mo", "Tue": "Di", "Wed": "Mi", "Thu": "Do",
  },
}

const ES_DATE: Record<string, string> = { Fri: "Vie", Sat: "Sáb", Sun: "Dom", Mon: "Lun", Tue: "Mar", Wed: "Mié", Thu: "Jue" }

function replaceDynamic(value: string, locale: Language) {
  if (locale === "es") return ES_DATE[value] ?? value

  const exact = EXACT[locale][value]
  if (exact) return exact

  if (locale === "de") {
    return value
      .replace(/^(\d+) habitaciones$/, "$1 Zimmer")
      .replace(/^(\d+) habitación$/, "$1 Zimmer")
      .replace(/^(.*) · (\d+) camas$/, "$1 · $2 Betten")
      .replace(/^(.*) · (\d+) cama$/, "$1 · $2 Bett")
      .replace(/^Cama (.+)$/, "Bett $1")
      .replace(/^Bloqueo · /, "Sperre · ")
      .replace(/^Prioridad (.+)$/, "Priorität $1")
  }

  return value
    .replace(/^(\d+) habitaciones$/, "$1 rooms")
    .replace(/^(\d+) habitación$/, "$1 room")
    .replace(/^(.*) · (\d+) camas$/, "$1 · $2 beds")
    .replace(/^(.*) · (\d+) cama$/, "$1 · $2 bed")
    .replace(/^Cama (.+)$/, "Bed $1")
    .replace(/^Bloqueo · /, "Block · ")
    .replace(/^Prioridad (.+)$/, "Priority $1")
}

function translateTree(root: HTMLElement, locale: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  for (const node of textNodes) {
    const parent = node.parentElement
    if (!parent || parent.closest("script, style")) continue
    const raw = node.nodeValue ?? ""
    const leading = raw.match(/^\s*/)?.[0] ?? ""
    const trailing = raw.match(/\s*$/)?.[0] ?? ""
    const value = raw.trim()
    if (!value) continue
    const translated = replaceDynamic(value, locale)
    if (translated !== value) node.nodeValue = `${leading}${translated}${trailing}`
  }

  for (const element of Array.from(root.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]"))) {
    for (const attribute of ["placeholder", "aria-label", "title"] as const) {
      const value = element.getAttribute(attribute)
      if (!value) continue
      const translated = replaceDynamic(value, locale)
      if (translated !== value) element.setAttribute(attribute, translated)
    }
  }
}

export function BookingsLegacyLocalizationBridge() {
  const { language } = useLanguage()

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".booking-workspace")
    if (!root) return

    const run = () => translateTree(root, language)
    run()
    const observer = new MutationObserver(run)
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] })
    return () => observer.disconnect()
  }, [language])

  return null
}
