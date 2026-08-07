import type { Language } from "@/lib/hooks/use-language"

const exact: Record<Exclude<Language, "es">, Record<string, string>> = {
  en: {
    "Hospitalidad · Fundo Corcovado": "Hospitality · Fundo Corcovado", "Reservas y disponibilidad": "Reservations and availability",
    "Timeline operativo conectado al Availability Engine. Arrastra una reserva hacia otra cama para reasignarla. Ctrl+clic o clic en el checkbox para selección múltiple.": "Operational timeline connected to the Availability Engine. Drag a reservation to another bed to reassign it. Ctrl+click or use the checkbox for multiple selection.",
    "Gestionar bloqueos": "Manage blocks", "Hoy": "Today", "Nueva reserva": "New reservation", "Propiedades hospedables": "Lodging properties", "Ubicaciones con camas configuradas": "Locations with configured beds", "Camas registradas": "Registered beds", "Capacidad física registrada en el sistema": "Physical capacity registered in the system", "Reservas del rango": "Reservations in range", "Reservas únicas desde el motor de disponibilidad": "Unique reservations from the availability engine",
    "Ocupación disponible": "Available occupancy", "Noches ocupadas": "Occupied nights", "Noches bloqueadas": "Blocked nights", "Monto registrado": "Recorded amount", "Llegadas hoy": "Today's arrivals", "Salidas hoy": "Today's departures", "Buscar huésped, propiedad, habitación o cama": "Search guest, property, room or bed", "Alojamiento": "Lodging", "Todos los alojamientos": "All properties", "Estado": "Status", "Todos los estados": "All statuses", "Pendiente": "Pending", "Confirmada": "Confirmed", "7 días": "7 days", "14 días": "14 days", "30 días": "30 days",
    "No fue posible cargar o actualizar la disponibilidad": "Could not load or update availability", "Operación completada. Puedes deshacerla durante los próximos": "Operation completed. You can undo it for the next", "Deshacer": "Undo", "Todas": "All", "Extender +1": "Extend +1", "Reducir -1": "Reduce -1", "Confirmar": "Confirm", "Cancelar": "Cancel", "Eliminar": "Delete", "Limpiar": "Clear",
    "Bloqueo de habitación": "Room block", "Motivo": "Reason", "Desde": "From", "Hasta": "To", "Notas": "Notes", "Administrar bloqueos": "Manage blocks", "Detalle de reserva": "Reservation details", "Huésped": "Guest", "Huéspedes": "Guests", "Solicitudes especiales": "Special requests", "Confirmar reserva": "Confirm reservation", "Registrar check-in": "Register check-in", "Registrar check-out": "Register check-out",
    "Mantenimiento": "Maintenance", "Uso propietario": "Owner use", "Fuera de servicio": "Out of service", "Bloqueada": "Blocked", "Ocultar operación": "Hide operations", "Mostrar operación": "Show operations", "Validando…": "Validating…", "Confirmando…": "Confirming…", "Ajustando…": "Adjusting…", "Check-in hoy": "Check-in today", "Check-out hoy": "Check-out today", "No disponible": "Unavailable",
    "Reserva": "Reservation", "Hospedado": "Checked in", "Finalizada": "Completed", "Servicios": "Services", "Actividades": "Activities", "Incidencias": "Issues", "Cargando reserva…": "Loading reservation...", "Habitación": "Room", "Sin asignar": "Unassigned", "Total": "Total", "Pago": "Payment", "Operación relacionada": "Related operations", "Excepciones operacionales": "Operational exceptions", "Sin excepciones operacionales abiertas.": "No open operational exceptions.", "Bloquea check-in": "Blocks check-in", "Vencida": "Overdue", "Contacto": "Contact", "Abrir ficha completa": "Open full record", "Los valores, estados y excepciones provienen de datos operacionales reales.": "Amounts, statuses and exceptions come from real operational data.",
    "Reserva confirmada": "Reservation confirmed", "Check-in registrado": "Check-in registered", "Check-out registrado": "Check-out registered", "No fue posible eliminar las reservas": "Could not delete reservations", "Error de red al eliminar reservas": "Network error while deleting reservations", "No fue posible deshacer la operación": "Could not undo the operation", "Error de red al deshacer": "Network error while undoing",
  },
  de: {
    "Hospitalidad · Fundo Corcovado": "Hospitality · Fundo Corcovado", "Reservas y disponibilidad": "Reservierungen und Verfügbarkeit",
    "Timeline operativo conectado al Availability Engine. Arrastra una reserva hacia otra cama para reasignarla. Ctrl+clic o clic en el checkbox para selección múltiple.": "Betriebliche Zeitleiste mit Availability Engine. Ziehe eine Reservierung auf ein anderes Bett, um sie neu zuzuweisen. Strg+Klick oder Checkbox für Mehrfachauswahl.",
    "Gestionar bloqueos": "Sperren verwalten", "Hoy": "Heute", "Nueva reserva": "Neue Reservierung", "Propiedades hospedables": "Unterkünfte", "Ubicaciones con camas configuradas": "Standorte mit konfigurierten Betten", "Camas registradas": "Erfasste Betten", "Capacidad física registrada en el sistema": "Im System erfasste physische Kapazität", "Reservas del rango": "Reservierungen im Zeitraum", "Reservas únicas desde el motor de disponibilidad": "Eindeutige Reservierungen aus der Availability Engine",
    "Ocupación disponible": "Verfügbare Belegung", "Noches ocupadas": "Belegte Nächte", "Noches bloqueadas": "Gesperrte Nächte", "Monto registrado": "Erfasster Betrag", "Llegadas hoy": "Heutige Anreisen", "Salidas hoy": "Heutige Abreisen", "Buscar huésped, propiedad, habitación o cama": "Gast, Unterkunft, Zimmer oder Bett suchen", "Alojamiento": "Unterkunft", "Todos los alojamientos": "Alle Unterkünfte", "Estado": "Status", "Todos los estados": "Alle Status", "Pendiente": "Ausstehend", "Confirmada": "Bestätigt", "7 días": "7 Tage", "14 días": "14 Tage", "30 días": "30 Tage",
    "No fue posible cargar o actualizar la disponibilidad": "Verfügbarkeit konnte nicht geladen oder aktualisiert werden", "Operación completada. Puedes deshacerla durante los próximos": "Vorgang abgeschlossen. Rückgängig möglich für die nächsten", "Deshacer": "Rückgängig", "Todas": "Alle", "Extender +1": "+1 verlängern", "Reducir -1": "-1 verkürzen", "Confirmar": "Bestätigen", "Cancelar": "Abbrechen", "Eliminar": "Löschen", "Limpiar": "Auswahl löschen",
    "Bloqueo de habitación": "Zimmersperre", "Motivo": "Grund", "Desde": "Von", "Hasta": "Bis", "Notas": "Notizen", "Administrar bloqueos": "Sperren verwalten", "Detalle de reserva": "Reservierungsdetails", "Huésped": "Gast", "Huéspedes": "Gäste", "Solicitudes especiales": "Sonderwünsche", "Confirmar reserva": "Reservierung bestätigen", "Registrar check-in": "Check-in erfassen", "Registrar check-out": "Check-out erfassen",
    "Mantenimiento": "Wartung", "Uso propietario": "Eigentümernutzung", "Fuera de servicio": "Außer Betrieb", "Bloqueada": "Gesperrt", "Ocultar operación": "Betrieb ausblenden", "Mostrar operación": "Betrieb anzeigen", "Validando…": "Wird geprüft…", "Confirmando…": "Wird bestätigt…", "Ajustando…": "Wird angepasst…", "Check-in hoy": "Check-in heute", "Check-out hoy": "Check-out heute", "No disponible": "Nicht verfügbar",
    "Reserva": "Reservierung", "Hospedado": "Eingecheckt", "Finalizada": "Abgeschlossen", "Servicios": "Services", "Actividades": "Aktivitäten", "Incidencias": "Vorfälle", "Cargando reserva…": "Reservierung wird geladen...", "Habitación": "Zimmer", "Sin asignar": "Nicht zugewiesen", "Total": "Gesamt", "Pago": "Zahlung", "Operación relacionada": "Verknüpfter Betrieb", "Excepciones operacionales": "Betriebliche Ausnahmen", "Sin excepciones operacionales abiertas.": "Keine offenen betrieblichen Ausnahmen.", "Bloquea check-in": "Blockiert Check-in", "Vencida": "Überfällig", "Contacto": "Kontakt", "Abrir ficha completa": "Vollständigen Datensatz öffnen", "Los valores, estados y excepciones provienen de datos operacionales reales.": "Beträge, Status und Ausnahmen stammen aus realen Betriebsdaten.",
    "Reserva confirmada": "Reservierung bestätigt", "Check-in registrado": "Check-in erfasst", "Check-out registrado": "Check-out erfasst", "No fue posible eliminar las reservas": "Reservierungen konnten nicht gelöscht werden", "Error de red al eliminar reservas": "Netzwerkfehler beim Löschen der Reservierungen", "No fue posible deshacer la operación": "Vorgang konnte nicht rückgängig gemacht werden", "Error de red al deshacer": "Netzwerkfehler beim Rückgängigmachen",
  },
}

