"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ClipboardList, RefreshCw, Send, ShieldCheck, ShoppingCart, Store, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"
import { createBrowserClient } from "@/lib/supabase/client"

type RequestRow = { id: string; request_number: string | null; title: string; category: string; priority: string; status: string; estimated_budget_clp: number | null; required_date: string | null; created_at: string }
type PurchaseOrderRow = { id: string; order_number: string | null; status: string; currency: string; total: number; expected_delivery: string | null; created_at: string; supplier: { name: string } | null; request: { title: string; request_number: string | null } | null }
type RawPurchaseOrder = Omit<PurchaseOrderRow, "supplier" | "request"> & { suppliers: { name: string } | { name: string }[] | null; procurement_requests: { title: string; request_number: string | null } | { title: string; request_number: string | null }[] | null }
type RequestMetricRow = { estimated_budget_clp: number | string | null }
type OrderMetricRow = { currency: string; total: number | string | null }

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const COPY = {
  en: { title: "Procurement · Fundo Corcovado", description: "Internal flow from request and approval through purchase-order issue and receiving.", requests: "Requests", sourcing: "Sourcing", suppliers: "Suppliers", approvals: "Approvals", loadError: "Procurement data could not be loaded.", retry: "Retry", requestsRegistered: "Requests registered", requestedBudget: "Requested budget", requestedBudgetDetail: "Sum of recorded request budgets", ordersRegistered: "Orders registered", approvedSuppliers: "Approved suppliers", pendingSuppliers: "Pending suppliers", totalsByCurrency: "Order totals by currency", totalsDetail: "Recorded totals; they do not represent executed payments.", recentRequests: "Recent requests", recentRequestsDetail: "Requirements feeding quotation, comparison and approval.", number: "Number", request: "Request", category: "Category", budget: "Budget", requiredDate: "Required date", priority: "Priority", state: "Status", loadingRequests: "Loading requests…", noRequests: "No procurement requests registered.", firstRequest: "Create first request", pending: "Pending", noAmount: "No amount", recentOrders: "Recent purchase orders", recentOrdersDetail: "Orders ready to issue and issued orders advance through a transactional RPC before receiving.", order: "Order", supplier: "Supplier", total: "Total", expectedDelivery: "Expected delivery", action: "Action", loadingOrders: "Loading orders…", noOrders: "No purchase orders registered.", noOrdersHint: "Orders must originate from approved requests and enabled suppliers.", noNumber: "No number", requestUnavailable: "Request unavailable", supplierUnavailable: "Supplier unavailable", issue: "Issue", confirm: "Confirm", issued: "Order issued", confirmed: "Order confirmed", orderFallback: "Order", updatedAtomically: "updated its status atomically.", noDate: "No date" },
  es: { title: "Compras · Fundo Corcovado", description: "Flujo interno desde la solicitud y aprobación hasta la emisión y recepción de órdenes de compra.", requests: "Solicitudes", sourcing: "Sourcing", suppliers: "Proveedores", approvals: "Aprobaciones", loadError: "No fue posible cargar los datos de Compras.", retry: "Reintentar", requestsRegistered: "Solicitudes registradas", requestedBudget: "Presupuesto solicitado", requestedBudgetDetail: "Suma de presupuestos registrados", ordersRegistered: "Órdenes registradas", approvedSuppliers: "Proveedores aprobados", pendingSuppliers: "Proveedores pendientes", totalsByCurrency: "Monto de órdenes por moneda", totalsDetail: "Totales registrados; no equivalen a pagos ejecutados.", recentRequests: "Solicitudes recientes", recentRequestsDetail: "Requerimientos que alimentan el proceso de cotización, comparación y aprobación.", number: "Número", request: "Solicitud", category: "Categoría", budget: "Presupuesto", requiredDate: "Fecha requerida", priority: "Prioridad", state: "Estado", loadingRequests: "Cargando solicitudes…", noRequests: "No hay solicitudes registradas.", firstRequest: "Crear primera solicitud", pending: "Pendiente", noAmount: "Sin monto", recentOrders: "Órdenes de compra recientes", recentOrdersDetail: "Las órdenes listas para emitir y las emitidas avanzan por un RPC transaccional antes de quedar disponibles para recepción.", order: "Orden", supplier: "Proveedor", total: "Total", expectedDelivery: "Entrega esperada", action: "Acción", loadingOrders: "Cargando órdenes…", noOrders: "No hay órdenes de compra registradas.", noOrdersHint: "Las órdenes deben originarse en solicitudes aprobadas y proveedores habilitados.", noNumber: "Sin número", requestUnavailable: "Solicitud no disponible", supplierUnavailable: "Proveedor no disponible", issue: "Emitir", confirm: "Confirmar", issued: "Orden emitida", confirmed: "Orden confirmada", orderFallback: "Orden", updatedAtomically: "actualizó su estado de forma atómica.", noDate: "Sin fecha" },
  de: { title: "Beschaffung · Fundo Corcovado", description: "Interner Ablauf von Bedarf und Freigabe bis zur Ausstellung und Annahme von Bestellungen.", requests: "Anforderungen", sourcing: "Sourcing", suppliers: "Lieferanten", approvals: "Freigaben", loadError: "Beschaffungsdaten konnten nicht geladen werden.", retry: "Erneut versuchen", requestsRegistered: "Erfasste Anforderungen", requestedBudget: "Angefragtes Budget", requestedBudgetDetail: "Summe der erfassten Anforderungsbudgets", ordersRegistered: "Erfasste Bestellungen", approvedSuppliers: "Freigegebene Lieferanten", pendingSuppliers: "Ausstehende Lieferanten", totalsByCurrency: "Bestellsummen nach Währung", totalsDetail: "Erfasste Summen; sie entsprechen nicht ausgeführten Zahlungen.", recentRequests: "Aktuelle Anforderungen", recentRequestsDetail: "Anforderungen für Angebot, Vergleich und Freigabe.", number: "Nummer", request: "Anforderung", category: "Kategorie", budget: "Budget", requiredDate: "Bedarfsdatum", priority: "Priorität", state: "Status", loadingRequests: "Anforderungen werden geladen…", noRequests: "Keine Beschaffungsanforderungen vorhanden.", firstRequest: "Erste Anforderung erstellen", pending: "Ausstehend", noAmount: "Kein Betrag", recentOrders: "Aktuelle Bestellungen", recentOrdersDetail: "Ausgabebereite und ausgestellte Bestellungen durchlaufen vor der Annahme einen transaktionalen RPC.", order: "Bestellung", supplier: "Lieferant", total: "Summe", expectedDelivery: "Erwartete Lieferung", action: "Aktion", loadingOrders: "Bestellungen werden geladen…", noOrders: "Keine Bestellungen vorhanden.", noOrdersHint: "Bestellungen müssen aus freigegebenen Anforderungen und zugelassenen Lieferanten hervorgehen.", noNumber: "Keine Nummer", requestUnavailable: "Anforderung nicht verfügbar", supplierUnavailable: "Lieferant nicht verfügbar", issue: "Ausstellen", confirm: "Bestätigen", issued: "Bestellung ausgestellt", confirmed: "Bestellung bestätigt", orderFallback: "Bestellung", updatedAtomically: "hat den Status atomar aktualisiert.", noDate: "Kein Datum" },
} as const

