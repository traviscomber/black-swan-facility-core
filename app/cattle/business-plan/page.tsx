"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { TrendingUp, Download, Award } from "lucide-react"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"

interface BusinessPlanRecord {
  year: number
  month: string
  business_unit: string
  profit_loss: number
  inventory_count: number
}

interface ChartData {
  year: number
  crianzaProfit: number
  engordaProfit: number
  cumulativeProfit: number
  totalInventory: number
  isMilestone: boolean
  milestoneText: string
}

export default function CattleBusinessPlanPage() {
  const [data, setData] = useState<ChartData[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBusinessPlanData = async () => {
      try {
        const supabase = createBrowserClient()

        const { data: plans, error } = await supabase
          .from("cattle_business_plan")
          .select("*")
          .order("year")
          .order("month")

        if (error) throw error

        // Calculate cumulative profits and organize by year
        let cumulativeProfit = 0
        const yearlyData: Record<number, ChartData> = {}

        plans?.forEach((plan: BusinessPlanRecord) => {
          cumulativeProfit += plan.profit_loss
          const yearKey = plan.year

          if (!yearlyData[yearKey]) {
            yearlyData[yearKey] = {
              year: yearKey,
              crianzaProfit: 0,
              engordaProfit: 0,
              cumulativeProfit: 0,
              totalInventory: 0,
              isMilestone: false,
              milestoneText: "",
            }
          }

          if (plan.business_unit === "Crianza") {
            yearlyData[yearKey].crianzaProfit += plan.profit_loss
          } else {
            yearlyData[yearKey].engordaProfit += plan.profit_loss
          }
          yearlyData[yearKey].totalInventory = plan.inventory_count
          yearlyData[yearKey].cumulativeProfit = cumulativeProfit

          if (plan.year === 2027 && plan.month === "Mar") {
            yearlyData[yearKey].isMilestone = true
            yearlyData[yearKey].milestoneText = "500 Animals Break-even"
          }
          if (plan.year === 2031 && plan.month === "Dec") {
            yearlyData[yearKey].isMilestone = true
            yearlyData[yearKey].milestoneText = "140M Pesos Target"
          }
        })

        const chartData = Object.values(yearlyData)
        setData(chartData)
      } catch (error) {
        console.error("Error fetching business plan:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBusinessPlanData()
  }, [])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <p>Cargando proyecciones...</p>
        </div>
      </AppLayout>
    )
  }

  const lastYearData = data?.[data.length - 1]
  const year4Data = data?.find((d) => d.year === 2027)

  return (
    <AppLayout>
      <PageHeader title="Plan de Negocios Ganado" description="Proyecciones a 8 años (2024-2031)" />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Inversión Inicial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$262,200</div>
              <p className="text-xs text-gray-500 mt-1">Compra de animales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Año 1</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$262,200</div>
              <p className="text-xs text-gray-500 mt-1">Ventas totales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ganancia Acumulada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${lastYearData?.cumulativeProfit?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">A Diciembre 2031</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Break-even</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Año 4</div>
              <p className="text-xs text-gray-500 mt-1">Marzo 2027</p>
              <Badge className="mt-2 bg-blue-100 text-blue-800">500 animales</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Meta Final</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">140M</div>
              <p className="text-xs text-gray-500 mt-1">Pesos Diciembre 2031</p>
              <Badge className="mt-2 bg-green-100 text-green-800">Año 8</Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ganancia Acumulada - Proyección 8 Años</CardTitle>
            <CardDescription>Evolución de rentabilidad por año</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `$${value?.toLocaleString()}`}
                  labelFormatter={(label) => `Año ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cumulativeProfit"
                  stroke="#10b981"
                  name="Ganancia Acumulada"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    if (payload.isMilestone) {
                      return <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#d97706" strokeWidth={2} />
                    }
                    return <circle cx={cx} cy={cy} r={4} fill="#10b981" />
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ganancias por Unidad de Negocio</CardTitle>
            <CardDescription>Crianza vs Engorda año a año</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value?.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="crianzaProfit" stackId="a" fill="#3b82f6" name="Crianza" />
                <Bar dataKey="engordaProfit" stackId="a" fill="#f97316" name="Engorda" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" />
                <CardTitle>Hito 1: Break-even</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Año 4, Marzo 2027</strong>
              </p>
              <p className="text-sm text-gray-600 mb-3">500 participaciones/animales alcanzados</p>
              <p className="text-sm text-gray-600">Objetivo: Cubrir costos fijos operacionales ✓</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <CardTitle>Hito 2: Meta Financiera</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Año 8, Diciembre 2031</strong>
              </p>
              <p className="text-sm text-gray-600 mb-3">140 millones de pesos ganancia acumulada</p>
              <p className="text-sm text-gray-600">Objetivo: Alcanzar rentabilidad objetivo ✓</p>
            </CardContent>
          </Card>
        </div>

        {/* Export button */}
        <Button className="w-full">
          <Download className="w-4 h-4 mr-2" />
          Exportar Plan de Negocios
        </Button>
      </div>
    </AppLayout>
  )
}
