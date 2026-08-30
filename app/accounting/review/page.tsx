'use client'

import { AppLayout } from '@/components/app-layout'
import { AccountingReviewInbox } from '@/components/accounting-review-inbox'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'
import { accountingPagesCopy } from '@/lib/translations/accounting-pages'

export default function AccountingReviewPage() {
  const { language } = useLanguage()
  const copy = accountingPagesCopy[language].review

  return (
    <AppLayout>
      <PageHeader title={copy.title} description={copy.description} />
      <AccountingReviewInbox />
    </AppLayout>
  )
}
