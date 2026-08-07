import type { Language } from "@/lib/hooks/use-language"

export const chargesCopy: Record<Language, Record<string, string>> = {
  en: {
    title: "Reservation charges", subtitle: "Assign extras and services, adjust quantities and consolidate the billable total.", generating: "Generating...", generateInvoice: "Generate invoice", invoiceReady: "Invoice {number} is available with status {status}.", openInvoices: "Open invoices", reservations: "Reservations", search: "Search guest or date", loading: "Loading...", lodging: "Lodging", extras: "Extras", extraTaxes: "Extra taxes", billableTotal: "Billable total", addCharge: "Add charge", selectExtra: "Select extra", add: "Add", chargeDetails: "Charge details", noExtras: "This reservation has no assigned extras.", tax: "Tax", verifyInvoicesFailed: "Could not verify existing invoices", createInvoiceFailed: "Could not create invoice",
  },
  es: {
    title: "Cargos por reserva", subtitle: "Asigna extras y servicios, ajusta cantidades y consolida el total facturable.", generating: "Generando...", generateInvoice: "Generar factura", invoiceReady: "Factura {number} disponible en estado {status}.", openInvoices: "Abrir facturas", reservations: "Reservas", search: "Buscar huésped o fecha", loading: "Cargando...", lodging: "Alojamiento", extras: "Extras", extraTaxes: "Impuestos extras", billableTotal: "Total facturable", addCharge: "Agregar cargo", selectExtra: "Seleccionar extra", add: "Agregar", chargeDetails: "Detalle de cargos", noExtras: "La reserva no tiene extras asignados.", tax: "IVA", verifyInvoicesFailed: "No se pudo verificar las facturas existentes", createInvoiceFailed: "No se pudo crear la factura",
  },
  de: {
    title: "Reservierungsgebühren", subtitle: "Extras und Leistungen zuweisen, Mengen anpassen und den abrechenbaren Gesamtbetrag konsolidieren.", generating: "Wird erstellt...", generateInvoice: "Rechnung erstellen", invoiceReady: "Rechnung {number} ist mit Status {status} verfügbar.", openInvoices: "Rechnungen öffnen", reservations: "Reservierungen", search: "Nach Gast oder Datum suchen", loading: "Wird geladen...", lodging: "Unterkunft", extras: "Extras", extraTaxes: "Steuern auf Extras", billableTotal: "Abrechenbarer Gesamtbetrag", addCharge: "Gebühr hinzufügen", selectExtra: "Extra auswählen", add: "Hinzufügen", chargeDetails: "Gebührendetails", noExtras: "Dieser Reservierung sind keine Extras zugeordnet.", tax: "Steuer", verifyInvoicesFailed: "Bestehende Rechnungen konnten nicht geprüft werden", createInvoiceFailed: "Rechnung konnte nicht erstellt werden",
  },
}

export function fillChargesCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template)
}
