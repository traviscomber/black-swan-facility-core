'use client'

import { AppLayout } from '@/components/app-layout'
import { FinanceApprovalQueue } from '@/components/finance-approval-queue'
import { FinanceApprovalRouteGate } from '@/components/finance-approval-route-gate'
import { FinanceApprovalWorkspace } from '@/components/finance-approval-workspace'
import { FinanceHistoricalAliasReview } from '@/components/finance-historical-alias-review'
import { RaimundoFinanceImport } from '@/components/raimundo-finance-import'
import { RaimundoReviewInbox } from '@/components/raimundo-review-inbox'
import { SiiSourceReview } from '@/components/sii-source-review'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: { more: 'View more' },
  es: { more: 'Ver más' },
  de: { more: 'Mehr' },
} as const

export default function BudgetApprovalsPage() {
  const { language } = useLanguage()
  const text = copy[language]
  return (
    <AppLayout>
      <FinanceApprovalRouteGate>
        <FinanceApprovalWorkspace>
          <RaimundoReviewInbox />
          <FinanceApprovalQueue />
          <details className="mx-4 mb-8 bg-[var(--bs-surface-primary)] md:mx-8">
            <summary className="cursor-pointer list-none p-4 text-sm text-[var(--bs-text-secondary)]">{text.more}</summary>
            <div className="border-t border-[var(--bs-divider-subtle)] pb-4">
              <SiiSourceReview />
              <FinanceHistoricalAliasReview />
              <RaimundoFinanceImport />
            </div>
          </details>
        </FinanceApprovalWorkspace>
      </FinanceApprovalRouteGate>
    </AppLayout>
  )
}
