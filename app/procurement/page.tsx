"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ClipboardList, RefreshCw, Send, ShieldCheck, ShoppingCart, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { createBrowserClient } from "@/lib/supabase/client"

type RequestRow = {
  id: string
  request_number: string | null
  title: string
  category: string
  priority: string
  status: string
  estimated_budget_clp: number | null
  required_date: string | null
  created_at: string
}

type PurchaseOrderRow = {
  id: string
  order_number: string | null
  status: string
  currency: string
  total: number
  expected_delivery: string | null
  created_at: string
  supplier: { name: string } | null
  request: { title: string; request_number: string | null } | null
}

type RawPurchaseOrder = Omit<PurchaseOrderRow, "supplier" | "request"> & {
  suppliers: { name: string } | { name: string }[] | null
  procurement_requests: { title: string; request_number: string | null } | { title: string; request_number: string | null }[] | null
}

const REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  submitted: "Enviada",
  under_review: "En revisión",
  approved: "Aprobada",
  approved_for_quotation: "En cotización",
  final_approved: "Aprobación final",
  rejected: "Rechazada",
  converted: "Convertida",
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  ready_to_issue: "Lista para emitir",
  issued: "Emitida",
  acknowledged: "Acusada",
  confirmed: "Confirmada",
  partially_received: "Recepción parcial",
  received: "Recibida",
  cancelled: "Cancelada",
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  normal: "Normal",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
  urgent: "Urgente",
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function formatMoney(value: number, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CLP" ? 0 : 2,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago" }).format(new Date(`${value}T12:00:00`))
}

