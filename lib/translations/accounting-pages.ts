import type { Language } from "@/lib/hooks/use-language"

type AccountingPageKey =
  | "chartOfAccounts"
  | "posting"
  | "reconciliation"
  | "reports"
  | "review"
  | "journal"
  | "allocations"

type AccountingPageCopy = {
  title: string
  description: string
  missingId?: string
}

export const accountingPagesCopy: Record<Language, Record<AccountingPageKey, AccountingPageCopy>> = {
  en: {
    chartOfAccounts: { title: "Chart of Accounts", description: "Stage, validate, approve, and apply accountant-provided canonical accounts by legal entity." },
    posting: { title: "Accounting posting", description: "Materialize approved source documents and prepare draft journals. Posting remains blocked until journal lines are explicitly reviewed and balanced." },
    reconciliation: { title: "Bank reconciliation", description: "Review bank movements against canonical accounting documents." },
    reports: { title: "Financial reports", description: "Read-only P&L, Balance Sheet, Cash Flow, bank cash status, and Revenue / Donations by legal entity." },
    review: { title: "Accounting review", description: "Review OCR and document-classification proposals before any canonical posting or reconciliation." },
    journal: { title: "Journal editor", description: "Build, validate, approve, and post a canonical double-entry journal.", missingId: "Journal ID is missing." },
    allocations: { title: "Accounting allocations", description: "Allocate the canonical document to entity-valid accounting dimensions and reconcile exactly to the document total before journal creation." },
  },
  es: {
    chartOfAccounts: { title: "Plan de cuentas", description: "Prepara, valida, aprueba y aplica cuentas canónicas entregadas por contabilidad para cada entidad legal." },
    posting: { title: "Contabilización", description: "Materializa documentos fuente aprobados y prepara asientos en borrador. La contabilización permanece bloqueada hasta que las líneas se revisen y cuadren explícitamente." },
    reconciliation: { title: "Conciliación bancaria", description: "Revisa movimientos bancarios contra documentos contables canónicos." },
    reports: { title: "Reportes financieros", description: "Lectura de resultados, balance, flujo de caja, posición bancaria e ingresos/donaciones por entidad legal." },
    review: { title: "Revisión contable", description: "Revisa propuestas de OCR y clasificación documental antes de cualquier contabilización o conciliación canónica." },
    journal: { title: "Editor de asientos", description: "Construye, valida, aprueba y contabiliza un asiento canónico de partida doble.", missingId: "Falta el ID del asiento." },
    allocations: { title: "Imputaciones contables", description: "Imputa el documento canónico a dimensiones contables válidas para la entidad y cuadra exactamente con el total antes de crear el asiento." },
  },
  de: {
    chartOfAccounts: { title: "Kontenplan", description: "Vom Rechnungswesen bereitgestellte kanonische Konten je Rechtseinheit vorbereiten, prüfen, genehmigen und anwenden." },
    posting: { title: "Buchung", description: "Genehmigte Quelldokumente materialisieren und Buchungsentwürfe vorbereiten. Die Verbuchung bleibt gesperrt, bis alle Buchungszeilen ausdrücklich geprüft und ausgeglichen sind." },
    reconciliation: { title: "Bankabstimmung", description: "Bankbewegungen mit kanonischen Buchhaltungsdokumenten abgleichen." },
    reports: { title: "Finanzberichte", description: "Schreibgeschützte GuV, Bilanz, Cashflow, Bankliquidität sowie Erlöse und Spenden je Rechtseinheit." },
    review: { title: "Buchhaltungsprüfung", description: "OCR- und Dokumentklassifizierungs-Vorschläge vor jeder kanonischen Buchung oder Abstimmung prüfen." },
    journal: { title: "Buchungssatz-Editor", description: "Einen kanonischen doppelten Buchungssatz erstellen, prüfen, genehmigen und verbuchen.", missingId: "Die Buchungssatz-ID fehlt." },
    allocations: { title: "Kontierungszuordnungen", description: "Das kanonische Dokument gültigen Kontierungsdimensionen der Rechtseinheit zuordnen und vor der Erstellung des Buchungssatzes exakt auf den Dokumentgesamtbetrag abstimmen." },
  },
}
