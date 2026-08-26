"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, ClipboardCheck, RefreshCw, Send, ShieldCheck, Store, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { createBrowserClient } from "@/lib/supabase/client"

type RequestRow = {
  id: string
  request_number: string | null
  title: string
  quantity: number
  unit: string
  status: string
  required_date: string | null
  delivery_location: string | null
}

type Supplier = { id: string; name: string; email: string | null; rating: number }
type Round = { id: string; request_id: string; round_number: number; status: string; response_deadline: string | null; minimum_quotes: number; created_at: string }
type QuotationRequest = { id: string; quotation_round_id: string; supplier_id: string; status: string; channel: string; sent_to: string | null; supplier: Supplier | null }
type Quote = { id: string; quotation_request_id: string; supplier_id: string; currency: string; total: number; lead_time_days: number | null; valid_until: string | null; payment_terms: string | null; notes: string | null }
type Comparison = { id: string; quotation_round_id: string; recommended_supplier_id: string | null; supplier_scores: Record<string, { score?: number; total?: number; lead_time_days?: number | null; rating?: number | null }>; recommendation_summary: string | null; confidence: number | null; approved_supplier_id: string | null }
type RawQuotationRequest = Omit<QuotationRequest, "supplier"> & { suppliers: Supplier | Supplier[] | null }

type QuoteDraft = { total: string; currency: string; leadTime: string; validUntil: string; paymentTerms: string; notes: string }

const ACTIVE_ROUND_STATES = ["draft", "ready", "sent", "collecting", "comparison_ready", "pending_final_approval"]
const ROUND_LABELS: Record<string, string> = {
  draft: "Borrador",
  ready: "Preparada",
  sent: "Enviada",
  collecting: "Recibiendo cotizaciones",
  comparison_ready: "Lista para comparar",
  pending_final_approval: "Comparación por aprobar",
  approved: "Aprobada",
  rejected: "Rechazada",
  closed: "Cerrada",
  cancelled: "Cancelada",
}
const QUOTATION_LABELS: Record<string, string> = { draft: "Manual", queued: "En cola", sent: "Enviada", opened: "Abierta", responded: "Respondida", declined: "Declinada", expired: "Vencida", failed: "Fallida" }

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: number, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency, maximumFractionDigits: currency === "CLP" ? 0 : 2 }).format(value)
}

function emptyDraft(quote?: Quote | null): QuoteDraft {
  return {
    total: quote ? String(quote.total) : "",
    currency: quote?.currency ?? "CLP",
    leadTime: quote?.lead_time_days == null ? "" : String(quote.lead_time_days),
    validUntil: quote?.valid_until ?? "",
    paymentTerms: quote?.payment_terms ?? "",
    notes: quote?.notes ?? "",
  }
}

