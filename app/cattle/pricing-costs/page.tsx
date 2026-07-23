"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { BusinessPlanUpload } from "@/components/cattle/business-plan-upload"

interface PricingData {
  id: string
  animal_type: string
  price_pesos: number
  unit: string
  category: string
  description: string | null
  quantity_standard: number | null
}

interface CostData {
  id: string
  cost_type: string
  amount_pesos: number
  unit: string
  description: string | null
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

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })
const number = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 })

const unitLabels: Record<string, string> = {
  unit: "por animal",
  kg: "por kilogramo",
  year: "por año",
  "one-time": "pago único",
  percent: "porcentaje",
}

export default function PricingCostsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [pricing, setPricing] = useState<PricingData[]>([])
  const [costs, setCosts] = useState<CostData[]>([])
  const [plan, setPlan] = useState<BusinessPlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [pricingRes, costsRes, planRes] = await Promise.all([
      supabase.from("cattle_pricing").select("id, animal_type, price_pesos, unit, category, description, quantity_standard").eq("is_active", true).order("category").order("animal_type"),
      supabase.from("cattle_operational_costs").select("id, cost_type, amount_pesos, unit, description, business_unit, is_fixed").order("business_unit").order("cost_type"),
      supabase.from("cattle_business_plan").select("id, year, month, inventory_count, purchase_amount, sales_amount, operational_cost, profit_loss, business_unit").order("year").order("month"),
    ])

    const loadError = pricingRes.error || costsRes.error || planRes.error
    if (loadError) {
      setError(loadError.message)
      setPricing([])
      setCosts([])
      setPlan([])
    } else {
      setPricing((pricingRes.data ?? []) as PricingData[])
      setCosts((costsRes.data ?? []) as CostData[])
      setPlan((planRes.data ?? []) as BusinessPlanRecord[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchData() }, [fetchData])

  const summary = useMemo(() => ({
    firstYear: plan.length ? Math.min(...plan.map((item) => item.year)) : null,
    lastYear: plan.length ? Math.max(...plan.map((item) => item.year)) : null,
    purchases: plan.reduce((sum, item) => sum + Number(item.purchase_amount ?? 0), 0),
    sales: plan.reduce((sum, item) => sum + Number(item.sales_amount ?? 0), 0),
    costs: plan.reduce((sum, item) => sum + Number(item.operational_cost ?? 0), 0),
    result: plan.reduce((sum, item) => sum + Number(item.profit_loss ?? 0), 0),
  }), [plan])

  const questionablePrices = pricing.filter((item) => item.unit === "unit" && Number(item.price_pesos) < 10000).length
  const breeding = pricing.filter((item) => item.category === "Breeding")
  const fattening = pricing.filter((item) => item.category === "Fattening")

  return (
    <AppLayout>
      <PageHeader
        title="Ganadería · costos y escenarios"
        description="Supuestos de precios, costos operacionales y proyecciones cargadas para la unidad ganadera de Fundo Corcovado."
      />

      <div className="space-y-6 p-4 sm:p-8">
        <Card className="border-amber-300">
          <CardContent className="flex gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">Escenario financiero, no contabilidad ejecutada</p>
              <p className="mt-1 text-sm text-muted-foreground">Los registros de esta sección son supuestos y proyecciones. No deben interpretarse como compras, ventas, costos o utilidades efectivamente realizadas.</p>
            </div>
          </CardContent>
        </Card>

        {questionablePrices > 0 && (
          <Card className="border-amber-300">
            <CardContent className="p-5 text-sm">
              <p className="font-medium">Hay {questionablePrices} precios con unidad “por animal” y valor inferior a $10.000.</p>
              <p className="mt-1 text-muted-foreground">Es probable que algunos correspondan a precio por kilogramo o a otra unidad heredada. Se mantienen sin modificación hasta validación administrativa.</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/60">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <p className="text-sm text-destructive">No fue posible cargar la información: {error}</p>
              <Button variant="outline" size="sm" onClick={() => void fetchData()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric title="Período proyectado" value={summary.firstYear && summary.lastYear ? `${summary.firstYear}–${summary.lastYear}` : "Sin datos"} detail={`${plan.length} registros cargados`} />
          <Metric title="Compras proyectadas" value={clp.format(summary.purchases)} />
          <Metric title="Ventas proyectadas" value={clp.format(summary.sales)} />
          <Metric title="Costos proyectados" value={clp.format(summary.costs)} />
          <Metric title="Resultado proyectado" value={clp.format(summary.result)} detail="Suma del campo profit_loss" />
        </div>

        <BusinessPlanUpload onDataLoaded={() => void fetchData()} />

        <div className="grid gap-6 xl:grid-cols-2">
          <PricingTable title="Precios de crianza" records={breeding} />
          <PricingTable title="Precios de engorda" records={fattening} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Costos operacionales registrados</CardTitle>
            <CardDescription>Montos de referencia; la periodicidad y unidad se muestran exactamente según el registro.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Concepto</TableHead><TableHead>Unidad ganadera</TableHead><TableHead>Tipo</TableHead><TableHead>Unidad</TableHead><TableHead className="text-right">Valor registrado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Cargando costos…</TableCell></TableRow> : costs.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No hay costos registrados.</TableCell></TableRow> : costs.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><p className="font-medium">{item.cost_type}</p>{item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}</TableCell>
                      <TableCell>{item.business_unit || "General"}</TableCell>
                      <TableCell><Badge variant="outline">{item.is_fixed ? "Fijo" : "Variable"}</Badge></TableCell>
                      <TableCell>{unitLabels[item.unit] ?? item.unit}</TableCell>
                      <TableCell className="text-right font-medium">{item.unit === "percent" ? `${number.format(item.amount_pesos)}%` : clp.format(item.amount_pesos)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalle del escenario cargado</CardTitle>
            <CardDescription>Primeros 20 registros ordenados por año y mes. Los montos están expresados como CLP según el esquema actual.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Unidad</TableHead><TableHead>Período</TableHead><TableHead className="text-right">Inventario</TableHead><TableHead className="text-right">Compras</TableHead><TableHead className="text-right">Ventas</TableHead><TableHead className="text-right">Costos</TableHead><TableHead className="text-right">Resultado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando escenario…</TableCell></TableRow> : plan.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No hay proyecciones cargadas.</TableCell></TableRow> : plan.slice(0, 20).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Badge variant="outline">{item.business_unit}</Badge></TableCell>
                      <TableCell>{item.year}-{item.month}</TableCell>
                      <TableCell className="text-right">{number.format(item.inventory_count ?? 0)}</TableCell>
                      <TableCell className="text-right">{clp.format(item.purchase_amount ?? 0)}</TableCell>
                      <TableCell className="text-right">{clp.format(item.sales_amount ?? 0)}</TableCell>
                      <TableCell className="text-right">{clp.format(item.operational_cost ?? 0)}</TableCell>
                      <TableCell className="text-right font-medium">{clp.format(item.profit_loss ?? 0)}</TableCell>
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

function PricingTable({ title, records }: { title: string; records: PricingData[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center justify-between text-base"><span>{title}</span><Badge variant="outline">{records.length}</Badge></CardTitle></CardHeader>
      <CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Unidad</TableHead><TableHead className="text-right">Precio registrado</TableHead></TableRow></TableHeader><TableBody>{records.length === 0 ? <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Sin precios registrados.</TableCell></TableRow> : records.map((item) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.animal_type}</p>{item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}</TableCell><TableCell>{unitLabels[item.unit] ?? item.unit}</TableCell><TableCell className="text-right font-medium">{clp.format(item.price_pesos)}</TableCell></TableRow>)}</TableBody></Table></div></CardContent>
    </Card>
  )
}

function Metric({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold tracking-tight">{value}</div>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>
}
