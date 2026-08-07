'use client'

import { AppLayout } from '@/components/app-layout'
import { FinanceApprovalQueue } from '@/components/finance-approval-queue'
import { FinanceCenterMapping } from '@/components/finance-center-mapping'
import { RaimundoFinanceImport } from '@/components/raimundo-finance-import'
import { PageHeader } from '@/components/page-header'

export default function BudgetApprovalsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Aprobación financiera"
        description="Clasifica una vez, aprueba rápido y conserva trazabilidad contra el Budget canónico."
      />
      <FinanceCenterMapping />
      <FinanceApprovalQueue />
      <RaimundoFinanceImport />
    </AppLayout>
  )
}
