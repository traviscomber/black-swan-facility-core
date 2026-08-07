import type { Language } from "@/lib/hooks/use-language"
import type { BookingCalendarBed } from "@/components/booking-calendar-model"

export const bookingCalendarInteractionCopy: Record<Language, Record<string, string>> = {
  en: {
    newReservation: "New reservation",
    bedDisabled: "This bed is disabled",
    roomUnavailable: "This room does not accept new reservations",
    overlapsReservation: "This range overlaps an active reservation",
    overlapsBlock: "This range overlaps an operational block",
    rangeAvailable: "Range available for a new reservation",
    inventoryValidationFailed: "The calendar inventory could not be validated",
    reservationNotEditable: "This reservation has already started or is closed and cannot be moved from the calendar.",
    checkoutAfterCheckin: "Check-out must be after check-in.",
    blockConflict: "This room has an operational block during those dates.",
    destinationAvailable: "Destination available.",
    sourceReviewSuffix: " The source is unclassified and will be recorded for review.",
    inventoryConflict: "Another active reservation exists in this inventory.",
    swapOccupied: "Destination occupied by {guest}. Confirming will propose a controlled swap.",
    pendingSantiago: "This change is already pending Santiago's approval",
    pendingApproval: "This change is already pending approval",
    confirmKeyboard: "Enter confirms; Escape cancels.",
    reservationUpdated: "Reservation updated",
    undo: "Undo",
    changeUndone: "Change undone",
    undoFailed: "The change could not be undone",
    sentForApproval: "Change sent to Santiago for approval",
    unchanged: "The reservation did not change",
    updateFailed: "The reservation could not be updated",
    swapConfirm: "Swap {a} with {b}? Both reservations will keep their dates.",
    internalSource: "internal",
    reviewSource: "review source",
    night: "night",
    nights: "nights",
    property: "Property",
    bed: "Bed",
  },
  es: {
    newReservation: "Nueva reserva",
    bedDisabled: "La cama está deshabilitada",
    roomUnavailable: "La habitación no admite nuevas reservas",
    overlapsReservation: "El rango cruza una reserva activa",
    overlapsBlock: "El rango cruza un bloqueo operativo",
    rangeAvailable: "Rango disponible para crear una reserva",
    inventoryValidationFailed: "No fue posible validar el inventario del calendario",
    reservationNotEditable: "La reserva ya inició o está cerrada y no puede moverse desde el calendario.",
    checkoutAfterCheckin: "La salida debe ser posterior a la llegada.",
    blockConflict: "La habitación tiene un bloqueo operativo en esas fechas.",
    destinationAvailable: "Destino disponible.",
    sourceReviewSuffix: " El origen no está clasificado y se registrará para revisión.",
    inventoryConflict: "Existe otra reserva activa en ese inventario.",
    swapOccupied: "Destino ocupado por {guest}. Al confirmar se propondrá un intercambio controlado.",
    pendingSantiago: "Este cambio ya está pendiente de aprobación de Santiago",
    pendingApproval: "Este cambio ya está pendiente de aprobación",
    confirmKeyboard: "Enter confirma; Escape cancela.",
    reservationUpdated: "Reserva actualizada",
    undo: "Deshacer",
    changeUndone: "Cambio deshecho",
    undoFailed: "No fue posible deshacer el cambio",
    sentForApproval: "Cambio enviado a Santiago para aprobación",
    unchanged: "La reserva no cambió",
    updateFailed: "No fue posible actualizar la reserva",
    swapConfirm: "¿Intercambiar {a} con {b}? Ambas reservas conservarán sus fechas.",
    internalSource: "interno",
    reviewSource: "revisar origen",
    night: "noche",
    nights: "noches",
    property: "Propiedad",
    bed: "Cama",
  },
  de: {
    newReservation: "Neue Reservierung",
    bedDisabled: "Dieses Bett ist deaktiviert",
    roomUnavailable: "Dieses Zimmer nimmt keine neuen Reservierungen an",
    overlapsReservation: "Dieser Zeitraum überschneidet sich mit einer aktiven Reservierung",
    overlapsBlock: "Dieser Zeitraum überschneidet sich mit einer betrieblichen Sperre",
    rangeAvailable: "Zeitraum für eine neue Reservierung verfügbar",
    inventoryValidationFailed: "Der Kalenderbestand konnte nicht validiert werden",
    reservationNotEditable: "Diese Reservierung hat bereits begonnen oder ist geschlossen und kann im Kalender nicht verschoben werden.",
    checkoutAfterCheckin: "Der Check-out muss nach dem Check-in liegen.",
    blockConflict: "Für dieses Zimmer besteht in diesem Zeitraum eine betriebliche Sperre.",
    destinationAvailable: "Ziel verfügbar.",
    sourceReviewSuffix: " Die Quelle ist nicht klassifiziert und wird zur Prüfung erfasst.",
    inventoryConflict: "In diesem Bestand besteht bereits eine andere aktive Reservierung.",
    swapOccupied: "Das Ziel ist von {guest} belegt. Beim Bestätigen wird ein kontrollierter Tausch vorgeschlagen.",
    pendingSantiago: "Diese Änderung wartet bereits auf Santiagos Freigabe",
    pendingApproval: "Diese Änderung wartet bereits auf Freigabe",
    confirmKeyboard: "Enter bestätigt; Escape bricht ab.",
    reservationUpdated: "Reservierung aktualisiert",
    undo: "Rückgängig",
    changeUndone: "Änderung rückgängig gemacht",
    undoFailed: "Die Änderung konnte nicht rückgängig gemacht werden",
    sentForApproval: "Änderung zur Freigabe an Santiago gesendet",
    unchanged: "Die Reservierung wurde nicht geändert",
    updateFailed: "Die Reservierung konnte nicht aktualisiert werden",
    swapConfirm: "{a} mit {b} tauschen? Beide Reservierungen behalten ihre Daten.",
    internalSource: "intern",
    reviewSource: "Quelle prüfen",
    night: "Nacht",
    nights: "Nächte",
    property: "Unterkunft",
    bed: "Bett",
  },
}

export function bookingTargetLabel(bed: BookingCalendarBed, language: Language) {
  const copy = bookingCalendarInteractionCopy[language]
  const location = bed.room.location?.name ?? copy.property
  return `${location} · ${bed.room.room_number} · ${copy.bed} ${bed.bed_number}`
}

export function bookingSourceDescription(source: string | null | undefined, policy: "editable" | "review" | "external-read-only", language: Language) {
  const copy = bookingCalendarInteractionCopy[language]
  const label = source?.trim() || copy.internalSource
  return policy === "review" ? `${label} · ${copy.reviewSource}` : label
}

export function interpolateBookingCopy(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, value), template)
}
