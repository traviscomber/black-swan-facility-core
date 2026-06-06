'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle } from 'lucide-react'

interface CostAssignment {
  id: string
  costType: 'employee' | 'fuel' | 'maintenance' | 'other'
  costName: string
  costId: string
  divisionId: string | null
  amount: number
}

interface BudgetDivision {
  id: string
  name: string
}

export function CostAllocationManager() {
  const { t } = useLanguage()
  const [divisions, setDivisions] = useState<BudgetDivision[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [costs, setCosts] = useState<CostAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()

      // Load divisions
      const { data: divisionsData } = await supabase
        .from('budget_divisions')
        .select('id, name')
        .order('name')

      setDivisions(divisionsData || [])
      if (divisionsData && divisionsData.length > 0) {
        setSelectedDivisionId(divisionsData[0].id)
      }

      // Load employees (as cost items)
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, name, salary')
        .order('name')

      if (employeesData) {
        const employeeCosts: CostAssignment[] = employeesData.map(emp => ({
          id: `emp-${emp.id}`,
          costType: 'employee',
          costName: emp.name,
          costId: emp.id,
          divisionId: null,
          amount: emp.salary || 0,
        }))
        setCosts(employeeCosts)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const assignCostToDivision = async (costId: string, divisionId: string) => {
    try {
      const supabase = createClient()
      const cost = costs.find(c => c.id === costId)
      
      if (!cost) return

      // Update the cost assignment (this would require a cost_assignments table)
      // For now, we'll just update the UI
      setCosts(costs.map(c => 
        c.id === costId ? { ...c, divisionId } : c
      ))

      // Insert into budget_actuals if it's a monthly cost
      if (cost.amount) {
        const { error } = await supabase
          .from('budget_actuals')
          .insert({
            division_id: divisionId,
            category_id: null, // Link to appropriate category
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            actual_amount: cost.amount,
          })

        if (error) console.error('Error recording cost:', error)
      }
    } catch (error) {
      console.error('Error assigning cost:', error)
    }
  }

  const unassignCost = async (costId: string) => {
    setCosts(costs.map(c => 
      c.id === costId ? { ...c, divisionId: null } : c
    ))
  }

  if (loading) {
    return <div className="p-6 text-center">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Cost Assignment to Divisions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Assign operational costs (employees, fuel, maintenance) to budget divisions
          </p>

          <div className="space-y-4">
            {costs.map(cost => {
              const assignedDivision = divisions.find(d => d.id === cost.divisionId)
              
              return (
                <div key={cost.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold">{cost.costName}</div>
                    <p className="text-sm text-gray-600">
                      {cost.costType.toUpperCase()} - ${cost.amount.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {assignedDivision ? (
                      <>
                        <Badge variant="default">{assignedDivision.name}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => unassignCost(cost.id)}
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        {divisions.map(division => (
                          <Button
                            key={division.id}
                            size="sm"
                            variant="outline"
                            onClick={() => assignCostToDivision(cost.id, division.id)}
                          >
                            Assign to {division.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary by Division */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Costs by Division
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {divisions.map(division => {
              const divisionCosts = costs
                .filter(c => c.divisionId === division.id)
                .reduce((sum, c) => sum + c.amount, 0)

              return (
                <div key={division.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold">{division.name}</p>
                    <p className="text-sm text-gray-600">
                      {costs.filter(c => c.divisionId === division.id).length} costs assigned
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${divisionCosts.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">Total/Year</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
