'use client'

import { AppLayout } from '@/components/app-layout'
import { FinanceApprovalQueue } from '@/components/finance-approval-queue'
import { FinanceHistoricalAliasReview } from '@/components/finance-historical-alias-review'
import { RaimundoFinanceImport } from '@/components/raimundo-finance-import'
import { RaimundoReviewInbox } from '@/components/raimundo-review-inbox'
import { SiiSourceReview } from '@/components/sii-source-review'
import { PageHeader } from '@/components/page-header'

export default function BudgetApprovalsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Aprobación financiera"
        description="Revisa un caso por vez, confirma rápido y conserva trazabilidad contra el Budget canónico."
      />
      <SiiSourceReview />
      <RaimundoReviewInbox />
      <FinanceHistoricalAliasReview />
      <FinanceApprovalQueue />
      <RaimundoFinanceImport />
    </AppLayout>
  )
}
