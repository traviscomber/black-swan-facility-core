'use client'

import { AppLayout } from '@/components/app-layout'
import { BudgetWorkspace } from '@/components/budget-workspace'
import { PageHeader } from '@/components/page-header'

export default function BudgetsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Budget & P&L"
        description="Presupuesto operativo, ejecución real e importación controlada del Excel maestro."
      />
      <BudgetWorkspace />
    </AppLayout>
  )
}
