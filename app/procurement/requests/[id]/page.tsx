import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CheckCircle2, ClipboardList, FileCheck2, PackageCheck, ReceiptText, ShoppingCart, Truck } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

type ProcurementRequest = {
  id: string
  request_number: string | null
  title: string
  description: string | null
  business_justification: string | null
  category: string | null
  quantity: number | string | null
  unit: string | null
  estimated_budget_clp: number | string | null
  priority: string | null
  status: string | null
  required_date: string | null
  delivery_location: string | null
  location_id: string | null
  selected_supplier_id: string | null
  approved_for_quotation_at: string | null
  final_approved_at: string | null
  created_at: string
}

type QuotationRound = { id: string; round_number: number; status: string | null; response_deadline: string | null; minimum_quotes: number | null; sent_at: string | null; closed_at: string | null; created_at: string }
type QuotationRequest = { id: string; quotation_round_id: string; supplier_id: string; status: string | null; sent_at: string | null; opened_at: string | null; responded_at: string | null }
type SupplierQuote = { id: string; quotation_request_id: string; supplier_id: string; currency: string | null; total: number | string | null; lead_time_days: number | null; valid_until: string | null; stock_status: string | null; requires_human_review: boolean | null; submitted_at: string | null }
type Comparison = { id: string; quotation_round_id: string; recommended_supplier_id: string | null; approved_supplier_id: string | null; approved_at: string | null; recommendation_summary: string | null; risks: unknown }
type PurchaseOrder = { id: string; order_number: string; request_id: string; supplier_id: string; status: string | null; currency: string | null; total: number | string | null; expected_delivery: string | null; payment_terms: string | null; issued_at: string | null }
type Receipt = { id: string; purchase_order_id: string; receipt_number: string; status: string | null; received_at: string | null; delivery_document: string | null; notes: string | null }
type ReceiptItem = { id: string; receipt_id: string; request_id: string; ordered_quantity: number | string | null; received_quantity: number | string | null; rejected_quantity: number | string | null; condition: string | null; discrepancy_reason: string | null; inventory_intake_required: boolean | null }
type InventoryIntake = { id: string; receipt_item_id: string; intake_type: string | null; status: string | null; linked_asset_id: string | null; linked_stock_item_id: string | null; processed_quantity: number | string | null; reconciliation_status: string | null; processed_at: string | null }
type Replenishment = { id: string; stock_item_id: string; status: string; trigger_quantity: number | string | null; suggested_quantity: number | string | null; requested_quantity: number | string | null; purchase_order_id: string | null; fulfilled_at: string | null; last_event_at: string | null }
type Approval = { id: string; decision: string; request_amount_clp: number | string | null; approver_limit_clp: number | string | null; notes: string | null; created_at: string }
type AuditEvent = { id: string; entity_type: string; action: string; actor_type: string; metadata: unknown; created_at: string }
type Supplier = { id: string; name: string }
type Location = { id: string; name: string }

function formatMoney(value: number | string | null, currency = "CLP") {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return "—"
  return new Intl.NumberFormat("es-CL", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(value.includes("T") ? value : `${value}T12:00:00-04:00`))
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value))
}

function statusVariant(value: string | null): "default" | "secondary" | "destructive" | "outline" {
  const status = value?.toLowerCase() || ""
  if (["rejected", "cancelled", "canceled", "failed", "exception", "blocked"].includes(status)) return "destructive"
  if (["approved", "ordered", "received", "fulfilled", "completed", "closed", "processed"].includes(status)) return "secondary"
  return "outline"
}

