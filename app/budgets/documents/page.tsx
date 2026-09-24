'use client'

import Link from 'next/link'
import { ArrowRight, Landmark, ReceiptText } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { FinanceApprovalQueue } from '@/components/finance-approval-queue'
import { PageHeader } from '@/components/page-header'
import { SiiInvoiceDropzone } from '@/components/sii-invoice-dropzone'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: {
    title: 'Invoices / documents',
    description: 'One operational entry point for supplier invoices, finance review and weekly bank reconciliation.',
    invoiceTitle: 'Supplier invoices',
    invoiceBody: 'Upload SII PDF or XML documents. The original stays traceable and the document enters the canonical finance review flow.',
    bankTitle: 'Weekly bank reconciliation',
    bankBody: 'Review imported bank movements against approved accounting documents. Every proposed match still requires explicit human approval.',
    bankCta: 'Open reconciliation',
    queueTitle: 'Finance review queue',
    queueBody: 'After intake, pending classifications and approval decisions remain visible below.',
  },
  es: {
    title: 'Facturas / documentos',
    description: 'Un solo punto operativo para facturas de proveedores, revisión financiera y conciliación bancaria semanal.',
    invoiceTitle: 'Facturas de proveedores',
    invoiceBody: 'Sube documentos SII en PDF o XML. El original queda trazable y el documento entra al flujo financiero canónico.',
    bankTitle: 'Conciliación bancaria semanal',
    bankBody: 'Revisa movimientos bancarios importados contra documentos contables aprobados. Cada propuesta sigue requiriendo aprobación humana explícita.',
    bankCta: 'Abrir conciliación',
    queueTitle: 'Cola de revisión financiera',
    queueBody: 'Después de la carga, las clasificaciones pendientes y decisiones de aprobación quedan visibles más abajo.',
  },
  de: {
    title: 'Rechnungen / Dokumente',
    description: 'Ein zentraler Arbeitsbereich für Lieferantenrechnungen, Finanzprüfung und wöchentliche Bankabstimmung.',
    invoiceTitle: 'Lieferantenrechnungen',
    invoiceBody: 'SII-Dokumente als PDF oder XML hochladen. Das Original bleibt nachvollziehbar und das Dokument geht in den kanonischen Finanzprüfungsprozess.',
    bankTitle: 'Wöchentliche Bankabstimmung',
    bankBody: 'Importierte Bankbewegungen mit freigegebenen Buchhaltungsdokumenten abgleichen. Jeder Vorschlag erfordert weiterhin eine ausdrückliche menschliche Freigabe.',
    bankCta: 'Abstimmung öffnen',
    queueTitle: 'Finanz-Prüfwarteschlange',
    queueBody: 'Nach dem Upload bleiben ausstehende Klassifizierungen und Freigabeentscheidungen unten sichtbar.',
  },
} as const

export default function FinanceDocumentsPage() {
  const { language } = useLanguage()
  const text = copy[language]

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} />

      <section className="mx-4 mt-4 grid gap-3 md:mx-8 lg:grid-cols-2">
        <div className="bg-[var(--bs-surface-primary)] p-5 md:p-6">
          <div className="flex items-start gap-3">
            <ReceiptText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--bs-warm-yellow)]" />
            <div>
              <h2 className="text-base font-medium text-[var(--bs-text-primary)]">{text.invoiceTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--bs-text-secondary)]">{text.invoiceBody}</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bs-surface-primary)] p-5 md:p-6">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-[var(--bs-warm-yellow)]" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-medium text-[var(--bs-text-primary)]">{text.bankTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--bs-text-secondary)]">{text.bankBody}</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href={`/${language}/accounting/reconciliation`}>
                  {text.bankCta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiiInvoiceDropzone />

      <section className="mx-4 mt-6 md:mx-8">
        <div className="mb-3">
          <h2 className="text-base font-medium text-[var(--bs-text-primary)]">{text.queueTitle}</h2>
          <p className="mt-1 text-sm text-[var(--bs-text-secondary)]">{text.queueBody}</p>
        </div>
      </section>
      <FinanceApprovalQueue />
    </AppLayout>
  )
}
