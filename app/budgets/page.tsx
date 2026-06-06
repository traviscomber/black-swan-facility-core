'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'
import { BudgetDashboard } from '@/components/budget-dashboard'
import { BudgetUploadForm } from '@/components/budget-upload-form'
import { CostAllocationManager } from '@/components/cost-allocation-manager'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function BudgetsPage() {
  const { t } = useLanguage()

  return (
    <AppLayout>
      <PageHeader 
        title={t('pages.budgets')} 
        description={t('pages.budgets_desc')} 
      />
      <div className="p-4 md:p-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList>
            <TabsTrigger value="dashboard">{t('budget.division_summary')}</TabsTrigger>
            <TabsTrigger value="allocation">Costs</TabsTrigger>
            <TabsTrigger value="upload">{t('budget.upload_excel')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="space-y-4">
            <BudgetDashboard />
          </TabsContent>

          <TabsContent value="allocation" className="space-y-4">
            <CostAllocationManager />
          </TabsContent>
          
          <TabsContent value="upload" className="space-y-4">
            <BudgetUploadForm />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
