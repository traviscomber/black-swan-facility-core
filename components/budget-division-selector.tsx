'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'
import { useBudgetDivision } from '@/lib/budget-context'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'

interface BudgetDivision {
  id: string
  name: string
  type: 'P&L' | 'PNL'
}

export function BudgetDivisionSelector() {
  const { t } = useLanguage()
  const { selectedDivision, setSelectedDivision } = useBudgetDivision()
  const [divisions, setDivisions] = useState<BudgetDivision[]>([])
  const [isOpen, setIsOpen] = useState(false)
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
      
      // Auto-select first division if none selected
      if (!selectedDivision && data && data.length > 0) {
        setSelectedDivision(data[0].id)
      }
    } catch (error) {
      console.error('Error loading divisions:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentDivision = divisions.find(d => d.id === selectedDivision)

  if (loading || divisions.length === 0) {
    return null
  }

  return (
    <div className="px-4 py-3 border-b">
      <p className="text-xs uppercase font-semibold text-gray-600 mb-2">
        {t('budget.divisions')}
      </p>
      <div className="relative">
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{currentDivision?.name || t('common.select')}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50">
            {divisions.map(division => (
              <button
                key={division.id}
                onClick={() => {
                  setSelectedDivision(division.id)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                  division.id === selectedDivision ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                }`}
              >
                <span>{division.name}</span>
                <span className="text-xs px-2 py-1 rounded bg-gray-200">{division.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
