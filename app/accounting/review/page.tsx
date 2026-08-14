'use client'

import { AppLayout } from '@/components/app-layout'
import { AccountingReviewInbox } from '@/components/accounting-review-inbox'
import { PageHeader } from '@/components/page-header'

export default function AccountingReviewPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Accounting Review"
        description="Review OCR and document-classification proposals before any canonical posting or reconciliation."
      />
      <AccountingReviewInbox />
    </AppLayout>
  )
}
