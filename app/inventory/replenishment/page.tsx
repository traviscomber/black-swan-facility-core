"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, ClipboardList, PackageSearch, RefreshCw, ShoppingCart, Truck } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { createBrowserClient } from "@/lib/supabase/client"

type NeedStatus = "open" | "requested" | "approved" | "ordered" | "receiving" | "fulfilled" | "rejected" | "cancelled"

type StockItem = {
  id: string
  item_code: string
  name: string
  unit: string
  quantity_on_hand: number
  minimum_stock: number
  reorder_quantity: number
  unit_cost: number | null
  warehouse_location: { name: string; warehouse: { name: string } | null } | null
}

type Need = {
  id: string
  status: NeedStatus
  trigger_quantity: number
  minimum_stock: number
  suggested_quantity: number
  requested_quantity: number | null
  procurement_request_id: string | null
  purchase_order_id: string | null
  opened_at: string
  requested_at: string | null
  approved_at: string | null
  ordered_at: string | null
  receiving_at: string | null
  fulfilled_at: string | null
  resolution_reason: string | null
  stock_item: StockItem | null
  request: { id: string; request_number: string | null; status: string } | null
  order: { id: string; order_number: string | null; status: string } | null
}

type RawNeed = Omit<Need, "stock_item" | "request" | "order"> & {
  inventory_stock_items: StockItem | StockItem[] | null
  procurement_requests: Need["request"] | Need["request"][] | null
  procurement_purchase_orders: Need["order"] | Need["order"][] | null
}

