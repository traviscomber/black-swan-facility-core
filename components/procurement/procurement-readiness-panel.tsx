"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, ShieldAlert, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"

type Readiness = {
  suppliersTotal: number
  suppliersApproved: number
  suppliersActive: number
  supplierCandidatesIncomplete: number
  requestsWithoutBudget: number
  requestsWithoutRequiredDate: number
  ordersWithoutExpectedDelivery: number
}

const emptyReadiness: Readiness = {
  suppliersTotal: 0,
  suppliersApproved: 0,
  suppliersActive: 0,
  supplierCandidatesIncomplete: 0,
  requestsWithoutBudget: 0,
  requestsWithoutRequiredDate: 0,
  ordersWithoutExpectedDelivery: 0,
}

export function ProcurementReadinessPanel() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [data, setData] = useState<Readiness>(emptyReadiness)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [total, approved, active, incomplete, noBudget, noDate, ordersNoDate] = await Promise.all([
      supabase.from("suppliers").select("id", { count: "exact", head: true }),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).or("email.is.null,phone.is.null,category.is.null,source_url.is.null"),
      supabase.from("procurement_requests").select("id", { count: "exact", head: true }).is("estimated_budget_clp", null),
      supabase.from("procurement_requests").select("id", { count: "exact", head: true }).is("required_date", null),
      supabase.from("procurement_purchase_orders").select("id", { count: "exact", head: true }).is("expected_delivery", null).neq("status", "cancelled"),
    ])

    const firstError = [total, approved, active, incomplete, noBudget, noDate, ordersNoDate].find((result) => result.error)?.error
    if (firstError) {
      setError(firstError.message)
      setData(emptyReadiness)
    } else {
      setData({
        suppliersTotal: total.count ?? 0,
        suppliersApproved: approved.count ?? 0,
        suppliersActive: active.count ?? 0,
        supplierCandidatesIncomplete: incomplete.count ?? 0,
        requestsWithoutBudget: noBudget.count ?? 0,
        requestsWithoutRequiredDate: noDate.count ?? 0,
        ordersWithoutExpectedDelivery: ordersNoDate.count ?? 0,
      })
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const blockers = [
    data.suppliersApproved === 0 ? "No existen proveedores aprobados para solicitar cotizaciones." : null,
    data.suppliersActive === 0 ? "No existen proveedores activos para emitir órdenes de compra." : null,
  ].filter(Boolean) as string[]

  const warnings = data.supplierCandidatesIncomplete + data.requestsWithoutBudget + data.requestsWithoutRequiredDate + data.ordersWithoutExpectedDelivery
  const healthy = blockers.length === 0 && warnings === 0

  return (
    <div className="px-4 pt-4 sm:px-8 sm:pt-6">
      <Card className={blockers.length > 0 ? "border-amber-300" : undefined}>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                {healthy ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-amber-600" />}
                Preparación del flujo de compras
              </CardTitle>
              <CardDescription>Controles previos para cotizar, aprobar, emitir y recibir compras sin estados incompletos.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">No fue posible revisar la preparación: {error}</p> : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ReadinessMetric label="Proveedores registrados" value={data.suppliersTotal} icon={Users} />
                <ReadinessMetric label="Proveedores aprobados" value={data.suppliersApproved} icon={ClipboardCheck} alert={data.suppliersApproved === 0} />
                <ReadinessMetric label="Proveedores activos" value={data.suppliersActive} icon={CheckCircle2} alert={data.suppliersActive === 0} />
                <ReadinessMetric label="Observaciones de calidad" value={warnings} icon={AlertTriangle} alert={warnings > 0} />
              </div>

              {blockers.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4 dark:bg-amber-950/10">
                <p className="text-sm font-medium">Bloqueos actuales</p>
                <div className="mt-2 space-y-1">{blockers.map((blocker) => <p key={blocker} className="text-sm text-muted-foreground">• {blocker}</p>)}</div>
                <Button asChild size="sm" className="mt-3"><Link href="/suppliers">Revisar proveedores</Link></Button>
              </div>}

              {warnings > 0 && <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <p>Candidatos incompletos: <strong className="text-foreground">{data.supplierCandidatesIncomplete}</strong></p>
                <p>Solicitudes sin presupuesto: <strong className="text-foreground">{data.requestsWithoutBudget}</strong></p>
                <p>Solicitudes sin fecha: <strong className="text-foreground">{data.requestsWithoutRequiredDate}</strong></p>
                <p>Órdenes sin entrega: <strong className="text-foreground">{data.ordersWithoutExpectedDelivery}</strong></p>
              </div>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReadinessMetric({ label, value, icon: Icon, alert = false }: { label: string; value: number; icon: typeof Users; alert?: boolean }) {
  return <div className={`rounded-lg border p-3 ${alert ? "border-amber-300" : ""}`}><div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-muted-foreground" /></div><p className="mt-1 text-2xl font-semibold">{value.toLocaleString("es-CL")}</p></div>
}
