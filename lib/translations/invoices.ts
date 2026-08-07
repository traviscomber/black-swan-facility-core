import type { Language } from "@/lib/hooks/use-language"

export const invoiceCopy: Record<Language, Record<string, string>> = {
  en: {
    pending: "Pending", partial: "Partially paid", paid: "Paid", overdue: "Overdue", loadFailed: "Invoices could not be loaded", deleteConfirm: "Delete invoice {number} permanently? This is only allowed if it has no payments.", deleteFailed: "Invoice could not be deleted", deleted: "Invoice deleted", title: "Invoices", subtitle: "Internal reservation documents in Chilean pesos.", note: "New invoices are created from a reservation to preserve charges, guest details and traceability.", search: "Search by number, customer or email", registered: "Registered invoices", loading: "Loading invoices...", retry: "Retry", empty: "No invoices registered", emptyHint: "Create the first one from a confirmed reservation.", issued: "Issued", due: "Due", balance: "Balance", view: "View", edit: "Edit", delete: "Delete",
  },
  es: {
    pending: "Pendiente", partial: "Pago parcial", paid: "Pagada", overdue: "Vencida", loadFailed: "No se pudieron cargar las facturas", deleteConfirm: "¿Eliminar definitivamente la factura {number}? Esta acción solo procede si no tiene pagos.", deleteFailed: "No se pudo eliminar la factura", deleted: "Factura eliminada", title: "Facturas", subtitle: "Documentos internos asociados a reservas, expresados en pesos chilenos.", note: "Las facturas nuevas se generan desde una reserva para conservar cargos, huésped y trazabilidad.", search: "Buscar por número, cliente o correo", registered: "Facturas registradas", loading: "Cargando facturas...", retry: "Reintentar", empty: "No hay facturas registradas", emptyHint: "Genera la primera desde el detalle de una reserva confirmada.", issued: "Emitida", due: "Vence", balance: "Saldo", view: "Ver", edit: "Editar", delete: "Eliminar",
  },
  de: {
    pending: "Ausstehend", partial: "Teilbezahlt", paid: "Bezahlt", overdue: "Überfällig", loadFailed: "Rechnungen konnten nicht geladen werden", deleteConfirm: "Rechnung {number} endgültig löschen? Dies ist nur möglich, wenn keine Zahlungen vorliegen.", deleteFailed: "Rechnung konnte nicht gelöscht werden", deleted: "Rechnung gelöscht", title: "Rechnungen", subtitle: "Interne Reservierungsdokumente in chilenischen Pesos.", note: "Neue Rechnungen werden aus einer Reservierung erzeugt, damit Gebühren, Gastdaten und Nachverfolgbarkeit erhalten bleiben.", search: "Nach Nummer, Kunde oder E-Mail suchen", registered: "Erfasste Rechnungen", loading: "Rechnungen werden geladen...", retry: "Erneut versuchen", empty: "Keine Rechnungen erfasst", emptyHint: "Erstelle die erste Rechnung aus einer bestätigten Reservierung.", issued: "Ausgestellt", due: "Fällig", balance: "Restbetrag", view: "Anzeigen", edit: "Bearbeiten", delete: "Löschen",
  },
}

export function fillInvoiceCopy(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, value), template)
}
