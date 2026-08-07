'use client'

import { AppLayout } from '@/components/app-layout'
import { FinanceApprovalQueue } from '@/components/finance-approval-queue'
import { PageHeader } from '@/components/page-header'

export default function BudgetApprovalsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Aprobación financiera"
        description="Facturas y gastos clasificados contra centros de costo y Budget canónico."
      />
      <FinanceApprovalQueue />
    </AppLayout>
  )
}
