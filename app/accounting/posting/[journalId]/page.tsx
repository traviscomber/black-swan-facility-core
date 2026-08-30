'use client'

import { useParams } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { AccountingJournalEditor } from '@/components/accounting-journal-editor'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'
import { accountingPagesCopy } from '@/lib/translations/accounting-pages'

export default function AccountingJournalPage() {
  const params = useParams<{ journalId: string }>()
  const journalId = params?.journalId
  const { language } = useLanguage()
  const copy = accountingPagesCopy[language].journal

  return (
    <AppLayout>
      <PageHeader title={copy.title} description={copy.description} />
      {journalId ? <AccountingJournalEditor journalId={journalId} /> : <div className="text-sm text-muted-foreground">{copy.missingId}</div>}
    </AppLayout>
  )
}
