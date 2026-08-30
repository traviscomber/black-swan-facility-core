'use client'

import { AppLayout } from '@/components/app-layout'
import { BudgetFinancialMap } from '@/components/budget-financial-map'
import { BudgetWorkspace } from '@/components/budget-workspace'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: { title: 'Reconciliation', description: 'Reconcile actual execution and supporting documents against the canonical Budget & P&L.' },
  es: { title: 'Conciliación', description: 'Cruza la ejecución real y sus documentos contra el Budget & P&L canónico.' },
  de: { title: 'Abstimmung', description: 'Gleichen Sie die Ist-Ausführung und zugehörigen Dokumente mit dem kanonischen Budget & P&L ab.' },
} as const

export default function BudgetReconciliationPage() {
  const { language } = useLanguage()
  const text = copy[language]
  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} />
      <BudgetWorkspace />
      <BudgetFinancialMap />
    </AppLayout>
  )
}
