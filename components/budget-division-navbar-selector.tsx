'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DollarSign } from 'lucide-react'

interface BudgetDivision {
  id: string
  name: string
  type: 'P&L' | 'PNL'
}

export function BudgetDivisionSelector() {
  const { t } = useLanguage()
  const [divisions, setDivisions] = useState<BudgetDivision[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
      console.error('Error loading budget divisions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || divisions.length === 0) {
    return null
  }

  return (
    <div className="px-4 py-3 border-b border-slate-700 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <DollarSign size={14} />
        {t('budget.divisions')}
      </div>
      <Select value={selectedDivision || ''} onValueChange={setSelectedDivision}>
        <SelectTrigger className="w-full h-8 text-sm bg-slate-800 border-slate-600">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-600">
          {divisions.map((division) => (
            <SelectItem key={division.id} value={division.id} className="text-sm">
              <span className="flex items-center gap-2">
                {division.name}
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                  {division.type}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
