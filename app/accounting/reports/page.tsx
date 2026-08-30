'use client'

import { AppLayout } from '@/components/app-layout'
import { FinancialTransparencyDashboard } from '@/components/financial-transparency-dashboard'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'
import { accountingPagesCopy } from '@/lib/translations/accounting-pages'

export default function AccountingReportsPage() {
  const { language } = useLanguage()
  const copy = accountingPagesCopy[language].reports

  return (
    <AppLayout>
      <PageHeader title={copy.title} description={copy.description} />
      <FinancialTransparencyDashboard />
    </AppLayout>
  )
}
