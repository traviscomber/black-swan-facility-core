import type { Language } from "@/lib/hooks/use-language"

export const bookingsCalendarPageCopy: Record<Language, Record<string, string>> = {
  en: {
    eyebrow: "Hospitality · Fundo Corcovado",
    title: "Reservations and availability",
    subtitle: "Operational calendar connected to the availability engine. Drag a reservation to another bed to reassign it. Use Ctrl+click or the selection box to select multiple reservations.",
    manageBlocks: "Manage blocks",
    today: "Today",
    newReservation: "New reservation",
  },
  es: {
    eyebrow: "Hospitalidad · Fundo Corcovado",
    title: "Reservas y disponibilidad",
    subtitle: "Calendario operativo conectado al motor de disponibilidad. Arrastra una reserva hacia otra cama para reasignarla. Usa Ctrl+clic o la casilla de selección para seleccionar varias reservas.",
    manageBlocks: "Gestionar bloqueos",
    today: "Hoy",
    newReservation: "Nueva reserva",
  },
  de: {
    eyebrow: "Gastbetrieb · Fundo Corcovado",
    title: "Reservierungen und Verfügbarkeit",
    subtitle: "Betriebskalender mit direkter Anbindung an die Verfügbarkeitssteuerung. Ziehe eine Reservierung auf ein anderes Bett, um sie neu zuzuweisen. Mit Strg+Klick oder dem Auswahlfeld kannst du mehrere Reservierungen auswählen.",
    manageBlocks: "Sperren verwalten",
    today: "Heute",
    newReservation: "Neue Reservierung",
  },
}
