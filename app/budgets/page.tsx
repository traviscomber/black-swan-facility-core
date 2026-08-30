'use client'

import { AppLayout } from '@/components/app-layout'
import { BudgetFinancialMap } from '@/components/budget-financial-map'
import { BudgetRoleDashboard } from '@/components/budget-role-dashboard'
import { BudgetWorkspace } from '@/components/budget-workspace'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: { title: 'Budget & P&L', description: 'Operating budget, actual execution and controlled import of the master Excel workbook.' },
  es: { title: 'Presupuesto y P&L', description: 'Presupuesto operativo, ejecución real e importación controlada del Excel maestro.' },
  de: { title: 'Budget und P&L', description: 'Betriebsbudget, Ist-Ausführung und kontrollierter Import der zentralen Excel-Arbeitsmappe.' },
} as const

export default function BudgetsPage() {
  const { language } = useLanguage()
  const text = copy[language]
  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} />
      <BudgetRoleDashboard />
      <BudgetWorkspace />
      <BudgetFinancialMap />
    </AppLayout>
  )
}
