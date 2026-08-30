'use client'

import { AppLayout } from '@/components/app-layout'
import { FinanceApprovalQueue } from '@/components/finance-approval-queue'
import { PageHeader } from '@/components/page-header'
import { SiiInvoiceDropzone } from '@/components/sii-invoice-dropzone'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: { title: 'Invoices / documents', description: 'Financial documents, canonical classification and decision status.' },
  es: { title: 'Facturas / documentos', description: 'Documentos financieros, clasificación canónica y estado de decisión.' },
  de: { title: 'Rechnungen / Dokumente', description: 'Finanzdokumente, kanonische Klassifizierung und Entscheidungsstatus.' },
} as const

export default function FinanceDocumentsPage() {
  const { language } = useLanguage()
  const text = copy[language]
  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} />
      <SiiInvoiceDropzone />
      <FinanceApprovalQueue />
    </AppLayout>
  )
}
