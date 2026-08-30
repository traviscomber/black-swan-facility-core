'use client'

import { useParams } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { AccountingAllocationEditor } from '@/components/accounting-allocation-editor'
import { useLanguage } from '@/lib/hooks/use-language'
import { accountingPagesCopy } from '@/lib/translations/accounting-pages'

export default function AccountingAllocationPage() {
  const params = useParams<{ documentId: string }>()
  const { language } = useLanguage()
  const copy = accountingPagesCopy[language].allocations

  return (
    <AppLayout>
      <PageHeader title={copy.title} description={copy.description} />
      <AccountingAllocationEditor documentId={params.documentId} />
    </AppLayout>
  )
}
