'use client'

import { AppLayout } from '@/components/app-layout'
import { FinancialTransparencyDashboard } from '@/components/financial-transparency-dashboard'
import { PageHeader } from '@/components/page-header'

export default function AccountingReportsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Financial Reports"
        description="Read-only P&L, Balance Sheet, Cash Flow, bank cash status, and Revenue / Donations by legal entity."
      />
      <FinancialTransparencyDashboard />
    </AppLayout>
  )
}
