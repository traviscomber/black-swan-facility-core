"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EditPricingDialog } from "@/components/edit-pricing-dialog"
import { EditCostDialog } from "@/components/edit-cost-dialog"
import { BusinessPlanUpload } from "@/components/cattle/business-plan-upload"
import { Pencil, TrendingUp } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts"

interface PricingData {
  id: string
  animal_type: string
  price_pesos: number
  unit: string
  category: string
  description: string
  quantity_standard: number
}

interface CostData {
  id: string
  cost_type: string
  amount_pesos: number
  unit: string
  description: string
  business_unit: string
  is_fixed: boolean
}

interface BusinessPlanRecord {
  id: string
  year: number
  month: string
  inventory_count: number
  purchase_amount: number
  sales_amount: number
  operational_cost: number
  profit_loss: number
  business_unit: string
}

export default function PricingCostsPage() {
  const [pricing, setPricing] = useState<PricingData[]>([])
  const [costs, setCosts] = useState<CostData[]>([])
  const [businessPlan, setBusinessPlan] = useState<BusinessPlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPricing, setEditingPricing] = useState<PricingData | null>(null)
  const [editingCost, setEditingCost] = useState<CostData | null>(null)
  const [showPricingDialog, setShowPricingDialog] = useState(false)
  const [showCostDialog, setShowCostDialog] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const supabase = createBrowserClient()

      const [pricingRes, costsRes, businessPlanRes] = await Promise.all([
        supabase.from("cattle_pricing").select("*").eq("is_active", true),
        supabase.from("cattle_operational_costs").select("*"),
        supabase.from("cattle_business_plan").select("*").order("year").order("month"),
      ])

      if (pricingRes.data) setPricing(pricingRes.data)
      if (costsRes.data) setCosts(costsRes.data)
      if (businessPlanRes.data) {
        console.log("[v0] Loaded business plan records:", businessPlanRes.data.length)
        setBusinessPlan(businessPlanRes.data)
      }
    } catch (error) {
      console.error("[v0] Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePricingUpdated = async () => {
    try {
      const supabase = createBrowserClient()
      const { data } = await supabase.from("cattle_pricing").select("*").eq("is_active", true)
      if (data) setPricing(data)
    } catch (error) {
      console.error("[v0] Error refreshing pricing:", error)
    }
  }

  const handleCostUpdated = async () => {
    try {
      const supabase = createBrowserClient()
      const { data } = await supabase.from("cattle_operational_costs").select("*")
      if (data) setCosts(data)
    } catch (error) {
      console.error("[v0] Error refreshing costs:", error)
    }
  }

  const chartData = businessPlan
    .filter((bp) => bp.business_unit?.includes("CRIANZA"))
    .map((bp) => ({
      period: `${bp.year}-${bp.month}`,
      compra: bp.purchase_amount || 0,
      venta: bp.sales_amount || 0,
      ganancia: bp.profit_loss || 0,
      costo: bp.operational_cost || 0,
    }))

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Costos y Plan de Negocios"
          description="Gestiona precios, costos operacionales y proyecciones del negocio ganadero"
        />

        {/* Business Plan Upload */}
        <BusinessPlanUpload onDataLoaded={() => fetchData()} />

        {/* Business Plan Charts */}
        {businessPlan.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Proyección: Compra vs Venta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" angle={-45} height={80} />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="compra" fill="#ef4444" name="Compra" />
                    <Bar dataKey="venta" fill="#22c55e" name="Venta" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Proyección: Ganancia/Pérdida</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" angle={-45} height={80} />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend />
                    <Line type="monotone" dataKey="ganancia" stroke="#3b82f6" strokeWidth={2} name="Ganancia" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Business Plan Summary Table */}
        {businessPlan.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Plan de Negocios</CardTitle>
              <CardDescription>
                {businessPlan.length} registros cargados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Régimen</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Compra</TableHead>
                      <TableHead className="text-right">Venta</TableHead>
                      <TableHead className="text-right">Costo Op.</TableHead>
                      <TableHead className="text-right">Ganancia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businessPlan.slice(0, 10).map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium text-sm">
                          <Badge variant="outline">{record.business_unit}</Badge>
                        </TableCell>
                        <TableCell>
                          {record.year}-{record.month}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          ${record.purchase_amount?.toLocaleString() || "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          ${record.sales_amount?.toLocaleString() || "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          ${record.operational_cost?.toLocaleString() || "-"}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-medium ${record.profit_loss >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${record.profit_loss?.toLocaleString() || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing & Costs Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Breeding Prices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Precios - Crianza</span>
                <Badge variant="outline">{pricing.filter(p => p.category === "Breeding").length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead>Unidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pricing.filter(p => p.category === "Breeding").map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">{item.animal_type}</TableCell>
                        <TableCell className="text-right">${item.price_pesos.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{item.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Fattening Prices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Precios - Engorda</span>
                <Badge variant="outline">{pricing.filter(p => p.category === "Fattening").length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead>Unidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pricing.filter(p => p.category === "Fattening").map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">{item.animal_type}</TableCell>
                        <TableCell className="text-right">${item.price_pesos.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{item.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Operational Costs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Costos Operacionales</span>
              <Badge variant="outline">{costs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de Costo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Régimen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costs.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-sm">{item.cost_type}</TableCell>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-right">${item.amount_pesos.toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{item.unit}</TableCell>
                      <TableCell>
                        <Badge variant={item.is_fixed ? "default" : "secondary"}>
                          {item.is_fixed ? "Fijo" : "Variable"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
