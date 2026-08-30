'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'
import { PLReportComponent } from '@/components/pl-report'
import { Button } from '@/components/ui/button'

type Locale = 'en' | 'es' | 'de'
interface BudgetDivision { id: string; name: string; type: 'P&L' | 'PNL' }

const copy = {
  en: { title: 'P&L report', description: 'Financial performance by division.', loading: 'Loading divisions…', empty: 'No budget divisions are available.' },
  es: { title: 'Informe de resultados', description: 'Desempeño financiero por división.', loading: 'Cargando divisiones…', empty: 'No hay divisiones presupuestarias disponibles.' },
  de: { title: 'GuV-Bericht', description: 'Finanzielle Leistung nach Bereich.', loading: 'Bereiche werden geladen…', empty: 'Keine Budgetbereiche verfügbar.' },
} as const

export default function PLReportsPage() {
  const { language } = useLanguage()
  const text = copy[language as Locale]
  const [divisions, setDivisions] = useState<BudgetDivision[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDivisions = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('budget_divisions').select('id, name, type').order('name')
        if (error) throw error
        setDivisions(data || [])
        if (data?.length) setSelectedDivision(data[0].id)
      } catch (error) {
        console.error('Error loading divisions:', error)
      } finally {
        setLoading(false)
      }
    }
    void loadDivisions()
  }, [])

  return <AppLayout><PageHeader title={text.title} description={text.description} /><div className="p-4 md:p-6">
    {loading ? <p className="text-sm text-muted-foreground">{text.loading}</p> : divisions.length === 0 ? <p className="text-sm text-muted-foreground">{text.empty}</p> : <><div className="mb-6 flex flex-wrap gap-2">{divisions.map((division) => <Button key={division.id} onClick={() => setSelectedDivision(division.id)} variant={selectedDivision === division.id ? 'default' : 'outline'}>{division.name}</Button>)}</div>{selectedDivision ? <PLReportComponent divisionId={selectedDivision} /> : null}</>}
  </div></AppLayout>
}
