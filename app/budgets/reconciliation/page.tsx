'use client'

import { AppLayout } from '@/components/app-layout'
import { BudgetFinancialMap } from '@/components/budget-financial-map'
import { BudgetWorkspace } from '@/components/budget-workspace'
import { PageHeader } from '@/components/page-header'

export default function BudgetReconciliationPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Conciliación"
        description="Cruza la ejecución real y sus documentos contra el Budget & P&L canónico."
      />
      <BudgetWorkspace />
      <BudgetFinancialMap />
    </AppLayout>
  )
}