const STATUS = {
  en: { draft: "Draft", submitted: "Submitted", under_review: "Under review", approved: "Approved", approved_for_quotation: "Quoting", final_approved: "Final approval", rejected: "Rejected", converted: "Converted", ready_to_issue: "Ready to issue", issued: "Issued", acknowledged: "Acknowledged", confirmed: "Confirmed", partially_received: "Partially received", received: "Received", cancelled: "Cancelled" },
  es: { draft: "Borrador", submitted: "Enviada", under_review: "En revisión", approved: "Aprobada", approved_for_quotation: "En cotización", final_approved: "Aprobación final", rejected: "Rechazada", converted: "Convertida", ready_to_issue: "Lista para emitir", issued: "Emitida", acknowledged: "Acusada", confirmed: "Confirmada", partially_received: "Recepción parcial", received: "Recibida", cancelled: "Cancelada" },
  de: { draft: "Entwurf", submitted: "Eingereicht", under_review: "In Prüfung", approved: "Freigegeben", approved_for_quotation: "In Angebotseinholung", final_approved: "Endfreigabe", rejected: "Abgelehnt", converted: "Umgewandelt", ready_to_issue: "Ausgabebereit", issued: "Ausgestellt", acknowledged: "Bestätigt erhalten", confirmed: "Bestätigt", partially_received: "Teilweise angenommen", received: "Angenommen", cancelled: "Storniert" },
} as const
const PRIORITY = { en: { low: "Low", normal: "Normal", medium: "Medium", high: "High", critical: "Critical", urgent: "Urgent" }, es: { low: "Baja", normal: "Normal", medium: "Media", high: "Alta", critical: "Crítica", urgent: "Urgente" }, de: { low: "Niedrig", normal: "Normal", medium: "Mittel", high: "Hoch", critical: "Kritisch", urgent: "Dringend" } } as const

