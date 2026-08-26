"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, PackageCheck, RefreshCw, ShieldX } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useToast } from "@/hooks/use-toast"

type Order = {
  id: string
  order_number: string | null
  status: string
  expected_delivery: string | null
  total: number
  currency: string
  suppliers: { name: string } | null
  procurement_requests: { id: string; title: string; request_number: string | null; quantity: number; unit: string } | null
}

type Receipt = {
  id: string
  receipt_number: string | null
  received_at: string
  delivery_document: string | null
  evidence_url: string | null
  procurement_purchase_orders: { order_number: string | null; suppliers: { name: string } | null } | null
  procurement_receipt_items: Array<{ received_quantity: number; rejected_quantity: number; condition: string; inventory_intake_required: boolean; intake_type: string | null }>
}

const initialForm = {
  purchaseOrderId: "",
  receivedQuantity: "",
  rejectedQuantity: "0",
  condition: "accepted",
  discrepancyReason: "",
  deliveryDocument: "",
  evidenceUrl: "",
  notes: "",
  inventoryIntakeRequired: false,
  intakeType: "asset",
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default function ProcurementReceivingPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { loading: accessLoading, error: accessError, can, canAccessDepartment } = useEffectiveAccess()
  const canReceive = can("procurement.manage") && canAccessDepartment("procurement")
  const canCreateInventoryIntake = can("inventory.process") && canAccessDepartment("inventory")
  const [orders, setOrders] = useState<Order[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (accessLoading) return
    if (!canReceive) {
      setOrders([])
      setReceipts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [ordersResult, receiptsResult] = await Promise.all([
      supabase.from("procurement_purchase_orders").select("id, order_number, status, expected_delivery, total, currency, suppliers(name), procurement_requests(id, title, request_number, quantity, unit)").in("status", ["issued", "confirmed", "partially_received"]).order("created_at", { ascending: false }),
      supabase.from("procurement_receipts").select("id, receipt_number, received_at, delivery_document, evidence_url, procurement_purchase_orders(order_number, suppliers(name)), procurement_receipt_items(received_quantity, rejected_quantity, condition, inventory_intake_required, intake_type)").eq("status", "posted").order("received_at", { ascending: false }).limit(20),
    ])
    const loadError = ordersResult.error || receiptsResult.error
    if (loadError) setError(loadError.message)
    setOrders((ordersResult.data ?? []).map((order) => ({
      ...order,
      suppliers: firstRelation(order.suppliers),
      procurement_requests: firstRelation(order.procurement_requests),
    })))
    setReceipts((receiptsResult.data ?? []).map((receipt) => {
      const purchaseOrder = firstRelation(receipt.procurement_purchase_orders)
      return {
        ...receipt,
        procurement_purchase_orders: purchaseOrder
          ? { ...purchaseOrder, suppliers: firstRelation(purchaseOrder.suppliers) }
          : null,
        procurement_receipt_items: receipt.procurement_receipt_items ?? [],
      }
    }))
    setLoading(false)
  }, [accessLoading, canReceive, supabase])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => {
    if (!canCreateInventoryIntake && form.inventoryIntakeRequired) {
      setForm((current) => ({ ...current, inventoryIntakeRequired: false }))
    }
  }, [canCreateInventoryIntake, form.inventoryIntakeRequired])

  const selectedOrder = orders.find((order) => order.id === form.purchaseOrderId)

  async function submitReceipt(event: React.FormEvent) {
    event.preventDefault()
    if (!canReceive) return setError("Tu perfil no tiene permiso para registrar recepciones de compras.")
    if (form.inventoryIntakeRequired && !canCreateInventoryIntake) return setError("Tu perfil no tiene permiso para generar ingresos a Inventario.")
    if (!form.purchaseOrderId) return setError("Selecciona una orden de compra.")
    const received = Number(form.receivedQuantity)
    const rejected = Number(form.rejectedQuantity || 0)
    if (!Number.isFinite(received) || !Number.isFinite(rejected) || received < 0 || rejected < 0 || received + rejected <= 0) return setError("Registra una cantidad válida.")
    if ((rejected > 0 || form.condition !== "accepted") && !form.discrepancyReason.trim()) return setError("Las diferencias o rechazos requieren un motivo.")

    setSubmitting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc("post_procurement_receipt", {
      p_purchase_order_id: form.purchaseOrderId,
      p_received_quantity: received,
      p_rejected_quantity: rejected,
      p_condition: form.condition,
      p_discrepancy_reason: form.discrepancyReason.trim() || null,
      p_delivery_document: form.deliveryDocument.trim() || null,
      p_evidence_url: form.evidenceUrl.trim() || null,
      p_notes: form.notes.trim() || null,
      p_inventory_intake_required: form.inventoryIntakeRequired,
      p_intake_type: form.inventoryIntakeRequired ? form.intakeType : null,
    })
    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }
    toast({ title: "Recepción registrada", description: form.inventoryIntakeRequired ? "La orden y la cola de Inventario fueron actualizadas." : "La orden de compra fue actualizada." })
    setForm(initialForm)
    setSubmitting(false)
    await loadData()
  }

  if (accessLoading) {
    return <AppLayout><div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">Validando acceso…</div></AppLayout>
  }

  if (accessError || !canReceive) {
    return (
      <AppLayout>
        <PageHeader title="Recepción de compras" description="Control de entregas y diferencias de órdenes de compra." />
        <div className="p-4 sm:p-8">
          <Card className="mx-auto max-w-xl"><CardContent className="p-8 text-center"><ShieldX className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">Acceso restringido</h2><p className="mt-2 text-sm text-muted-foreground">Tu perfil no tiene permiso de Compras para registrar recepciones.</p></CardContent></Card>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader title="Recepción de compras" description="Control de entregas parciales o totales, diferencias y traspaso a Inventario." actions={<Button variant="outline" asChild><Link href="/procurement"><ArrowLeft className="mr-2 h-4 w-4" />Volver a Compras</Link></Button>} />
      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/50"><CardContent className="flex items-center justify-between gap-4 p-4"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void loadData()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></CardContent></Card>}

        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Órdenes recepcionables" value={orders.length} />
          <Metric label="Recepciones registradas" value={receipts.length} />
          <Metric label="Ingresos enviados a Inventario" value={receipts.reduce((sum, receipt) => sum + receipt.procurement_receipt_items.filter((item) => item.inventory_intake_required).length, 0)} />
        </div>

        <Card>
          <CardHeader><CardTitle>Registrar recepción</CardTitle><CardDescription>La cantidad acumulada nunca puede superar la cantidad solicitada. El traspaso a Inventario requiere permiso adicional.</CardDescription></CardHeader>
          <CardContent>
            {orders.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No existen órdenes emitidas, confirmadas o parcialmente recibidas.</div> : <form onSubmit={submitReceipt} className="space-y-4">
              <div><label className="text-sm font-medium">Orden de compra</label><select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.purchaseOrderId} onChange={(event) => setForm({ ...form, purchaseOrderId: event.target.value, receivedQuantity: "" })}><option value="">Seleccionar orden</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.order_number ?? "Sin número"} · {order.procurement_requests?.title ?? "Solicitud"} · {order.suppliers?.name ?? "Proveedor"}</option>)}</select></div>
              {selectedOrder && <div className="rounded-lg border bg-muted/20 p-3 text-sm"><p className="font-medium">{selectedOrder.procurement_requests?.title}</p><p className="text-muted-foreground">Pedido: {selectedOrder.procurement_requests?.quantity} {selectedOrder.procurement_requests?.unit} · Estado: {selectedOrder.status}</p></div>}
              <div className="grid gap-4 md:grid-cols-3"><Field label="Cantidad aceptada"><Input required type="number" min="0" step="0.01" value={form.receivedQuantity} onChange={(event) => setForm({ ...form, receivedQuantity: event.target.value })} /></Field><Field label="Cantidad rechazada"><Input type="number" min="0" step="0.01" value={form.rejectedQuantity} onChange={(event) => setForm({ ...form, rejectedQuantity: event.target.value })} /></Field><Field label="Condición"><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}><option value="accepted">Aceptado</option><option value="partial_damage">Daño parcial</option><option value="damaged">Dañado</option><option value="incorrect">Producto incorrecto</option></select></Field></div>
              <Field label="Motivo de diferencia"><Input value={form.discrepancyReason} onChange={(event) => setForm({ ...form, discrepancyReason: event.target.value })} placeholder="Obligatorio si existe rechazo, daño o diferencia" /></Field>
              <div className="grid gap-4 md:grid-cols-2"><Field label="Guía o documento de entrega"><Input value={form.deliveryDocument} onChange={(event) => setForm({ ...form, deliveryDocument: event.target.value })} /></Field><Field label="URL de evidencia"><Input type="url" value={form.evidenceUrl} onChange={(event) => setForm({ ...form, evidenceUrl: event.target.value })} placeholder="Foto o documento almacenado" /></Field></div>
              <Field label="Notas"><textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
              {canCreateInventoryIntake ? <div className="rounded-lg border p-4"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.inventoryIntakeRequired} onChange={(event) => setForm({ ...form, inventoryIntakeRequired: event.target.checked })} />Enviar a cola de Inventario</label>{form.inventoryIntakeRequired && <select className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.intakeType} onChange={(event) => setForm({ ...form, intakeType: event.target.value })}><option value="asset">Activo individual</option><option value="consumable">Insumo consumible</option></select>}</div> : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Puedes registrar la recepción, pero tu perfil no puede generar ingresos a Inventario.</div>}
              <div className="flex justify-end"><Button type="submit" disabled={submitting}><PackageCheck className="mr-2 h-4 w-4" />{submitting ? "Registrando…" : "Confirmar recepción"}</Button></div>
            </form>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Historial reciente</CardTitle><CardDescription>Recepciones publicadas y su vínculo con Inventario.</CardDescription></CardHeader>
          <CardContent>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando recepciones…</p> : receipts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay recepciones registradas.</p> : <div className="space-y-3">{receipts.map((receipt) => { const item = receipt.procurement_receipt_items[0]; return <div key={receipt.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{receipt.receipt_number ?? "Recepción"}</p><p className="text-sm text-muted-foreground">{receipt.procurement_purchase_orders?.order_number ?? "OC"} · {receipt.procurement_purchase_orders?.suppliers?.name ?? "Proveedor"}</p></div><Badge variant="outline"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Publicada</Badge></div><p className="mt-3 text-sm">Aceptado: {item?.received_quantity ?? 0} · Rechazado: {item?.rejected_quantity ?? 0} · Condición: {item?.condition ?? "-"}</p>{item?.inventory_intake_required && <p className="mt-1 text-xs text-muted-foreground">Enviado a Inventario · {item.intake_type === "asset" ? "Activo" : "Consumible"}</p>}</div>})}</div>}</CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Metric({ label, value }: { label: string; value: number }) { return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value.toLocaleString("es-CL")}</div></CardContent></Card> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-sm font-medium">{label}</label>{children}</div> }