export default async function PurchaseObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const requestResult = await supabase
    .from("procurement_requests")
    .select("id,request_number,title,description,business_justification,category,quantity,unit,estimated_budget_clp,priority,status,required_date,delivery_location,location_id,selected_supplier_id,approved_for_quotation_at,final_approved_at,created_at")
    .eq("id", id)
    .maybeSingle()

  if (requestResult.error || !requestResult.data) notFound()
  const request = requestResult.data as ProcurementRequest

  const [roundsResult, ordersResult, replenishmentResult, approvalsResult, auditResult, locationResult] = await Promise.all([
    supabase.from("procurement_quotation_rounds").select("id,round_number,status,response_deadline,minimum_quotes,sent_at,closed_at,created_at").eq("request_id", id).order("round_number", { ascending: false }).limit(5),
    supabase.from("procurement_purchase_orders").select("id,order_number,request_id,supplier_id,status,currency,total,expected_delivery,payment_terms,issued_at").eq("request_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("inventory_replenishment_needs").select("id,stock_item_id,status,trigger_quantity,suggested_quantity,requested_quantity,purchase_order_id,fulfilled_at,last_event_at").eq("procurement_request_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("procurement_approval_events").select("id,decision,request_amount_clp,approver_limit_clp,notes,created_at").eq("request_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("procurement_audit_log").select("id,entity_type,action,actor_type,metadata,created_at").eq("request_id", id).order("created_at", { ascending: false }).limit(20),
    request.location_id ? supabase.from("locations").select("id,name").eq("id", request.location_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])

  const rounds = (roundsResult.data ?? []) as QuotationRound[]
  const orders = (ordersResult.data ?? []) as PurchaseOrder[]
  const replenishment = (replenishmentResult.data ?? []) as Replenishment[]
  const approvals = (approvalsResult.data ?? []) as Approval[]
  const audit = (auditResult.data ?? []) as AuditEvent[]
  const roundIds = rounds.map((item) => item.id)
  const orderIds = orders.map((item) => item.id)

  const [quotationRequestsResult, comparisonsResult, receiptsResult] = await Promise.all([
    roundIds.length ? supabase.from("procurement_quotation_requests").select("id,quotation_round_id,supplier_id,status,sent_at,opened_at,responded_at").in("quotation_round_id", roundIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    roundIds.length ? supabase.from("procurement_comparisons").select("id,quotation_round_id,recommended_supplier_id,approved_supplier_id,approved_at,recommendation_summary,risks").in("quotation_round_id", roundIds).order("generated_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    orderIds.length ? supabase.from("procurement_receipts").select("id,purchase_order_id,receipt_number,status,received_at,delivery_document,notes").in("purchase_order_id", orderIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ])

  const quotationRequests = (quotationRequestsResult.data ?? []) as QuotationRequest[]
  const comparisons = (comparisonsResult.data ?? []) as Comparison[]
  const receipts = (receiptsResult.data ?? []) as Receipt[]
  const quotationRequestIds = quotationRequests.map((item) => item.id)
  const receiptIds = receipts.map((item) => item.id)

  const [quotesResult, receiptItemsResult] = await Promise.all([
    quotationRequestIds.length ? supabase.from("procurement_supplier_quotes").select("id,quotation_request_id,supplier_id,currency,total,lead_time_days,valid_until,stock_status,requires_human_review,submitted_at").in("quotation_request_id", quotationRequestIds).order("submitted_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    receiptIds.length ? supabase.from("procurement_receipt_items").select("id,receipt_id,request_id,ordered_quantity,received_quantity,rejected_quantity,condition,discrepancy_reason,inventory_intake_required").in("receipt_id", receiptIds).eq("request_id", id) : Promise.resolve({ data: [], error: null }),
  ])

  const quotes = (quotesResult.data ?? []) as SupplierQuote[]
  const receiptItems = (receiptItemsResult.data ?? []) as ReceiptItem[]
  const receiptItemIds = receiptItems.map((item) => item.id)
  const intakeResult = receiptItemIds.length
    ? await supabase.from("procurement_inventory_intake").select("id,receipt_item_id,intake_type,status,linked_asset_id,linked_stock_item_id,processed_quantity,reconciliation_status,processed_at").in("receipt_item_id", receiptItemIds).order("created_at", { ascending: false })
    : { data: [], error: null }
  const intakes = (intakeResult.data ?? []) as InventoryIntake[]

  const supplierIds = Array.from(new Set([
    request.selected_supplier_id,
    ...orders.map((item) => item.supplier_id),
    ...quotationRequests.map((item) => item.supplier_id),
    ...quotes.map((item) => item.supplier_id),
    ...comparisons.flatMap((item) => [item.recommended_supplier_id, item.approved_supplier_id]),
  ].filter((value): value is string => Boolean(value))))
  const suppliersResult = supplierIds.length
    ? await supabase.from("suppliers").select("id,name").in("id", supplierIds)
    : { data: [], error: null }
  const supplierMap = new Map(((suppliersResult.data ?? []) as Supplier[]).map((supplier) => [supplier.id, supplier.name]))
  const location = locationResult.data as Location | null

  const queryError = roundsResult.error || ordersResult.error || replenishmentResult.error || approvalsResult.error || auditResult.error || locationResult.error || quotationRequestsResult.error || comparisonsResult.error || receiptsResult.error || quotesResult.error || receiptItemsResult.error || intakeResult.error || suppliersResult.error
  const currentOrder = orders[0] ?? null
  const latestRound = rounds[0] ?? null
  const receivedQuantity = receiptItems.reduce((sum, item) => sum + Number(item.received_quantity ?? 0), 0)
  const stockReady = replenishment.some((item) => item.status === "fulfilled") || intakes.some((item) => ["processed", "completed"].includes(item.status?.toLowerCase() ?? ""))
  const flow = [
    { label: "Comprar", detail: request.request_number ?? "Requerimiento", complete: true },
    { label: "Cotizar", detail: latestRound?.status ?? (request.approved_for_quotation_at ? "habilitado" : "pendiente"), complete: Boolean(latestRound || request.approved_for_quotation_at) },
    { label: "Aprobar", detail: request.final_approved_at ? "aprobado" : approvals[0]?.decision ?? "pendiente", complete: Boolean(request.final_approved_at || approvals.some((item) => item.decision === "approved")) },
    { label: "En camino", detail: currentOrder?.order_number ?? "sin orden", complete: Boolean(currentOrder) },
    { label: "Recibir", detail: receipts[0]?.status ?? "pendiente", complete: receipts.length > 0 },
    { label: "Stock listo", detail: stockReady ? "listo" : "pendiente", complete: stockReady },
  ]

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/procurement/requests" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Solicitudes</Link>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center border border-primary/25 bg-primary/10 text-primary"><ShoppingCart className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Objeto · Compra</p>
                <h1 className="text-2xl font-semibold">{request.title}</h1>
              </div>
              <Badge variant={statusVariant(request.status)}>{request.status ?? "sin estado"}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span>{request.request_number ?? "Número pendiente"}</span>
              <span>{request.quantity ?? "—"} {request.unit ?? "unidad"}</span>
              <span>{location?.name ?? request.delivery_location ?? "Ubicación sin registrar"}</span>
            </div>
          </div>
          {currentOrder && <Badge variant="outline" className="w-fit">Orden {currentOrder.order_number}</Badge>}
        </div>

        {queryError && <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">Parte del contexto relacionado no pudo cargarse. La compra sigue mostrando únicamente la información permitida por RLS.</div>}

        <section className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {flow.map((step, index) => <div key={step.label} className={step.complete ? "rounded-lg border border-primary/30 bg-primary/5 p-3" : "rounded-lg border p-3"}><div className="flex items-center gap-2"><span className={step.complete ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : "flex h-6 w-6 items-center justify-center rounded-full border text-xs text-muted-foreground"}>{step.complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}</span><p className="text-sm font-medium">{step.label}</p></div><p className="mt-2 truncate text-xs text-muted-foreground">{step.detail}</p></div>)}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StateCard label="Presupuesto" value={formatMoney(request.estimated_budget_clp)} />
          <StateCard label="Proveedor" value={request.selected_supplier_id ? supplierMap.get(request.selected_supplier_id) ?? "Seleccionado" : "Sin seleccionar"} />
          <StateCard label="Orden" value={currentOrder ? formatMoney(currentOrder.total, currentOrder.currency ?? "CLP") : "Sin orden"} />
          <StateCard label="Recibido" value={`${receivedQuantity} ${request.unit ?? "unidad"}`} />
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" />Requerimiento</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="font-medium">{request.title}</p>{request.description && <p className="text-muted-foreground">{request.description}</p>}{request.business_justification && <p><span className="text-muted-foreground">Justificación:</span> {request.business_justification}</p>}<p><span className="text-muted-foreground">Categoría:</span> {request.category ?? "—"}</p><p><span className="text-muted-foreground">Prioridad:</span> {request.priority ?? "—"}</p><p><span className="text-muted-foreground">Fecha requerida:</span> {formatDate(request.required_date)}</p></CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-4 w-4" />Aprobaciones</CardTitle></CardHeader><CardContent className="space-y-2">{approvals.length === 0 ? <Empty text="No hay decisiones de aprobación visibles." /> : approvals.map((item) => <CompactRow key={item.id} title={item.decision} detail={`${formatMoney(item.request_amount_clp)} · ${formatDateTime(item.created_at)}`} status={item.notes} />)}</CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4" />Cotizaciones</CardTitle></CardHeader><CardContent className="space-y-2">{quotes.length === 0 ? <Empty text="No hay cotizaciones recibidas visibles." /> : quotes.map((quote) => <CompactRow key={quote.id} title={supplierMap.get(quote.supplier_id) ?? "Proveedor"} detail={`${formatMoney(quote.total, quote.currency ?? "CLP")}${quote.lead_time_days != null ? ` · ${quote.lead_time_days} días` : ""}`} status={quote.requires_human_review ? "requiere revisión" : quote.stock_status} />)}</CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="h-4 w-4" />Órdenes de compra</CardTitle></CardHeader><CardContent className="space-y-2">{orders.length === 0 ? <Empty text="Todavía no existe una orden de compra." /> : orders.map((order) => <CompactRow key={order.id} title={order.order_number} detail={`${supplierMap.get(order.supplier_id) ?? "Proveedor"} · ${formatMoney(order.total, order.currency ?? "CLP")}`} status={order.status} />)}</CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" />Recepción</CardTitle></CardHeader><CardContent className="space-y-2">{receipts.length === 0 ? <Empty text="No hay recepciones registradas." /> : receipts.map((receipt) => <CompactRow key={receipt.id} title={receipt.receipt_number} detail={formatDateTime(receipt.received_at)} status={receipt.status} />)}</CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><PackageCheck className="h-4 w-4" />Ingreso a inventario</CardTitle></CardHeader><CardContent className="space-y-2">{intakes.length === 0 ? <Empty text="Aún no hay ingreso de inventario asociado." /> : intakes.map((intake) => <CompactRow key={intake.id} title={intake.intake_type ?? "Ingreso"} detail={`${intake.processed_quantity ?? "—"} procesado · ${formatDateTime(intake.processed_at)}`} status={intake.reconciliation_status ?? intake.status} />)}</CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle className="text-base">Actividad de la compra</CardTitle></CardHeader><CardContent className="space-y-2">{audit.length === 0 ? <Empty text="No hay actividad auditable visible para esta compra." /> : audit.map((event) => <div key={event.id} className="rounded-md border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{event.action}</p><time className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</time></div><p className="mt-1 text-xs text-muted-foreground">{event.entity_type} · {event.actor_type}</p></div>)}</CardContent></Card>
      </div>
    </AppLayout>
  )
}

function StateCard({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></Card>
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{text}</p>
}

function CompactRow({ title, detail, status }: { title: string; detail: string; status: string | null }) {
  return <div className="rounded-md border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{title}</p>{status && <Badge variant={statusVariant(status)}>{status}</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
}