export default function ProcurementSourcingPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { access, loading: accessLoading, can, canAccessDepartment } = useEffectiveAccess()
  const canManage = can("procurement.manage") && canAccessDepartment("procurement")
  const canApprove = canManage && (access.is_admin || access.role === "approver")

  const [requests, setRequests] = useState<RequestRow[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [quotationRequests, setQuotationRequests] = useState<QuotationRequest[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [selectedRequestId, setSelectedRequestId] = useState("")
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([])
  const [deadline, setDeadline] = useState(() => {
    const date = new Date(); date.setDate(date.getDate() + 3); return date.toISOString().slice(0, 16)
  })
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, QuoteDraft>>({})
  const [approvalSupplierId, setApprovalSupplierId] = useState("")
  const [approvalNotes, setApprovalNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (accessLoading) return
    if (!canManage) { setLoading(false); return }
    setLoading(true)
    setError(null)

    const [requestResult, supplierResult, roundResult, qrResult, quoteResult, comparisonResult] = await Promise.all([
      supabase.from("procurement_requests").select("id,request_number,title,quantity,unit,status,required_date,delivery_location").in("status", ["approved", "approved_for_quotation", "final_approved"]).order("created_at", { ascending: false }).limit(100),
      supabase.from("suppliers").select("id,name,email,rating").eq("is_active", true).eq("approval_status", "approved").order("name"),
      supabase.from("procurement_quotation_rounds").select("id,request_id,round_number,status,response_deadline,minimum_quotes,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("procurement_quotation_requests").select("id,quotation_round_id,supplier_id,status,channel,sent_to,suppliers(id,name,email,rating)").order("created_at"),
      supabase.from("procurement_supplier_quotes").select("id,quotation_request_id,supplier_id,currency,total,lead_time_days,valid_until,payment_terms,notes").order("submitted_at", { ascending: false }),
      supabase.from("procurement_comparisons").select("id,quotation_round_id,recommended_supplier_id,supplier_scores,recommendation_summary,confidence,approved_supplier_id").order("generated_at", { ascending: false }),
    ])

    const results = [requestResult, supplierResult, roundResult, qrResult, quoteResult, comparisonResult]
    const firstError = results.find((result) => result.error)?.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const nextRequests = (requestResult.data ?? []).map((row) => ({ ...row, quantity: numberValue(row.quantity) })) as RequestRow[]
    const nextSuppliers = (supplierResult.data ?? []).map((row) => ({ ...row, rating: numberValue(row.rating) })) as Supplier[]
    const nextRounds = (roundResult.data ?? []).map((row) => ({ ...row, minimum_quotes: Number(row.minimum_quotes) })) as Round[]
    const nextQuotationRequests = ((qrResult.data ?? []) as unknown as RawQuotationRequest[]).map((row) => ({ ...row, supplier: firstRelation(row.suppliers) }))
    const nextQuotes = (quoteResult.data ?? []).map((row) => ({ ...row, total: numberValue(row.total), lead_time_days: row.lead_time_days == null ? null : Number(row.lead_time_days) })) as Quote[]
    const nextComparisons = (comparisonResult.data ?? []).map((row) => ({ ...row, supplier_scores: (row.supplier_scores && typeof row.supplier_scores === "object" ? row.supplier_scores : {}) as Comparison["supplier_scores"], confidence: row.confidence == null ? null : numberValue(row.confidence) })) as Comparison[]

    setRequests(nextRequests)
    setSuppliers(nextSuppliers)
    setRounds(nextRounds)
    setQuotationRequests(nextQuotationRequests)
    setQuotes(nextQuotes)
    setComparisons(nextComparisons)
    setSelectedRequestId((current) => current && nextRequests.some((row) => row.id === current) ? current : nextRequests[0]?.id ?? "")
    setQuoteDrafts(Object.fromEntries(nextQuotationRequests.map((qr) => [qr.id, emptyDraft(nextQuotes.find((quote) => quote.quotation_request_id === qr.id) ?? null)])))
    setLoading(false)
  }, [accessLoading, canManage, supabase])

  useEffect(() => { void load() }, [load])

  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null
  const selectedRound = rounds.find((round) => round.request_id === selectedRequestId && ACTIVE_ROUND_STATES.includes(round.status)) ?? rounds.find((round) => round.request_id === selectedRequestId) ?? null
  const selectedQuotationRequests = selectedRound ? quotationRequests.filter((item) => item.quotation_round_id === selectedRound.id) : []
  const selectedQuotes = selectedQuotationRequests.flatMap((item) => quotes.filter((quote) => quote.quotation_request_id === item.id))
  const selectedComparison = selectedRound ? comparisons.find((comparison) => comparison.quotation_round_id === selectedRound.id) ?? null : null
  const supplierMap = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers])

  useEffect(() => {
    if (!selectedComparison) { setApprovalSupplierId(""); return }
    setApprovalSupplierId(selectedComparison.approved_supplier_id ?? selectedComparison.recommended_supplier_id ?? selectedQuotes[0]?.supplier_id ?? "")
  }, [selectedComparison, selectedQuotes])

  function toggleSupplier(id: string) {
    setSelectedSupplierIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  async function startRound() {
    if (!selectedRequest || selectedSupplierIds.length < 2 || saving) return
    setSaving(true); setError(null)
    const responseDeadline = deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 3 * 86400000).toISOString()
    const { error: rpcError } = await supabase.rpc("start_procurement_quotation", { p_request_id: selectedRequest.id, p_supplier_ids: selectedSupplierIds, p_response_deadline: responseDeadline })
    setSaving(false)
    if (rpcError) return setError(rpcError.message)
    toast({ title: "Ronda de cotización abierta", description: "Los proveedores con correo quedaron en la cola de RFQ; los demás pueden registrarse manualmente." })
    setSelectedSupplierIds([])
    await load()
  }

  async function saveQuote(qr: QuotationRequest) {
    const draft = quoteDrafts[qr.id] ?? emptyDraft()
    const total = Number(draft.total)
    const lead = draft.leadTime ? Number(draft.leadTime) : null
    if (!Number.isFinite(total) || total <= 0) return setError("El total cotizado debe ser mayor que cero.")
    if (lead != null && (!Number.isFinite(lead) || lead < 0)) return setError("El plazo de entrega no puede ser negativo.")

    setSaving(true); setError(null)
    const { error: rpcError } = await supabase.rpc("submit_procurement_supplier_quote", {
      p_quotation_request_id: qr.id,
      p_total: total,
      p_subtotal: null,
      p_tax: null,
      p_shipping: null,
      p_currency: draft.currency.trim().toUpperCase() || "CLP",
      p_lead_time_days: lead,
      p_valid_until: draft.validUntil || null,
      p_payment_terms: draft.paymentTerms.trim() || null,
      p_warranty: null,
      p_stock_status: null,
      p_notes: draft.notes.trim() || null,
    })
    setSaving(false)
    if (rpcError) return setError(rpcError.message)
    toast({ title: "Cotización registrada", description: `${qr.supplier?.name ?? "Proveedor"} quedó incorporado a la ronda.` })
    await load()
  }

  async function buildComparison() {
    if (!selectedRound || saving) return
    setSaving(true); setError(null)
    const { error: rpcError } = await supabase.rpc("build_procurement_comparison", { p_round_id: selectedRound.id })
    setSaving(false)
    if (rpcError) return setError(rpcError.message)
    toast({ title: "Comparación generada", description: "La recomendación usa precio, plazo y evaluación histórica registrada." })
    await load()
  }

  async function approveComparison() {
    if (!selectedComparison || !approvalSupplierId || !canApprove || saving) return
    setSaving(true); setError(null)
    const { data, error: rpcError } = await supabase.rpc("approve_procurement_comparison", { p_comparison_id: selectedComparison.id, p_supplier_id: approvalSupplierId, p_notes: approvalNotes.trim() || null })
    setSaving(false)
    if (rpcError) return setError(rpcError.message)
    toast({ title: "Proveedor aprobado", description: `Se creó o recuperó la orden de compra ${String(data).slice(0, 8)}… lista para emitir.` })
    setApprovalNotes("")
    await load()
  }

  if (accessLoading) return <AppLayout><div className="p-8 text-sm text-muted-foreground">Verificando acceso a Compras…</div></AppLayout>
  if (!canManage) return <AppLayout><PageHeader title="Sourcing y cotizaciones" description="RFQ, ofertas, comparación y selección de proveedor." /><div className="p-8"><Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Tu perfil no tiene permiso para operar Compras.</CardContent></Card></div></AppLayout>

  return <AppLayout>
    <PageHeader title="Sourcing y cotizaciones" description="Ronda de RFQ, captura de ofertas, comparación determinística y aprobación final con trazabilidad." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button><Button variant="outline" asChild><Link href="/procurement"><ArrowLeft className="mr-2 h-4 w-4" />Compras</Link></Button></div>} />
    <div className="space-y-6 p-4 sm:p-8">
      {error && <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      {suppliers.length < 2 && <Card className="border-amber-300"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Proveedores insuficientes</CardTitle><CardDescription>Se requieren al menos dos proveedores reales, activos y aprobados para abrir una ronda competitiva.</CardDescription></CardHeader><CardContent><Button variant="outline" asChild><Link href="/suppliers">Gestionar proveedores</Link></Button></CardContent></Card>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Solicitudes elegibles" value={requests.filter((item) => ["approved", "approved_for_quotation"].includes(item.status)).length} /><Metric label="Proveedores aprobados" value={suppliers.length} alert={suppliers.length < 2} /><Metric label="Rondas activas" value={rounds.filter((item) => ACTIVE_ROUND_STATES.includes(item.status)).length} /><Metric label="Cotizaciones registradas" value={quotes.length} /></div>

      {requests.length === 0 ? <Card><CardContent className="p-10 text-center"><Store className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-medium">No hay solicitudes aprobadas para sourcing.</p><p className="mt-1 text-sm text-muted-foreground">Una solicitud debe pasar primero por Aprobaciones.</p><Button className="mt-4" variant="outline" asChild><Link href="/procurement/approvals">Ir a Aprobaciones</Link></Button></CardContent></Card> : <>
        <Card><CardHeader><CardTitle className="text-base">Solicitud de compra</CardTitle><CardDescription>Selecciona el requerimiento cuya ronda quieres operar.</CardDescription></CardHeader><CardContent><select value={selectedRequestId} onChange={(event) => setSelectedRequestId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">{requests.map((request) => <option key={request.id} value={request.id}>{request.request_number ?? "Solicitud"} · {request.title} · {request.status}</option>)}</select>{selectedRequest && <div className="mt-3 grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-3"><span>Cantidad: <strong>{selectedRequest.quantity} {selectedRequest.unit}</strong></span><span>Entrega: <strong>{selectedRequest.delivery_location ?? "Sin ubicación"}</strong></span><span>Requerida: <strong>{selectedRequest.required_date ?? "Sin fecha"}</strong></span></div>}</CardContent></Card>

        {!selectedRound && selectedRequest?.status === "approved" ? <Card><CardHeader><CardTitle className="text-base">Abrir ronda competitiva</CardTitle><CardDescription>Selecciona al menos dos proveedores aprobados. La operación es idempotente: una solicitud no puede tener dos rondas activas.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{suppliers.map((supplier) => <label key={supplier.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${selectedSupplierIds.includes(supplier.id) ? "border-primary bg-muted/30" : ""}`}><input type="checkbox" checked={selectedSupplierIds.includes(supplier.id)} onChange={() => toggleSupplier(supplier.id)} className="mt-1" /><div><p className="text-sm font-medium">{supplier.name}</p><p className="text-xs text-muted-foreground">{supplier.email ?? "Sin correo · captura manual"} · rating {supplier.rating.toFixed(1)}</p></div></label>)}</div><div className="max-w-sm"><label className="text-sm font-medium">Fecha límite de respuesta</label><Input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></div><Button onClick={() => void startRound()} disabled={saving || selectedSupplierIds.length < 2 || suppliers.length < 2}><Send className="mr-2 h-4 w-4" />Abrir RFQ</Button></CardContent></Card> : selectedRound ? <>
          <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Ronda #{selectedRound.round_number}</CardTitle><CardDescription>{selectedRound.response_deadline ? `Respuestas hasta ${new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedRound.response_deadline))}` : "Sin fecha límite"}</CardDescription></div><Badge variant="outline">{ROUND_LABELS[selectedRound.status] ?? selectedRound.status}</Badge></div></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3"><Stage icon={Send} title="RFQ" value={selectedQuotationRequests.length} detail="proveedores convocados" /><Stage icon={ClipboardCheck} title="Ofertas" value={selectedQuotes.length} detail={`mínimo ${Math.max(selectedRound.minimum_quotes, 2)}`} /><Stage icon={ShieldCheck} title="Decisión" value={selectedComparison?.approved_supplier_id ? 1 : 0} detail={selectedComparison ? "comparación disponible" : "pendiente de comparación"} /></div></CardContent></Card>

          <Card><CardHeader><CardTitle className="text-base">Cotizaciones de proveedores</CardTitle><CardDescription>Las respuestas pueden provenir de RFQ en cola o registrarse manualmente con evidencia operacional posterior. No se inventan precios ni plazos.</CardDescription></CardHeader><CardContent className="space-y-3">{selectedQuotationRequests.map((qr) => { const quote = quotes.find((item) => item.quotation_request_id === qr.id) ?? null; const draft = quoteDrafts[qr.id] ?? emptyDraft(quote); return <div key={qr.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{qr.supplier?.name ?? "Proveedor"}</p><p className="text-xs text-muted-foreground">{qr.channel === "manual" ? "Captura manual" : qr.sent_to ?? "RFQ"}</p></div><Badge variant="outline">{QUOTATION_LABELS[qr.status] ?? qr.status}</Badge></div><div className="mt-4 grid gap-3 md:grid-cols-5"><div><label className="text-xs font-medium">Total</label><Input type="number" min="1" value={draft.total} onChange={(event) => setQuoteDrafts((current) => ({ ...current, [qr.id]: { ...draft, total: event.target.value } }))} /></div><div><label className="text-xs font-medium">Moneda</label><Input maxLength={3} value={draft.currency} onChange={(event) => setQuoteDrafts((current) => ({ ...current, [qr.id]: { ...draft, currency: event.target.value.toUpperCase() } }))} /></div><div><label className="text-xs font-medium">Plazo días</label><Input type="number" min="0" value={draft.leadTime} onChange={(event) => setQuoteDrafts((current) => ({ ...current, [qr.id]: { ...draft, leadTime: event.target.value } }))} /></div><div><label className="text-xs font-medium">Válida hasta</label><Input type="date" value={draft.validUntil} onChange={(event) => setQuoteDrafts((current) => ({ ...current, [qr.id]: { ...draft, validUntil: event.target.value } }))} /></div><div><label className="text-xs font-medium">Pago</label><Input value={draft.paymentTerms} onChange={(event) => setQuoteDrafts((current) => ({ ...current, [qr.id]: { ...draft, paymentTerms: event.target.value } }))} /></div></div><div className="mt-3 flex flex-wrap items-end gap-3"><div className="min-w-64 flex-1"><label className="text-xs font-medium">Notas</label><Input value={draft.notes} onChange={(event) => setQuoteDrafts((current) => ({ ...current, [qr.id]: { ...draft, notes: event.target.value } }))} /></div><Button size="sm" variant="outline" onClick={() => void saveQuote(qr)} disabled={saving || !draft.total}>{quote ? "Actualizar cotización" : "Registrar cotización"}</Button>{quote && <span className="text-sm font-medium">{money(quote.total, quote.currency)}{quote.lead_time_days != null ? ` · ${quote.lead_time_days} días` : ""}</span>}</div></div> })}</CardContent></Card>

          {!selectedComparison ? <Card><CardHeader><CardTitle className="text-base">Comparación</CardTitle><CardDescription>Se requieren {Math.max(selectedRound.minimum_quotes, 2)} cotizaciones válidas. El score combina precio, plazo y rating histórico registrado.</CardDescription></CardHeader><CardContent><Button onClick={() => void buildComparison()} disabled={saving || selectedQuotes.length < Math.max(selectedRound.minimum_quotes, 2)}><ClipboardCheck className="mr-2 h-4 w-4" />Generar comparación</Button></CardContent></Card> : <Card><CardHeader><CardTitle className="text-base">Comparación y aprobación final</CardTitle><CardDescription>{selectedComparison.recommendation_summary ?? "Comparación generada."}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Object.entries(selectedComparison.supplier_scores).map(([supplierId, score]) => <div key={supplierId} className={`rounded-lg border p-3 ${supplierId === selectedComparison.recommended_supplier_id ? "border-primary" : ""}`}><div className="flex items-start justify-between gap-2"><p className="font-medium">{supplierMap.get(supplierId)?.name ?? supplierId.slice(0, 8)}</p>{supplierId === selectedComparison.recommended_supplier_id && <Badge>Recomendado</Badge>}</div><p className="mt-3 text-2xl font-semibold">{Number(score.score ?? 0).toFixed(2)}</p><p className="text-xs text-muted-foreground">{money(Number(score.total ?? 0))} · {score.lead_time_days ?? "?"} días · rating {score.rating ?? 0}</p></div>)}</div>{canApprove ? <div className="rounded-lg border p-4"><div className="grid gap-3 md:grid-cols-2"><div><label className="text-sm font-medium">Proveedor a aprobar</label><select value={approvalSupplierId} onChange={(event) => setApprovalSupplierId(event.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">{selectedQuotes.map((quote) => <option key={quote.supplier_id} value={quote.supplier_id}>{supplierMap.get(quote.supplier_id)?.name ?? quote.supplier_id}</option>)}</select></div><div><label className="text-sm font-medium">Nota de decisión</label><Input value={approvalNotes} onChange={(event) => setApprovalNotes(event.target.value)} placeholder="Fundamento u observación" /></div></div><Button className="mt-3" onClick={() => void approveComparison()} disabled={saving || !approvalSupplierId || Boolean(selectedComparison.approved_supplier_id)}><CheckCircle2 className="mr-2 h-4 w-4" />{selectedComparison.approved_supplier_id ? "Proveedor aprobado" : "Aprobar y crear orden"}</Button></div> : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">La comparación está lista. La aprobación final requiere rol de aprobador o administrador.</div>}</CardContent></Card>}
        </> : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">La solicitud ya cerró su ciclo de sourcing. Revisa la orden en Compras.</CardContent></Card>}
      </>}
    </div>
  </AppLayout>
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) { return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value.toLocaleString("es-CL")}</div></CardContent></Card> }
function Stage({ icon: Icon, title, value, detail }: { icon: typeof Send; title: string; value: number; detail: string }) { return <div className="rounded-lg border p-3"><div className="flex items-center justify-between"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-2xl font-semibold">{value}</span></div><p className="mt-2 text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{detail}</p></div> }
