'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

interface BudgetDivision {
  id: string
  name: string
  type: 'P&L' | 'PNL'
  revenue_target: number | null
  annual_budget: number
}

interface BudgetCategory {
  id: string
  name: string
  category_type: string
  annual_amount: number
}

interface MonthlyData {
  month: number
  budget: number
  actual: number
  variance: number
}

interface PLReport {
  revenue: number
  expenses: number
  profit: number
  profitMargin: number
}

export function PLReportComponent({ divisionId }: { divisionId: string }) {
  const { t } = useLanguage()
  const [division, setDivision] = useState<BudgetDivision | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [plReport, setPlReport] = useState<PLReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReportData()
  }, [divisionId])

  const loadReportData = async () => {
    try {
      const supabase = createClient()

      // Get division
      const { data: divisionData } = await supabase
        .from('budget_divisions')
        .select('*')
        .eq('id', divisionId)
        .single()

      setDivision(divisionData)

      // Get categories
      const { data: categoriesData } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('division_id', divisionId)

      // Get actuals
      const { data: actualsData } = await supabase
        .from('budget_actuals')
        .select('*')
        .eq('division_id', divisionId)

      // Process monthly data
      const monthMap = new Map<number, MonthlyData>()
      for (let month = 1; month <= 12; month++) {
        const monthActuals = actualsData?.filter(a => a.month === month) || []
        const monthBudget = categoriesData?.reduce((sum, c) => sum + (c.monthly_amount || c.annual_amount / 12), 0) || 0
        const monthActual = monthActuals.reduce((sum, a) => sum + a.actual_amount, 0)

        monthMap.set(month, {
          month,
          budget: monthBudget,
          actual: monthActual,
          variance: monthBudget - monthActual,
        })
      }

      setMonthlyData(Array.from(monthMap.values()))

      // Calculate P&L
      const totalBudget = categoriesData?.reduce((sum, c) => sum + c.annual_amount, 0) || 0
      const totalActual = actualsData?.reduce((sum, a) => sum + a.actual_amount, 0) || 0
      const revenue = divisionData?.revenue_target || 0
      const expenses = totalActual
      const profit = revenue - expenses
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0

      setPlReport({
        revenue,
        expenses,
        profit,
        profitMargin,
      })
    } catch (error) {
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = () => {
    if (!division || !plReport) return

    let csv = `${division.name} - P&L Report\n`
    csv += `Type,${division.type}\n\n`
    csv += `Revenue,${plReport.revenue}\n`
    csv += `Expenses,${plReport.expenses}\n`
    csv += `Profit,${plReport.profit}\n`
    csv += `Profit Margin,${plReport.profitMargin.toFixed(2)}%\n\n`
    csv += `Month,Budget,Actual,Variance\n`
    
    monthlyData.forEach(data => {
      csv += `${data.month},${data.budget},${data.actual},${data.variance}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${division.name}-pl-report.csv`
    a.click()
  }

  if (loading) {
    return <div className="p-6 text-center">{t('common.loading')}</div>
  }

  if (!division || !plReport) {
    return <div className="p-6 text-center">{t('common.no_data')}</div>
  }

  return (
    <div className="space-y-6">
      {/* P&L Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {t('budget.revenue_target')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${plReport.revenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${plReport.expenses.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${plReport.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${plReport.profit.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${plReport.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {plReport.profitMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('budget.monthly_forecast')}</CardTitle>
            <Button size="sm" variant="outline" onClick={downloadReport}>
              <Download className="w-4 h-4 mr-2" />
              {t('common.download')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => `$${value.toLocaleString()}`}
                labelFormatter={(label: number) => `Month ${label}`}
              />
              <Legend />
              <Bar dataKey="budget" fill="#3b82f6" name="Budget" />
              <Bar dataKey="actual" fill="#ef4444" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Variance Trend */}
      <Card>
        <CardHeader>
          <CardTitle>{t('budget.variance')} Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => `$${value.toLocaleString()}`}
                labelFormatter={(label: number) => `Month ${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="variance" 
                stroke="#10b981" 
                name="Variance"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