export function translateLegacyCalendarValue(value: string, locale: Language) {
  if (locale === "es") return value
  const translated = exact[locale][value]
  if (translated) return translated
  if (locale === "de") {
    return value
      .replace(/^(\d+) camas visibles/, "$1 Betten sichtbar")
      .replace(/^(\d+) seleccionadas?$/, "$1 ausgewählt")
      .replace(/^([+-]?\d+) días?$/, "$1 Tage")
      .replace(/^(\d+) conflictos? detectados?\./, "$1 Konflikt(e) erkannt.")
      .replace(/^Mover a: /, "Verschieben nach: ")
      .replace(/^(\d+) bloquea check-in$/, "$1 blockiert Check-in")
      .replace(/^(\d+) vencidas?$/, "$1 überfällig")
      .replace(/^Estado: /, "Status: ")
      .replace(/^Objetivo: /, "Ziel: ")
      .replace(/^Hab\. /, "Zi. ")
      .replace(/^Operación deshecha: (\d+) reservas? restauradas$/, "Vorgang rückgängig: $1 Reservierung(en) wiederhergestellt")
      .replace(/^(\d+) reservas? eliminadas$/, "$1 Reservierung(en) gelöscht")
  }
  return value
    .replace(/^(\d+) camas visibles/, "$1 beds visible")
    .replace(/^(\d+) seleccionadas?$/, "$1 selected")
    .replace(/^([+-]?\d+) días?$/, "$1 days")
    .replace(/^(\d+) conflictos? detectados?\./, "$1 conflict(s) detected.")
    .replace(/^Mover a: /, "Move to: ")
    .replace(/^(\d+) bloquea check-in$/, "$1 blocks check-in")
    .replace(/^(\d+) vencidas?$/, "$1 overdue")
    .replace(/^Estado: /, "Status: ")
    .replace(/^Objetivo: /, "Target: ")
    .replace(/^Hab\. /, "Room ")
    .replace(/^Operación deshecha: (\d+) reservas? restauradas$/, "Operation undone: $1 reservation(s) restored")
    .replace(/^(\d+) reservas? eliminadas$/, "$1 reservation(s) deleted")
}
