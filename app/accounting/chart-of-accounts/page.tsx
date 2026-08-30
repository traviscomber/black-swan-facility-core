'use client'

import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { AccountingCoaImport } from '@/components/accounting-coa-import'
import { useLanguage } from '@/lib/hooks/use-language'
import { accountingPagesCopy } from '@/lib/translations/accounting-pages'

export default function ChartOfAccountsPage() {
  const { language } = useLanguage()
  const copy = accountingPagesCopy[language].chartOfAccounts

  return (
    <AppLayout>
      <PageHeader title={copy.title} description={copy.description} />
      <AccountingCoaImport />
    </AppLayout>
  )
}
