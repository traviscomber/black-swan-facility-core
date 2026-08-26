"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Boxes, ClipboardCheck, ClipboardList, PackageSearch, RefreshCw, ShieldCheck, Warehouse } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"

type StockRow = { stock_state: string; inventory_value: number | string | null }
type CountRow = { status: string }
type CustodyRow = { status: string; due_at: string | null }
type IntakeRow = { status: string }
type RetirementRow = { status: string }
type AssetRow = { status: string | null; assigned_to: string | null; category_id: string | null; cost_center_id: string | null; warehouse_location_id: string | null }

type Metrics = {
  activeAssets: number
  incompleteAssets: number
  custodyActive: number
  custodyOverdue: number
  lowStock: number
  outOfStock: number
  stockValue: number
  openCounts: number
  pendingIntakes: number
  pendingRetirements: number
}

const EMPTY: Metrics = {
  activeAssets: 0,
  incompleteAssets: 0,
  custodyActive: 0,
  custodyOverdue: 0,
  lowStock: 0,
  outOfStock: 0,
  stockValue: 0,
  openCounts: 0,
  pendingIntakes: 0,
  pendingRetirements: 0,
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function InventoryCommandCenter() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { loading: accessLoading, can, canAccessDepartment } = useEffectiveAccess()
  const canOperate = can("inventory.process") && canAccessDepartment("inventory")
  const [metrics, setMetrics] = useState<Metrics>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (accessLoading) return
    if (!canOperate) {
      setMetrics(EMPTY)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const [assetsResult, stockResult, countsResult, custodiesResult, intakeResult, retirementsResult] = await Promise.all([
      supabase.from("assets").select("status,assigned_to,category_id,cost_center_id,warehouse_location_id").neq("status", "deprecated"),
      supabase.from("inventory_stock_status").select("stock_state,inventory_value"),
      supabase.from("inventory_count_sessions").select("status").in("status", ["in_progress", "submitted", "approved"]),
      supabase.from("inventory_asset_custodies").select("status,due_at").eq("status", "active"),
      supabase.from("procurement_inventory_intake").select("status").eq("status", "pending"),
      supabase.from("asset_retirement_requests").select("status").in("status", ["pending", "approved"]),
    ])

    const results = [assetsResult, stockResult, countsResult, custodiesResult, intakeResult, retirementsResult]
    const firstError = results.find((result) => result.error)?.error
    if (firstError) setError(firstError.message)

    const assets = (assetsResult.data ?? []) as AssetRow[]
    const stock = (stockResult.data ?? []) as StockRow[]
    const counts = (countsResult.data ?? []) as CountRow[]
    const custodies = (custodiesResult.data ?? []) as CustodyRow[]
    const intakes = (intakeResult.data ?? []) as IntakeRow[]
    const retirements = (retirementsResult.data ?? []) as RetirementRow[]
    const now = Date.now()

    setMetrics({
      activeAssets: assets.length,
      incompleteAssets: assets.filter((asset) => !asset.category_id || !asset.cost_center_id || !asset.warehouse_location_id).length,
      custodyActive: custodies.length,
      custodyOverdue: custodies.filter((custody) => custody.due_at && new Date(custody.due_at).getTime() < now).length,
      lowStock: stock.filter((item) => item.stock_state === "low").length,
      outOfStock: stock.filter((item) => item.stock_state === "out").length,
      stockValue: stock.reduce((sum, item) => sum + numberValue(item.inventory_value), 0),
      openCounts: counts.length,
      pendingIntakes: intakes.length,
      pendingRetirements: retirements.length,
    })
    setLoading(false)
  }, [accessLoading, canOperate, supabase])

  useEffect(() => { void load() }, [load])

  if (accessLoading || !canOperate) return null

  const critical = metrics.custodyOverdue + metrics.outOfStock + metrics.pendingRetirements
  const attention = metrics.incompleteAssets + metrics.lowStock + metrics.openCounts + metrics.pendingIntakes

  return (
    <div className="px-4 pt-4 md:px-6 md:pt-6">
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="border-b bg-muted/20 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="rounded-lg border bg-background p-2"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                  <CardTitle className="text-lg">Inventory Command Center</CardTitle>
                  <CardDescription>Estado operacional consolidado de activos, stock, custodias, conteos e ingresos.</CardDescription>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={critical > 0 ? "destructive" : "default"}>{critical > 0 ? `${critical} críticas` : "Sin críticas"}</Badge>
              <Badge variant="outline">{attention} por revisar</Badge>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          {error && <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900">El tablero se cargó parcialmente: {error}</div>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric icon={Boxes} label="Activos" value={metrics.activeAssets} detail={`${metrics.incompleteAssets} incompletos`} alert={metrics.incompleteAssets > 0} />
            <Metric icon={ShieldCheck} label="En custodia" value={metrics.custodyActive} detail={`${metrics.custodyOverdue} vencidas`} alert={metrics.custodyOverdue > 0} />
            <Metric icon={PackageSearch} label="Stock crítico" value={metrics.lowStock + metrics.outOfStock} detail={`${metrics.outOfStock} sin stock`} alert={metrics.outOfStock > 0} />
            <Metric icon={ClipboardList} label="Conteos abiertos" value={metrics.openCounts} detail="Ubicaciones congeladas" alert={metrics.openCounts > 0} />
            <Metric icon={ClipboardCheck} label="Ingresos pendientes" value={metrics.pendingIntakes} detail={`${metrics.pendingRetirements} bajas en workflow`} alert={metrics.pendingRetirements > 0} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <ActionCard href="/inventory/stock" icon={PackageSearch} title="Stock y kardex" detail={metrics.lowStock + metrics.outOfStock > 0 ? `${metrics.lowStock + metrics.outOfStock} posiciones requieren reposición` : "Saldos, movimientos y reposición"} alert={metrics.outOfStock > 0} />
            <ActionCard href="/inventory/counts" icon={ClipboardList} title="Conteos cíclicos" detail={metrics.openCounts > 0 ? `${metrics.openCounts} sesiones en curso o revisión` : "Abrir control físico por ubicación"} alert={metrics.openCounts > 0} />
            <ActionCard href="/inventory/intake" icon={Warehouse} title="Ingresos desde Compras" detail={metrics.pendingIntakes > 0 ? `${metrics.pendingIntakes} recepciones por clasificar` : "Sin ingresos pendientes"} alert={metrics.pendingIntakes > 0} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/15 p-3 text-sm">
            <div className="flex items-center gap-2"><AlertTriangle className={`h-4 w-4 ${critical > 0 ? "text-destructive" : "text-muted-foreground"}`} /><span>{critical > 0 ? "Hay excepciones que requieren acción operacional." : "No hay excepciones críticas abiertas en Inventario."}</span></div>
            <span className="text-muted-foreground">Valor de stock registrado: {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(metrics.stockValue)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail, alert }: { icon: typeof Boxes; label: string; value: number; detail: string; alert: boolean }) {
  return <div className={`rounded-xl border p-4 ${alert ? "border-amber-300 bg-amber-50/50" : "bg-background"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span><Icon className={`h-4 w-4 ${alert ? "text-amber-700" : "text-muted-foreground"}`} /></div><p className="mt-3 text-3xl font-semibold tabular-nums">{value.toLocaleString("es-CL")}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
}

function ActionCard({ href, icon: Icon, title, detail, alert }: { href: string; icon: typeof Boxes; title: string; detail: string; alert: boolean }) {
  return <Link href={href} className="group rounded-xl border bg-background p-4 transition-colors hover:bg-muted/40"><div className="flex items-start justify-between gap-3"><div className="rounded-lg border p-2"><Icon className="h-4 w-4" /></div>{alert && <Badge variant="outline" className="border-amber-300 text-amber-800">Revisar</Badge>}</div><p className="mt-4 font-medium group-hover:underline">{title}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></Link>
}