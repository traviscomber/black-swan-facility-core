import type { Language } from "@/lib/hooks/use-language"

export const guestTranslations: Record<Language, Record<string, string>> = {
  en: {
    title: "Guests", subtitle: "Profiles, stay history, value and upcoming reservations.", operationalCenter: "Operations center", newGuest: "New guest",
    guests: "Guests", recurring: "Returning", historicalValue: "Lifetime value", search: "Search by name, email, phone or company", directory: "Guest directory",
    guest: "Guest", contact: "Contact", stays: "Stays", spend: "Spend", last: "Last stay", next: "Next stay", actions: "Actions", loading: "Loading guests...", noResults: "No results.",
    returning: "Returning", noEmail: "No email", noPhone: "No phone", deleteConfirm: "Delete this guest?", history: "Guest history", notes: "Notes", noReservations: "No linked reservations.", guestCount: "guest(s)",
  },
  es: {
    title: "Huéspedes", subtitle: "Perfiles, historial de estadías, valor y próximas reservas.", operationalCenter: "Centro operativo", newGuest: "Nuevo huésped",
    guests: "Huéspedes", recurring: "Recurrentes", historicalValue: "Valor histórico", search: "Buscar por nombre, correo electrónico, teléfono o empresa", directory: "Directorio consolidado",
    guest: "Huésped", contact: "Contacto", stays: "Estadías", spend: "Gasto", last: "Última", next: "Próxima", actions: "Acciones", loading: "Cargando huéspedes...", noResults: "No hay resultados.",
    returning: "Recurrente", noEmail: "Sin correo electrónico", noPhone: "Sin teléfono", deleteConfirm: "¿Eliminar este huésped?", history: "Historial del huésped", notes: "Notas", noReservations: "Sin reservas vinculadas.", guestCount: "huésped(es)",
  },
  de: {
    title: "Gäste", subtitle: "Profile, Aufenthaltsverlauf, Kundenwert und kommende Reservierungen.", operationalCenter: "Betriebszentrale", newGuest: "Neuer Gast",
    guests: "Gäste", recurring: "Wiederkehrend", historicalValue: "Historischer Wert", search: "Nach Name, E-Mail, Telefon oder Unternehmen suchen", directory: "Gästeverzeichnis",
    guest: "Gast", contact: "Kontakt", stays: "Aufenthalte", spend: "Umsatz", last: "Letzter Aufenthalt", next: "Nächster Aufenthalt", actions: "Aktionen", loading: "Gäste werden geladen...", noResults: "Keine Ergebnisse.",
    returning: "Wiederkehrend", noEmail: "Keine E-Mail", noPhone: "Kein Telefon", deleteConfirm: "Diesen Gast löschen?", history: "Gastverlauf", notes: "Notizen", noReservations: "Keine verknüpften Reservierungen.", guestCount: "Gast/Gäste",
  },
}
