'use client'

import { AppLayout } from '@/components/app-layout'
import { FinanceApprovalQueue } from '@/components/finance-approval-queue'
import { FinanceApprovalRouteGate } from '@/components/finance-approval-route-gate'
import { FinanceApprovalWorkspace } from '@/components/finance-approval-workspace'
import { FinanceHistoricalAliasReview } from '@/components/finance-historical-alias-review'
import { RaimundoFinanceImport } from '@/components/raimundo-finance-import'
import { RaimundoReviewInbox } from '@/components/raimundo-review-inbox'
import { SiiSourceReview } from '@/components/sii-source-review'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: { title: 'Financial approval', description: 'Review one case at a time, confirm quickly and preserve traceability against the canonical Budget.' },
  es: { title: 'Aprobaciones · Raimundo', description: 'Primero confirma centros nuevos; luego aprueba o rechaza los gastos ya organizados.' },
  de: { title: 'Finanzielle Freigabe', description: 'Prüfen Sie jeweils einen Fall, bestätigen Sie zügig und erhalten Sie die Nachverfolgbarkeit zum kanonischen Budget.' },
} as const

export default function BudgetApprovalsPage() {
  const { language } = useLanguage()
  const text = copy[language]
  return (
    <AppLayout>
      <FinanceApprovalRouteGate>
        <FinanceApprovalWorkspace>
          <PageHeader title={text.title} description={text.description} />
          <RaimundoReviewInbox />
          <FinanceApprovalQueue />
          <SiiSourceReview />
          <details className="mx-4 mt-4 bg-[var(--bs-surface-primary)] md:mx-8">
            <summary className="cursor-pointer list-none p-5 text-sm text-[var(--bs-text-secondary)]">
              Herramientas históricas · mapeos y normalización
            </summary>
            <div className="border-t border-[var(--bs-divider-subtle)] pb-4">
              <FinanceHistoricalAliasReview />
              <RaimundoFinanceImport />
            </div>
          </details>
        </FinanceApprovalWorkspace>
      </FinanceApprovalRouteGate>
    </AppLayout>
  )
}