function firstRelation<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }

export default function ProcurementPage() {
  const { language } = useLanguage()
  const lang = (language in COPY ? language : "en") as keyof typeof COPY
  const copy = COPY[lang]
  const locale = LOCALES[lang]
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { loading: accessLoading, can, canAccessDepartment } = useEffectiveAccess()
  const canManage = !accessLoading && can("procurement.manage") && canAccessDepartment("procurement")
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([])
  const [requestCount, setRequestCount] = useState(0)
  const [requestedBudget, setRequestedBudget] = useState(0)
  const [orderCount, setOrderCount] = useState(0)
  const [orderTotals, setOrderTotals] = useState<Record<string, number>>({})
  const [approvedSuppliers, setApprovedSuppliers] = useState(0)
  const [pendingSuppliers, setPendingSuppliers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  const money = useMemo(() => (value: number, currency = "CLP") => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currency === "CLP" ? 0 : 2 }).format(value), [locale])
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const date = useMemo(() => (value: string | null) => value ? new Intl.DateTimeFormat(locale, { timeZone: "America/Santiago" }).format(new Date(`${value}T12:00:00`)) : copy.noDate, [copy.noDate, locale])
  const href = (path: string) => `/${lang}${path}`

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError(false)
    const [requestsResult, requestMetricsResult, ordersResult, orderMetricsResult, approvedResult, pendingResult] = await Promise.all([
      supabase.from("procurement_requests").select("id, request_number, title, category, priority, status, estimated_budget_clp, required_date, created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("procurement_requests").select("estimated_budget_clp"),
      supabase.from("procurement_purchase_orders").select("id, order_number, status, currency, total, expected_delivery, created_at, suppliers(name), procurement_requests(title, request_number)").order("created_at", { ascending: false }).limit(8),
      supabase.from("procurement_purchase_orders").select("currency,total"),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("is_active", true).eq("approval_status", "approved"),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
    ])
    const error = requestsResult.error || requestMetricsResult.error || ordersResult.error || orderMetricsResult.error || approvedResult.error || pendingResult.error
    if (error) {
      console.error("procurement load failed", error)
      setLoadError(true); setRequests([]); setOrders([]); setRequestCount(0); setRequestedBudget(0); setOrderCount(0); setOrderTotals({}); setApprovedSuppliers(0); setPendingSuppliers(0)
    } else {
      const requestMetrics = (requestMetricsResult.data ?? []) as RequestMetricRow[]
      const orderMetrics = (orderMetricsResult.data ?? []) as OrderMetricRow[]
      setRequests((requestsResult.data ?? []) as RequestRow[])
      setOrders(((ordersResult.data ?? []) as unknown as RawPurchaseOrder[]).map((order) => ({ ...order, total: Number(order.total ?? 0), supplier: firstRelation(order.suppliers), request: firstRelation(order.procurement_requests) })))
      setRequestCount(requestMetrics.length)
      setRequestedBudget(requestMetrics.reduce((sum, request) => sum + Number(request.estimated_budget_clp ?? 0), 0))
      setOrderCount(orderMetrics.length)
      setOrderTotals(orderMetrics.reduce<Record<string, number>>((totals, order) => { totals[order.currency] = (totals[order.currency] ?? 0) + Number(order.total ?? 0); return totals }, {}))
      setApprovedSuppliers(approvedResult.count ?? 0); setPendingSuppliers(pendingResult.count ?? 0)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadData() }, [loadData])

  async function transitionOrder(order: PurchaseOrderRow, action: "issue" | "confirm") {
    if (!canManage || processingOrderId) return
    setProcessingOrderId(order.id); setLoadError(false)
    const { error } = await supabase.rpc("transition_procurement_purchase_order", { p_order_id: order.id, p_action: action, p_notes: action === "issue" ? "Emisión registrada desde Compras." : "Confirmación registrada desde Compras." })
    setProcessingOrderId(null)
    if (error) { console.error("procurement order transition failed", error); setLoadError(true); return }
    toast({ title: action === "issue" ? copy.issued : copy.confirmed, description: `${order.order_number ?? copy.orderFallback} ${copy.updatedAtomically}` })
    await loadData()
  }

  const statusLabel = (value: string) => STATUS[lang][value as keyof (typeof STATUS)[typeof lang]] ?? value
  const priorityLabel = (value: string) => PRIORITY[lang][value as keyof (typeof PRIORITY)[typeof lang]] ?? value

  return <AppLayout>
    <PageHeader title={copy.title} description={copy.description} actions={<div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild><Link href={href("/procurement/requests")}><ClipboardList className="mr-2 h-4 w-4" />{copy.requests}</Link></Button>
      <Button variant="outline" asChild><Link href={href("/procurement/sourcing")}><Store className="mr-2 h-4 w-4" />{copy.sourcing}</Link></Button>
      <Button variant="outline" asChild><Link href={href("/suppliers")}><Users className="mr-2 h-4 w-4" />{copy.suppliers}</Link></Button>
      <Button variant="outline" asChild><Link href={href("/procurement/approvals")}><ShieldCheck className="mr-2 h-4 w-4" />{copy.approvals}</Link></Button>
    </div>} />
    <div className="space-y-6 p-4 sm:p-8">
      {loadError && <Card className="border-destructive/60"><CardContent className="flex items-center justify-between gap-4 p-5"><p className="text-sm text-destructive">{copy.loadError}</p><Button variant="outline" size="sm" onClick={() => void loadData()}><RefreshCw className="mr-2 h-4 w-4" />{copy.retry}</Button></CardContent></Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title={copy.requestsRegistered} value={number.format(requestCount)} />
        <Metric title={copy.requestedBudget} value={money(requestedBudget)} detail={copy.requestedBudgetDetail} />
        <Metric title={copy.ordersRegistered} value={number.format(orderCount)} />
        <Metric title={copy.approvedSuppliers} value={number.format(approvedSuppliers)} />
        <Metric title={copy.pendingSuppliers} value={number.format(pendingSuppliers)} alert={pendingSuppliers > 0} />
      </div>
      {Object.keys(orderTotals).length > 0 && <Card><CardHeader><CardTitle className="text-base">{copy.totalsByCurrency}</CardTitle><CardDescription>{copy.totalsDetail}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3">{Object.entries(orderTotals).map(([currency, total]) => <Badge key={currency} variant="outline" className="px-3 py-2 text-sm">{money(total, currency)}</Badge>)}</CardContent></Card>}
      <Card><CardHeader><CardTitle>{copy.recentRequests}</CardTitle><CardDescription>{copy.recentRequestsDetail}</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>{copy.number}</TableHead><TableHead>{copy.request}</TableHead><TableHead>{copy.category}</TableHead><TableHead>{copy.budget}</TableHead><TableHead>{copy.requiredDate}</TableHead><TableHead>{copy.priority}</TableHead><TableHead>{copy.state}</TableHead></TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{copy.loadingRequests}</TableCell></TableRow> : requests.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center"><ClipboardList className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">{copy.noRequests}</p><Button className="mt-4" asChild><Link href={href("/procurement/requests")}>{copy.firstRequest}</Link></Button></TableCell></TableRow> : requests.map((request) => <TableRow key={request.id}><TableCell className="font-mono text-xs">{request.request_number ?? copy.pending}</TableCell><TableCell className="font-medium">{request.title}</TableCell><TableCell>{request.category}</TableCell><TableCell>{request.estimated_budget_clp === null ? copy.noAmount : money(request.estimated_budget_clp)}</TableCell><TableCell>{date(request.required_date)}</TableCell><TableCell>{priorityLabel(request.priority)}</TableCell><TableCell><Badge variant="outline">{statusLabel(request.status)}</Badge></TableCell></TableRow>)}
      </TableBody></Table></div></CardContent></Card>
      <Card><CardHeader><CardTitle>{copy.recentOrders}</CardTitle><CardDescription>{copy.recentOrdersDetail}</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>{copy.order}</TableHead><TableHead>{copy.request}</TableHead><TableHead>{copy.supplier}</TableHead><TableHead>{copy.total}</TableHead><TableHead>{copy.expectedDelivery}</TableHead><TableHead>{copy.state}</TableHead><TableHead className="text-right">{copy.action}</TableHead></TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{copy.loadingOrders}</TableCell></TableRow> : orders.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center"><ShoppingCart className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">{copy.noOrders}</p><p className="mt-1 text-sm text-muted-foreground">{copy.noOrdersHint}</p></TableCell></TableRow> : orders.map((order) => { const canIssue = canManage && order.status === "ready_to_issue"; const canConfirm = canManage && ["issued", "acknowledged"].includes(order.status); return <TableRow key={order.id}><TableCell className="font-mono text-xs">{order.order_number ?? copy.noNumber}</TableCell><TableCell>{order.request?.request_number ? `${order.request.request_number} · ${order.request.title}` : order.request?.title ?? copy.requestUnavailable}</TableCell><TableCell>{order.supplier?.name ?? copy.supplierUnavailable}</TableCell><TableCell>{money(order.total, order.currency)}</TableCell><TableCell>{date(order.expected_delivery)}</TableCell><TableCell><Badge variant="outline">{statusLabel(order.status)}</Badge></TableCell><TableCell className="text-right">{canIssue ? <Button size="sm" variant="outline" disabled={processingOrderId === order.id} onClick={() => void transitionOrder(order, "issue")}><Send className="mr-2 h-3.5 w-3.5" />{copy.issue}</Button> : canConfirm ? <Button size="sm" variant="outline" disabled={processingOrderId === order.id} onClick={() => void transitionOrder(order, "confirm")}><CheckCircle2 className="mr-2 h-3.5 w-3.5" />{copy.confirm}</Button> : <span className="text-xs text-muted-foreground">—</span>}</TableCell></TableRow> })}
      </TableBody></Table></div></CardContent></Card>
    </div>
  </AppLayout>
}

function Metric({ title, value, alert = false, detail }: { title: string; value: string; alert?: boolean; detail?: string }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value}</div>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>
}
