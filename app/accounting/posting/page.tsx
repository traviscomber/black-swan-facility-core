'use client'

import { AppLayout } from '@/components/app-layout'
import { AccountingPostingControl } from '@/components/accounting-posting-control'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'
import { accountingPagesCopy } from '@/lib/translations/accounting-pages'

export default function AccountingPostingPage() {
  const { language } = useLanguage()
  const copy = accountingPagesCopy[language].posting

  return (
    <AppLayout>
      <PageHeader title={copy.title} description={copy.description} />
      <AccountingPostingControl />
    </AppLayout>
  )
}
