import type { Language } from "@/lib/hooks/use-language"

const exact: Record<Exclude<Language, "es">, Record<string, string>> = {
  en: {
    "Hitos": "Milestones", "Servicios": "Services", "Actividades": "Activities", "Pagos": "Payments", "Incidencias": "Issues", "Mantenimiento": "Maintenance",
    "Pendiente": "Pending", "Confirmada": "Confirmed", "Hospedado": "Checked in", "Finalizada": "Completed", "Bloqueo": "Block",
    "Sin propiedad": "No property", "Capas": "Layers", "Resumen": "Summary", "Atajos": "Shortcuts",
    "Clic: inspector · doble clic: editar · arrastra: mover · extremos: fechas": "Click: inspect · double-click: edit · drag: move · edges: dates",
    "navegar": "navigate", "resumen": "summary", "capas": "layers", "seleccionar": "select", "ayuda": "help", "Todo": "All",
    "Deseleccionar todo": "Deselect all", "Seleccionar todo": "Select all", "Habitaciones": "Rooms", "Vista guardada": "Saved view", "Cargando disponibilidad…": "Loading availability...",
  },
  de: {
    "Hitos": "Meilensteine", "Servicios": "Services", "Actividades": "Aktivitäten", "Pagos": "Zahlungen", "Incidencias": "Vorfälle", "Mantenimiento": "Wartung",
    "Pendiente": "Ausstehend", "Confirmada": "Bestätigt", "Hospedado": "Eingecheckt", "Finalizada": "Abgeschlossen", "Bloqueo": "Sperre",
    "Sin propiedad": "Keine Unterkunft", "Capas": "Ebenen", "Resumen": "Übersicht", "Atajos": "Tastenkürzel",
    "Clic: inspector · doble clic: editar · arrastra: mover · extremos: fechas": "Klick: prüfen · Doppelklick: bearbeiten · Ziehen: verschieben · Ränder: Daten",
    "navegar": "navigieren", "resumen": "Übersicht", "capas": "Ebenen", "seleccionar": "auswählen", "ayuda": "Hilfe", "Todo": "Alle",
    "Deseleccionar todo": "Auswahl aufheben", "Seleccionar todo": "Alle auswählen", "Habitaciones": "Zimmer", "Vista guardada": "Gespeicherte Ansicht", "Cargando disponibilidad…": "Verfügbarkeit wird geladen...",
  },
}

export function translateLegacyCalendarGridValue(value: string, locale: Language) {
  if (locale === "es") return value
  return exact[locale][value] ?? value
}
