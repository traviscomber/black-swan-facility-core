"use client"

import { useEffect } from "react"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"

const EXACT: Record<Exclude<Locale, "es">, Record<string, string>> = {
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
    "Lista": "Ready",
    "Sucia": "Dirty",
    "En limpieza": "Cleaning",
    "Pendiente inspección": "Pending inspection",
    "Inspeccionada": "Inspected",
    "Ocupada": "Occupied",
    "Fuera de servicio": "Out of service",
    "Fuera de inventario": "Out of inventory",
    "Pendiente": "Pending",
    "Confirmada": "Confirmed",
    "Esperando habitación": "Waiting for room",
    "Lista para check-in": "Ready for check-in",
    "Alojado": "Checked in",
    "Salida registrada": "Checked out",
    "Cancelada": "Cancelled",
    "Bloqueo": "Block",
    "Sin tipo": "No type",
    "Retroceder siete días": "Previous seven days",
    "Avanzar siete días": "Next seven days",
    "Filtrar por propiedad": "Filter by property",
    "Actualizar calendario": "Refresh calendar",
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
    "Lista": "Bereit",
    "Sucia": "Schmutzig",
    "En limpieza": "In Reinigung",
    "Pendiente inspección": "Prüfung ausstehend",
    "Inspeccionada": "Geprüft",
    "Ocupada": "Belegt",
    "Fuera de servicio": "Außer Betrieb",
    "Fuera de inventario": "Nicht im Bestand",
    "Pendiente": "Ausstehend",
    "Confirmada": "Bestätigt",
    "Esperando habitación": "Wartet auf Zimmer",
    "Lista para check-in": "Bereit zum Check-in",
    "Alojado": "Eingecheckt",
    "Salida registrada": "Ausgecheckt",
    "Cancelada": "Storniert",
    "Bloqueo": "Sperre",
    "Sin tipo": "Ohne Typ",
    "Retroceder siete días": "Sieben Tage zurück",
    "Avanzar siete días": "Sieben Tage vor",
    "Filtrar por propiedad": "Nach Unterkunft filtern",
    "Actualizar calendario": "Kalender aktualisieren",
    "Fri": "Fr", "Sat": "Sa", "Sun": "So", "Mon": "Mo", "Tue": "Di", "Wed": "Mi", "Thu": "Do",
  },
}

const ES_DATE: Record<string, string> = { Fri: "Vie", Sat: "Sáb", Sun: "Dom", Mon: "Lun", Tue: "Mar", Wed: "Mié", Thu: "Jue" }

function replaceDynamic(value: string, locale: Locale) {
  if (locale === "es") {
    return ES_DATE[value] ?? value
  }

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
  }

  return value
    .replace(/^(\d+) habitaciones$/, "$1 rooms")
    .replace(/^(\d+) habitación$/, "$1 room")
    .replace(/^(.*) · (\d+) camas$/, "$1 · $2 beds")
    .replace(/^(.*) · (\d+) cama$/, "$1 · $2 bed")
    .replace(/^Cama (.+)$/, "Bed $1")
    .replace(/^Bloqueo · /, "Block · ")
}

function translateTree(root: HTMLElement, locale: Locale) {
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