const STATUS_COPY: Record<NeedStatus, { label: string; detail: string }> = {
  open: { label: "Necesidad abierta", detail: "Stock bajo mínimo; todavía no existe solicitud de compra." },
  requested: { label: "Solicitud enviada", detail: "La requisición ya está en Compras y espera decisión." },
  approved: { label: "Aprobada", detail: "Compras puede cotizar y seleccionar proveedor." },
  ordered: { label: "Ordenada", detail: "Existe una orden de compra vinculada." },
  receiving: { label: "En recepción", detail: "La compra llegó total o parcialmente y espera cierre de ingreso." },
  fulfilled: { label: "Repuesta", detail: "El ingreso quedó aplicado al SKU de origen." },
  rejected: { label: "Rechazada", detail: "La solicitud de compra fue rechazada; una nueva necesidad puede abrirse si el stock sigue bajo." },
  cancelled: { label: "Cancelada", detail: "La orden o el ciclo fue cancelado." },
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

export default function InventoryReplenishmentPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { loading: accessLoading, can, canAccessDepartment } = useEffectiveAccess()
  const canOperate = can("inventory.process") && canAccessDepartment("inventory")
  const [needs, setNeeds] = useState<Need[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [requestedQuantity, setRequestedQuantity] = useState("")
  const [requiredDate, setRequiredDate] = useState("")
  const [priority, setPriority] = useState("normal")
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (accessLoading) return
    if (!canOperate) {
      setNeeds([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("inventory_replenishment_needs")
      .select("id,status,trigger_quantity,minimum_stock,suggested_quantity,requested_quantity,procurement_request_id,purchase_order_id,opened_at,requested_at,approved_at,ordered_at,receiving_at,fulfilled_at,resolution_reason,inventory_stock_items(id,item_code,name,unit,quantity_on_hand,minimum_stock,reorder_quantity,unit_cost,warehouse_location:warehouse_locations(name,warehouse:warehouses(name))),procurement_requests(id,request_number,status),procurement_purchase_orders(id,order_number,status)")
      .order("opened_at", { ascending: false })
      .limit(100)

    if (loadError) {
      setError(loadError.message)
      setNeeds([])
    } else {
      const normalized = ((data ?? []) as unknown as RawNeed[]).map((row) => {
        const stock = firstRelation(row.inventory_stock_items)
        return {
          ...row,
          trigger_quantity: asNumber(row.trigger_quantity),
          minimum_stock: asNumber(row.minimum_stock),
          suggested_quantity: asNumber(row.suggested_quantity),
          requested_quantity: row.requested_quantity == null ? null : asNumber(row.requested_quantity),
          stock_item: stock ? { ...stock, quantity_on_hand: asNumber(stock.quantity_on_hand), minimum_stock: asNumber(stock.minimum_stock), reorder_quantity: asNumber(stock.reorder_quantity), unit_cost: stock.unit_cost == null ? null : asNumber(stock.unit_cost), warehouse_location: firstRelation(stock.warehouse_location as unknown as StockItem["warehouse_location"] | StockItem["warehouse_location"][]) } : null,
          request: firstRelation(row.procurement_requests),
          order: firstRelation(row.procurement_purchase_orders),
        } satisfies Need
      })
      setNeeds(normalized)
      setSelectedId((current) => current && normalized.some((need) => need.id === current) ? current : normalized.find((need) => need.status === "open")?.id ?? normalized[0]?.id ?? "")
    }
    setLoading(false)
  }, [accessLoading, canOperate, supabase])

  useEffect(() => { void load() }, [load])

  const selected = needs.find((need) => need.id === selectedId) ?? null
  useEffect(() => {
    if (!selected) return
    setRequestedQuantity(String(selected.requested_quantity ?? selected.suggested_quantity))
    setRequiredDate("")
    setPriority(selected.stock_item?.quantity_on_hand === 0 ? "high" : "normal")
  }, [selected])

  const activeStatuses: NeedStatus[] = ["open", "requested", "approved", "ordered", "receiving"]
  const visibleNeeds = statusFilter === "active" ? needs.filter((need) => activeStatuses.includes(need.status)) : needs
  const metrics = {
    open: needs.filter((need) => need.status === "open").length,
    requested: needs.filter((need) => ["requested", "approved"].includes(need.status)).length,
    ordered: needs.filter((need) => ["ordered", "receiving"].includes(need.status)).length,
    fulfilled: needs.filter((need) => need.status === "fulfilled").length,
  }

  async function createRequest() {
    if (!selected || selected.status !== "open" || saving) return
    const quantity = Number(requestedQuantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("La cantidad solicitada debe ser mayor que cero.")
      return
    }

    setSaving(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc("create_procurement_request_from_replenishment", {
      p_need_id: selected.id,
      p_requested_quantity: quantity,
      p_required_date: requiredDate || null,
      p_priority: priority,
    })
    setSaving(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    toast({ title: "Solicitud enviada a Compras", description: `La necesidad quedó vinculada a la requisición ${String(data).slice(0, 8)}…` })
    await load()
  }

  if (accessLoading) return <AppLayout><div className="p-8 text-sm text-muted-foreground">Verificando acceso a Inventario…</div></AppLayout>

  if (!canOperate) {
    return <AppLayout><PageHeader title="Reposición de Inventario" description="Necesidades de compra vinculadas a stock real." /><div className="p-4 sm:p-8"><Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Tu perfil no tiene permiso para operar Inventario.</CardContent></Card></div></AppLayout>
  }

  return (
    <AppLayout>
      <PageHeader
        title="Reposición de Inventario"
        description="Del stock mínimo a Compras, orden, recepción e ingreso, conservando una sola necesidad activa por SKU."
        actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button><Button variant="outline" asChild><Link href="/inventory/stock"><ArrowLeft className="mr-2 h-4 w-4" />Stock</Link></Button></div>}
      />

      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Por solicitar" value={metrics.open} alert={metrics.open > 0} />
          <Metric label="En aprobación" value={metrics.requested} />
          <Metric label="Orden / recepción" value={metrics.ordered} />
          <Metric label="Repuestas" value={metrics.fulfilled} />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Cadena operacional</CardTitle><CardDescription>No se crean compras por simulación: el ciclo nace únicamente cuando un SKU real queda en o bajo su mínimo configurado.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <Stage icon={PackageSearch} title="1. Stock" detail="Detecta mínimo y cantidad sugerida." />
            <Stage icon={ClipboardList} title="2. Requisición" detail="Inventario envía una sola solicitud idempotente." />
            <Stage icon={ShoppingCart} title="3. Compra" detail="Aprobación, cotización y orden siguen en Procurement." />
            <Stage icon={Truck} title="4. Recepción" detail="Recepción parcial/total mantiene trazabilidad." />
            <Stage icon={CheckCircle2} title="5. Ingreso" detail="El intake repone el mismo SKU y cierra el ciclo." />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2"><Button size="sm" variant={statusFilter === "active" ? "default" : "outline"} onClick={() => setStatusFilter("active")}>Activas</Button><Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>Historial</Button></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><Link href="/procurement/requests">Solicitudes</Link></Button><Button variant="outline" size="sm" asChild><Link href="/procurement/approvals">Aprobaciones</Link></Button><Button variant="outline" size="sm" asChild><Link href="/procurement/receiving">Recepción</Link></Button><Button variant="outline" size="sm" asChild><Link href="/inventory/intake">Ingreso</Link></Button></div>
        </div>

        {loading ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Cargando necesidades de reposición…</CardContent></Card> : visibleNeeds.length === 0 ? <Card><CardContent className="p-10 text-center"><PackageSearch className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-medium">No hay necesidades de reposición {statusFilter === "active" ? "activas" : "registradas"}.</p><p className="mx-auto mt-1 max-w-2xl text-sm text-muted-foreground">Cuando exista stock consumible real y una posición alcance su mínimo configurado, el sistema abrirá la necesidad automáticamente. No se crean registros de demostración.</p></CardContent></Card> : (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader><CardTitle className="text-base">Necesidades</CardTitle><CardDescription>Una necesidad activa por SKU y ubicación.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {visibleNeeds.map((need) => {
                  const stock = need.stock_item
                  const selectedRow = need.id === selectedId
                  return <button key={need.id} type="button" onClick={() => setSelectedId(need.id)} className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/40 ${selectedRow ? "border-primary bg-muted/30" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{stock ? `${stock.item_code} · ${stock.name}` : "SKU no disponible"}</p><p className="mt-1 text-xs text-muted-foreground">{stock?.warehouse_location ? `${stock.warehouse_location.warehouse?.name ?? "Bodega"} · ${stock.warehouse_location.name}` : "Ubicación no disponible"}</p></div><Badge variant={need.status === "open" ? "destructive" : "outline"}>{STATUS_COPY[need.status].label}</Badge></div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><span>Actual: <strong>{stock?.quantity_on_hand ?? need.trigger_quantity} {stock?.unit ?? ""}</strong></span><span>Mínimo: <strong>{need.minimum_stock}</strong></span><span>Sugerido: <strong>{need.suggested_quantity}</strong></span></div>
                  </button>
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Control de la necesidad</CardTitle><CardDescription>{selected ? STATUS_COPY[selected.status].detail : "Selecciona una necesidad."}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {!selected ? <p className="text-sm text-muted-foreground">Selecciona una necesidad para revisar su trazabilidad.</p> : <>
                  <div className="rounded-lg border bg-muted/20 p-4"><p className="font-medium">{selected.stock_item?.name ?? "SKU"}</p><p className="mt-1 text-sm text-muted-foreground">Abierta {formatDate(selected.opened_at)} · {selected.stock_item?.item_code}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Cantidad al disparar</p><p className="font-medium">{selected.trigger_quantity}</p></div><div><p className="text-xs text-muted-foreground">Reposición sugerida</p><p className="font-medium">{selected.suggested_quantity} {selected.stock_item?.unit}</p></div></div></div>

                  {selected.status === "open" ? <div className="space-y-3 rounded-lg border p-4"><div><label className="text-sm font-medium">Cantidad a solicitar</label><Input type="number" min="0.01" step="0.01" value={requestedQuantity} onChange={(event) => setRequestedQuantity(event.target.value)} /></div><div className="grid gap-3 sm:grid-cols-2"><div><label className="text-sm font-medium">Fecha requerida</label><Input type="date" value={requiredDate} onChange={(event) => setRequiredDate(event.target.value)} /></div><div><label className="text-sm font-medium">Prioridad</label><select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div></div><Button className="w-full" onClick={() => void createRequest()} disabled={saving}>{saving ? "Enviando…" : "Crear solicitud de compra"}</Button><p className="text-xs text-muted-foreground">Si esta necesidad ya tiene una solicitud vinculada, el RPC devuelve la misma y no duplica la requisición.</p></div> : <div className="space-y-3 rounded-lg border p-4 text-sm"><Trace label="Solicitud" value={selected.request?.request_number ?? selected.procurement_request_id ?? "—"} state={selected.request?.status} /><Trace label="Orden" value={selected.order?.order_number ?? selected.purchase_order_id ?? "—"} state={selected.order?.status} /><Trace label="Cantidad solicitada" value={selected.requested_quantity == null ? "—" : `${selected.requested_quantity} ${selected.stock_item?.unit ?? ""}`} /><Trace label="Último resultado" value={selected.resolution_reason ?? STATUS_COPY[selected.status].detail} /></div>}
                </>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value.toLocaleString("es-CL")}</div></CardContent></Card>
}

function Stage({ icon: Icon, title, detail }: { icon: typeof PackageSearch; title: string; detail: string }) {
  return <div className="rounded-lg border p-3"><Icon className="h-4 w-4 text-muted-foreground" /><p className="mt-3 text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>
}

function Trace({ label, value, state }: { label: string; value: string; state?: string }) {
  return <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 break-all font-medium">{value}</p></div>{state && <Badge variant="outline">{state}</Badge>}</div>
}
