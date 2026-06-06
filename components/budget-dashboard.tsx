'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DollarSign, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'

interface BudgetDivision {
  id: string
  name: string
  type: 'P&L' | 'PNL'
  total_budget: number
  annual_budget: number
  revenue_target: number | null
  responsible: string | null
  created_at: string
}

interface BudgetCategory {
  id: string
  division_id: string
  name: string
  category_type: string
  monthly_amount: number
  annual_amount: number
}

interface BudgetActual {
  id: string
  division_id: string
  category_id: string
  month: number
  year: number
  actual_amount: number
}

export function BudgetDashboard() {
  const { t } = useLanguage()
  const [divisions, setDivisions] = useState<BudgetDivision[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [actuals, setActuals] = useState<BudgetActual[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDivisions()
  }, [])

  useEffect(() => {
    if (selectedDivision) {
      loadCategoriesAndActuals(selectedDivision)
    }
  }, [selectedDivision])

  const loadDivisions = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('budget_divisions')
        .select('*')
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

  const loadCategoriesAndActuals = async (divisionId: string) => {
    try {
      const supabase = createClient()
      
      const { data: categoriesData } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('division_id', divisionId)

      const { data: actualsData } = await supabase
        .from('budget_actuals')
        .select('*')
        .eq('division_id', divisionId)

      setCategories(categoriesData || [])
      setActuals(actualsData || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const getCurrentMonthActuals = (categoryId: string) => {
    const now = new Date()
    return actuals
      .filter(
        (a) =>
          a.category_id === categoryId &&
          a.month === now.getMonth() + 1 &&
          a.year === now.getFullYear()
      )
      .reduce((sum, a) => sum + a.actual_amount, 0)
  }

  const getTotalActuals = (categoryId: string) => {
    return actuals
      .filter((a) => a.category_id === categoryId)
      .reduce((sum, a) => sum + a.actual_amount, 0)
  }

  const getVariance = (budgetAmount: number, actualAmount: number) => {
    return budgetAmount - actualAmount
  }

  const getVariancePercentage = (budgetAmount: number, actualAmount: number) => {
    if (budgetAmount === 0) return 0
    return ((actualAmount / budgetAmount) * 100).toFixed(1)
  }

  const selectedDivisionData = divisions.find((d) => d.id === selectedDivision)
  const totalBudget = categories.reduce((sum, c) => sum + (c.annual_amount || 0), 0) || 0
  const totalActuals = actuals.reduce((sum, a) => sum + (a.actual_amount || 0), 0) || 0
  const totalVariance = (totalBudget || 0) - (totalActuals || 0)

  if (loading) {
    return <div className="p-6 text-center">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-6">
      {/* Division Selector */}
      <div className="flex flex-wrap gap-2">
        {divisions.map((division) => (
          <Button
            key={division.id}
            onClick={() => setSelectedDivision(division.id)}
            variant={selectedDivision === division.id ? 'default' : 'outline'}
            className="flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            {division.name}
            <Badge variant="secondary">{division.type}</Badge>
          </Button>
        ))}
      </div>

      {selectedDivisionData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  {t('budget.annual_budget')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${totalBudget.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  {t('budget.actual_costs')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ${totalActuals.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  {t('budget.remaining')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    totalVariance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  ${totalVariance.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {t('budget.variance')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {getVariancePercentage(totalBudget, totalActuals)}%
                </div>
                <p className="text-xs text-gray-600">of budget used</p>
              </CardContent>
            </Card>
          </div>

          {/* Categories Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                {t('budget.categories')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4 font-semibold">
                        {t('budget.category_name')}
                      </th>
                      <th className="text-right py-2 px-4 font-semibold">
                        {t('budget.monthly_budget')}
                      </th>
                      <th className="text-right py-2 px-4 font-semibold">
                        {t('budget.annual_budget')}
                      </th>
                      <th className="text-right py-2 px-4 font-semibold">
                        {t('budget.actual_costs')}
                      </th>
                      <th className="text-right py-2 px-4 font-semibold">
                        {t('budget.remaining')}
                      </th>
                      <th className="py-2 px-4 font-semibold">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => {
                      const categoryActuals = getTotalActuals(category.id) || 0
                      const variance = getVariance(category.annual_amount || 0, categoryActuals)
                      const percentage = getVariancePercentage(category.annual_amount || 0, categoryActuals)

                      return (
                        <tr key={category.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">{category.name}</td>
                          <td className="text-right py-3 px-4">
                            ${(category.monthly_amount || 0).toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4 font-semibold">
                            ${(category.annual_amount || 0).toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4 text-red-600">
                            ${(categoryActuals || 0).toLocaleString()}
                          </td>
                          <td
                            className={`text-right py-3 px-4 font-semibold ${
                              variance >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            ${(variance || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={Math.min(Math.max(parseFloat(percentage as string) || 0, 0), 100)}
                              />
                              <span className="text-xs font-medium whitespace-nowrap">
                                {percentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