export default function ProcurementPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { loading: accessLoading, can, canAccessDepartment } = useEffectiveAccess()
  const canManage = !accessLoading && can("procurement.manage") && canAccessDepartment("procurement")
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([])
  const [approvedSuppliers, setApprovedSuppliers] = useState(0)
  const [pendingSuppliers, setPendingSuppliers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const [requestsResult, ordersResult, approvedResult, pendingResult] = await Promise.all([
      supabase
        .from("procurement_requests")
        .select("id, request_number, title, category, priority, status, estimated_budget_clp, required_date, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("procurement_purchase_orders")
        .select("id, order_number, status, currency, total, expected_delivery, created_at, suppliers(name), procurement_requests(title, request_number)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("is_active", true).eq("approval_status", "approved"),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
    ])

    const error = requestsResult.error || ordersResult.error || approvedResult.error || pendingResult.error
    if (error) {
      setLoadError(error.message)
      setRequests([])
      setOrders([])
      setApprovedSuppliers(0)
      setPendingSuppliers(0)
    } else {
      setRequests((requestsResult.data ?? []) as RequestRow[])
      setOrders(((ordersResult.data ?? []) as unknown as RawPurchaseOrder[]).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        currency: order.currency,
        total: Number(order.total ?? 0),
        expected_delivery: order.expected_delivery,
        created_at: order.created_at,
        supplier: firstRelation(order.suppliers),
        request: firstRelation(order.procurement_requests),
      })))
      setApprovedSuppliers(approvedResult.count ?? 0)
      setPendingSuppliers(pendingResult.count ?? 0)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadData() }, [loadData])

  async function transitionOrder(order: PurchaseOrderRow, action: "issue" | "confirm") {
    if (!canManage || processingOrderId) return
    setProcessingOrderId(order.id)
    setLoadError(null)
    const { error } = await supabase.rpc("transition_procurement_purchase_order", {
      p_order_id: order.id,
      p_action: action,
      p_notes: action === "issue" ? "Emisión registrada desde Compras." : "Confirmación registrada desde Compras.",
    })
    setProcessingOrderId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    toast({ title: action === "issue" ? "Orden emitida" : "Orden confirmada", description: `${order.order_number ?? "Orden"} actualizó su estado de forma atómica.` })
    await loadData()
  }

  const requestBudget = requests.reduce((sum, request) => sum + Number(request.estimated_budget_clp ?? 0), 0)
  const orderTotals = orders.reduce<Record<string, number>>((totals, order) => {
    totals[order.currency] = (totals[order.currency] ?? 0) + Number(order.total ?? 0)
    return totals
  }, {})

  return (
    <AppLayout>
      <PageHeader
        title="Compras · Fundo Corcovado"
        description="Flujo interno desde la solicitud y aprobación hasta la emisión y recepción de órdenes de compra."
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href="/procurement/requests"><ClipboardList className="mr-2 h-4 w-4" />Solicitudes</Link></Button>
          <Button variant="outline" asChild><Link href="/suppliers"><Users className="mr-2 h-4 w-4" />Proveedores</Link></Button>
          <Button variant="outline" asChild><Link href="/procurement/approvals"><ShieldCheck className="mr-2 h-4 w-4" />Aprobaciones</Link></Button>
        </div>}
      />

      <div className="space-y-6 p-4 sm:p-8">
        {loadError && <Card className="border-destructive/60"><CardContent className="flex items-center justify-between gap-4 p-5"><p className="text-sm text-destructive">No fue posible completar la operación de Compras: {loadError}</p><Button variant="outline" size="sm" onClick={() => void loadData()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric title="Solicitudes registradas" value={requests.length} />
          <Metric title="Presupuesto solicitado" value={formatMoney(requestBudget)} detail="Suma de presupuestos registrados" />
          <Metric title="Órdenes registradas" value={orders.length} />
          <Metric title="Proveedores aprobados" value={approvedSuppliers} />
          <Metric title="Proveedores pendientes" value={pendingSuppliers} alert={pendingSuppliers > 0} />
        </div>

        {Object.keys(orderTotals).length > 0 && <Card><CardHeader><CardTitle className="text-base">Monto de órdenes por moneda</CardTitle><CardDescription>Totales registrados; no equivalen a pagos ejecutados.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3">{Object.entries(orderTotals).map(([currency, total]) => <Badge key={currency} variant="outline" className="px-3 py-2 text-sm">{formatMoney(total, currency)}</Badge>)}</CardContent></Card>}

        <Card>
          <CardHeader><CardTitle>Solicitudes recientes</CardTitle><CardDescription>Requerimientos que alimentan el proceso de cotización, comparación y aprobación.</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Solicitud</TableHead><TableHead>Categoría</TableHead><TableHead>Presupuesto</TableHead><TableHead>Fecha requerida</TableHead><TableHead>Prioridad</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>
                {loading ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Cargando solicitudes…</TableCell></TableRow> : requests.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center"><ClipboardList className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">No hay solicitudes registradas.</p><Button className="mt-4" asChild><Link href="/procurement/requests">Crear primera solicitud</Link></Button></TableCell></TableRow> : requests.map((request) => <TableRow key={request.id}><TableCell className="font-mono text-xs">{request.request_number ?? "Pendiente"}</TableCell><TableCell className="font-medium">{request.title}</TableCell><TableCell>{request.category}</TableCell><TableCell>{request.estimated_budget_clp === null ? "Sin monto" : formatMoney(request.estimated_budget_clp)}</TableCell><TableCell>{formatDate(request.required_date)}</TableCell><TableCell>{PRIORITY_LABELS[request.priority] ?? request.priority}</TableCell><TableCell><Badge variant="outline">{REQUEST_STATUS_LABELS[request.status] ?? request.status}</Badge></TableCell></TableRow>)}
              </TableBody></Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Órdenes de compra recientes</CardTitle><CardDescription>Las órdenes listas para emitir y las emitidas avanzan por un RPC transaccional antes de quedar disponibles para recepción.</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table><TableHeader><TableRow><TableHead>Orden</TableHead><TableHead>Solicitud</TableHead><TableHead>Proveedor</TableHead><TableHead>Total</TableHead><TableHead>Entrega esperada</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader><TableBody>
                {loading ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Cargando órdenes…</TableCell></TableRow> : orders.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center"><ShoppingCart className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">No hay órdenes de compra registradas.</p><p className="mt-1 text-sm text-muted-foreground">Las órdenes deben originarse en solicitudes aprobadas y proveedores habilitados.</p></TableCell></TableRow> : orders.map((order) => {
                  const canIssue = canManage && order.status === "ready_to_issue"
                  const canConfirm = canManage && ["issued", "acknowledged"].includes(order.status)
                  return <TableRow key={order.id}><TableCell className="font-mono text-xs">{order.order_number ?? "Sin número"}</TableCell><TableCell>{order.request?.request_number ? `${order.request.request_number} · ${order.request.title}` : order.request?.title ?? "Solicitud no disponible"}</TableCell><TableCell>{order.supplier?.name ?? "Proveedor no disponible"}</TableCell><TableCell>{formatMoney(Number(order.total ?? 0), order.currency)}</TableCell><TableCell>{formatDate(order.expected_delivery)}</TableCell><TableCell><Badge variant="outline">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge></TableCell><TableCell className="text-right">{canIssue ? <Button size="sm" variant="outline" disabled={processingOrderId === order.id} onClick={() => void transitionOrder(order, "issue")}><Send className="mr-2 h-3.5 w-3.5" />Emitir</Button> : canConfirm ? <Button size="sm" variant="outline" disabled={processingOrderId === order.id} onClick={() => void transitionOrder(order, "confirm")}><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Confirmar</Button> : <span className="text-xs text-muted-foreground">—</span>}</TableCell></TableRow>
                })}
              </TableBody></Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Metric({ title, value, alert = false, detail }: { title: string; value: number | string; alert?: boolean; detail?: string }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString("es-CL") : value}</div>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>
}
