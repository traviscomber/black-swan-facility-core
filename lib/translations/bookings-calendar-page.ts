import type { Language } from "@/lib/hooks/use-language"

export const bookingsCalendarPageCopy: Record<Language, Record<string, string>> = {
  en: {
    eyebrow: "Hospitality · Fundo Corcovado",
    title: "Reservations and availability",
    subtitle: "Operational calendar connected to the availability engine. Drag a reservation to another bed to reassign it. Use Ctrl+click or the selection box to select multiple reservations.",
    manageBlocks: "Manage blocks",
    today: "Today",
    newReservation: "New reservation",
    allStatuses: "All statuses", pending: "Pending", confirmed: "Confirmed", checkedIn: "Checked in", completed: "Completed", days: "days", selected: "selected", all: "All", extend: "Extend", reduce: "Reduce", cancel: "Cancel", delete: "Delete", clear: "Clear", conflicts: "conflicts detected", operationComplete: "Operation completed", undoWindow: "to undo", undo: "Undo", blockTitle: "Room block", reason: "Reason", from: "From", to: "To", notes: "Notes",
  },
  es: {
    eyebrow: "Hospitalidad · Fundo Corcovado",
    title: "Reservas y disponibilidad",
    subtitle: "Calendario operativo conectado al motor de disponibilidad. Arrastra una reserva hacia otra cama para reasignarla. Usa Ctrl+clic o la casilla de selección para seleccionar varias reservas.",
    manageBlocks: "Gestionar bloqueos",
    today: "Hoy",
    newReservation: "Nueva reserva",
    allStatuses: "Todos los estados", pending: "Pendiente", confirmed: "Confirmada", checkedIn: "Hospedado", completed: "Finalizada", days: "días", selected: "seleccionadas", all: "Todas", extend: "Extender", reduce: "Reducir", cancel: "Cancelar", delete: "Eliminar", clear: "Limpiar", conflicts: "conflictos detectados", operationComplete: "Operación completada", undoWindow: "para deshacer", undo: "Deshacer", blockTitle: "Bloqueo de habitación", reason: "Motivo", from: "Desde", to: "Hasta", notes: "Notas",
  },
  de: {
    eyebrow: "Gastbetrieb · Fundo Corcovado",
    title: "Reservierungen und Verfügbarkeit",
    subtitle: "Betriebskalender mit direkter Anbindung an die Verfügbarkeitssteuerung. Ziehe eine Reservierung auf ein anderes Bett, um sie neu zuzuweisen. Mit Strg+Klick oder dem Auswahlfeld kannst du mehrere Reservierungen auswählen.",
    manageBlocks: "Sperren verwalten",
    today: "Heute",
    newReservation: "Neue Reservierung",
    allStatuses: "Alle Status", pending: "Ausstehend", confirmed: "Bestätigt", checkedIn: "Eingecheckt", completed: "Abgeschlossen", days: "Tage", selected: "ausgewählt", all: "Alle", extend: "Verlängern", reduce: "Verkürzen", cancel: "Stornieren", delete: "Löschen", clear: "Leeren", conflicts: "Konflikte erkannt", operationComplete: "Vorgang abgeschlossen", undoWindow: "zum Rückgängigmachen", undo: "Rückgängig", blockTitle: "Zimmersperre", reason: "Grund", from: "Von", to: "Bis", notes: "Notizen",
  },
}
