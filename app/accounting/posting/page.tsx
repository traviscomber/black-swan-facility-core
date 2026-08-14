'use client'

import { AppLayout } from '@/components/app-layout'
import { AccountingPostingControl } from '@/components/accounting-posting-control'
import { PageHeader } from '@/components/page-header'

export default function AccountingPostingPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Accounting Posting"
        description="Materialize approved source documents and prepare draft journals. Posting remains blocked until journal lines are explicitly reviewed and balanced."
      />
      <AccountingPostingControl />
    </AppLayout>
  )
}
