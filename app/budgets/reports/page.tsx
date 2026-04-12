'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'
import { PLReportComponent } from '@/components/pl-report'
import { Button } from '@/components/ui/button'

interface BudgetDivision {
  id: string
  name: string
  type: 'P&L' | 'PNL'
}

export default function PLReportsPage() {
  const { t } = useLanguage()
  const [divisions, setDivisions] = useState<BudgetDivision[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDivisions()
  }, [])

  const loadDivisions = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('budget_divisions')
        .select('id, name, type')
        .order('name')

      if (error) throw error
      setDivisions(data || [])
      if (data && data.length > 0) {
        setSelectedDivision(data[0].id)
      }
    } catch (error) {
      console.error('Error loading divisions:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <PageHeader 
        title={t('budget.pl_report')} 
        description="Financial performance by division" 
      />
      <div className="p-4 md:p-6">
        {/* Division Selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {divisions.map(division => (
            <Button
              key={division.id}
              onClick={() => setSelectedDivision(division.id)}
              variant={selectedDivision === division.id ? 'default' : 'outline'}
            >
              {division.name}
            </Button>
          ))}
        </div>

        {/* P&L Report */}
        {selectedDivision && (
          <PLReportComponent divisionId={selectedDivision} />
        )}
      </div>
    </AppLayout>
  )
}
