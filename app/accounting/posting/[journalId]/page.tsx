'use client'

import { useParams } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { AccountingJournalEditor } from '@/components/accounting-journal-editor'
import { PageHeader } from '@/components/page-header'

export default function AccountingJournalPage() {
  const params = useParams<{ journalId: string }>()
  const journalId = params?.journalId

  return (
    <AppLayout>
      <PageHeader
        title="Journal Editor"
        description="Build, validate, approve and post a canonical double-entry journal."
      />
      {journalId ? <AccountingJournalEditor journalId={journalId} /> : <div className="text-sm text-muted-foreground">Journal ID is missing.</div>}
    </AppLayout>
  )
}
