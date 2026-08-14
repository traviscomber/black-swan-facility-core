'use client'

import { useParams } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { AccountingAllocationEditor } from '@/components/accounting-allocation-editor'

export default function AccountingAllocationPage() {
  const params = useParams<{ documentId: string }>()
  return (
    <AppLayout>
      <PageHeader
        title="Accounting Allocations"
        description="Allocate the canonical document to entity-valid accounting dimensions and reconcile exactly to the document total before journal creation."
      />
      <AccountingAllocationEditor documentId={params.documentId} />
    </AppLayout>
  )
}
