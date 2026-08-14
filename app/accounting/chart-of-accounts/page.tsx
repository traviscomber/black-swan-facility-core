'use client'

import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { AccountingCoaImport } from '@/components/accounting-coa-import'

export default function ChartOfAccountsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Chart of Accounts"
        description="Stage, validate, approve, and apply accountant-provided canonical accounts by legal entity."
      />
      <AccountingCoaImport />
    </AppLayout>
  )
}
