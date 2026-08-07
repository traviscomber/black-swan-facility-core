'use client'

import { AppLayout } from '@/components/app-layout'
import { FinanceApprovalQueue } from '@/components/finance-approval-queue'
import { PageHeader } from '@/components/page-header'

export default function FinanceDocumentsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Facturas / documentos"
        description="Documentos financieros, clasificación canónica y estado de decisión."
      />
      <FinanceApprovalQueue />
    </AppLayout>
  )
}
