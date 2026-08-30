'use client'

import { BankReconciliationReview } from '@/components/bank-reconciliation-review'
import { useLanguage } from '@/lib/hooks/use-language'
import { accountingPagesCopy } from '@/lib/translations/accounting-pages'

export default function AccountingReconciliationPage() {
  const { language } = useLanguage()
  const copy = accountingPagesCopy[language].reconciliation

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>
      <BankReconciliationReview />
    </div>
  )
}
