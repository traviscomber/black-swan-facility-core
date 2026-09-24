'use client'

import { AppLayout } from '@/components/app-layout'
import { FinanceApprovalQueue } from '@/components/finance-approval-queue'
import { FinanceHistoricalAliasReview } from '@/components/finance-historical-alias-review'
import { RaimundoFinanceImport } from '@/components/raimundo-finance-import'
import { RaimundoReviewInbox } from '@/components/raimundo-review-inbox'
import { SiiSourceReview } from '@/components/sii-source-review'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: { title: 'Raimundo · Expense review', description: 'Validate the AI-selected cost center, reassign when needed, then approve or reject the expense.' },
  es: { title: 'Raimundo · Revisión de gastos', description: 'Valida el centro de costo sugerido por IA, reasigna si corresponde y luego aprueba o rechaza el gasto.' },
  de: { title: 'Raimundo · Ausgabenprüfung', description: 'KI-Kostenstelle prüfen, bei Bedarf neu zuordnen und anschließend die Ausgabe freigeben oder ablehnen.' },
} as const

export default function BudgetApprovalsPage() {
  const { language } = useLanguage()
  const text = copy[language]
  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} />
      <SiiSourceReview />
      <RaimundoReviewInbox />
      <FinanceHistoricalAliasReview />
      <FinanceApprovalQueue />
      <RaimundoFinanceImport />
    </AppLayout>
  )
}
