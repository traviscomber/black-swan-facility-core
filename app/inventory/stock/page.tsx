"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpFromLine,
  ClipboardCheck,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  Settings2,
  Warehouse,
} from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { createBrowserClient } from "@/lib/supabase/client"

type StockState = "ok" | "low" | "out" | "inactive"
type StockOperation = "issue" | "return" | "transfer" | "count" | "adjustment"

type StockRow = {
  id: string
  item_code: string
  name: string
  category: string | null
  unit: string
  warehouse_location_id: string
  warehouse_location_name: string
  warehouse_location_code: string
  warehouse_id: string
  warehouse_name: string
  location_id: string | null
  cost_center_id: string | null
  cost_center_name: string | null
  cost_center_code: string | null
  quantity_on_hand: number
  minimum_stock: number
  reorder_quantity: number
  suggested_reorder_quantity: number
  shortfall_to_minimum: number
  unit_cost: number | null
  inventory_value: number
  is_active: boolean
  last_counted_at: string | null
  stock_state: StockState
}

type MovementRow = {
  id: string
  stock_item_id: string
  movement_type: string
  quantity: number
  unit_cost: number | null
  balance_before: number | null
  balance_after: number
  from_location_id: string | null
  to_location_id: string | null
  transfer_group_id: string | null
  notes: string | null
  moved_at: string
}

type LocationOption = {
  id: string
  code: string
  name: string
  warehouse_id: string
  warehouse: { id: string; name: string; location_id: string | null } | null
}

type RawWarehouse = { id: string; name: string; location_id: string | null }
type RawLocation = { id: string; code: string; name: string; warehouse_id: string; warehouses: RawWarehouse | RawWarehouse[] | null }

const movementLabel: Record<string, string> = {
  receipt: "Recepción",
  issue: "Salida / consumo",
  adjustment: "Ajuste",
  transfer_in: "Traslado entrada",
  transfer_out: "Traslado salida",
  return: "Devolución",
}

const operationCopy: Record<StockOperation, { label: string; description: string }> = {
  issue: { label: "Registrar salida", description: "Descuenta una cantidad del saldo disponible." },
  return: { label: "Registrar devolución", description: "Reintegra unidades al saldo de la ubicación." },
  transfer: { label: "Transferir", description: "Mueve stock entre ubicaciones con doble kardex atómico." },
  count: { label: "Conteo físico", description: "Registra el saldo contado y deja fecha de último conteo." },
  adjustment: { label: "Ajustar saldo", description: "Corrige el saldo a un valor objetivo con motivo obligatorio." },
}

const stateCopy: Record<StockState, string> = {
  ok: "Disponible",
  low: "Bajo mínimo",
  out: "Sin stock",
  inactive: "Inactivo",
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeStock(row: Record<string, unknown>): StockRow {
  return {
    id: String(row.id),
    item_code: String(row.item_code ?? ""),
    name: String(row.name ?? ""),
    category: typeof row.category === "string" ? row.category : null,
    unit: String(row.unit ?? "unidad"),
    warehouse_location_id: String(row.warehouse_location_id ?? ""),
    warehouse_location_name: String(row.warehouse_location_name ?? "Sin ubicación"),
    warehouse_location_code: String(row.warehouse_location_code ?? ""),
    warehouse_id: String(row.warehouse_id ?? ""),
    warehouse_name: String(row.warehouse_name ?? "Bodega"),
    location_id: typeof row.location_id === "string" ? row.location_id : null,
    cost_center_id: typeof row.cost_center_id === "string" ? row.cost_center_id : null,
    cost_center_name: typeof row.cost_center_name === "string" ? row.cost_center_name : null,
    cost_center_code: typeof row.cost_center_code === "string" ? row.cost_center_code : null,
    quantity_on_hand: numberValue(row.quantity_on_hand),
    minimum_stock: numberValue(row.minimum_stock),
    reorder_quantity: numberValue(row.reorder_quantity),
    suggested_reorder_quantity: numberValue(row.suggested_reorder_quantity),
    shortfall_to_minimum: numberValue(row.shortfall_to_minimum),
    unit_cost: row.unit_cost == null ? null : numberValue(row.unit_cost),
    inventory_value: numberValue(row.inventory_value),
    is_active: row.is_active !== false,
    last_counted_at: typeof row.last_counted_at === "string" ? row.last_counted_at : null,
    stock_state: ["ok", "low", "out", "inactive"].includes(String(row.stock_state)) ? String(row.stock_state) as StockState : "ok",
  }
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

export default function InventoryStockPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { can, canAccessDepartment, loading: accessLoading } = useEffectiveAccess()
  const canOperate = can("inventory.process") && canAccessDepartment("inventory")

  const [stock, setStock] = useState<StockRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [query, setQuery] = useState("")
  const [stateFilter, setStateFilter] = useState<"all" | StockState>("all")
  const [warehouseFilter, setWarehouseFilter] = useState("all")
  const [selectedId, setSelectedId] = useState("")
  const [operation, setOperation] = useState<StockOperation>("issue")
  const [quantity, setQuantity] = useState("")
  const [newBalance, setNewBalance] = useState("")
  const [destinationId, setDestinationId] = useState("")
  const [reason, setReason] = useState("")
  const [minimumStock, setMinimumStock] = useState("")
  const [reorderQuantity, setReorderQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [stockResult, movementResult, locationResult] = await Promise.all([
      supabase
        .from("inventory_stock_status")
        .select("id,item_code,name,category,unit,warehouse_location_id,warehouse_location_name,warehouse_location_code,warehouse_id,warehouse_name,location_id,cost_center_id,cost_center_name,cost_center_code,quantity_on_hand,minimum_stock,reorder_quantity,suggested_reorder_quantity,shortfall_to_minimum,unit_cost,inventory_value,is_active,last_counted_at,stock_state")
        .order("name"),
      supabase
        .from("inventory_stock_movements")
        .select("id,stock_item_id,movement_type,quantity,unit_cost,balance_before,balance_after,from_location_id,to_location_id,transfer_group_id,notes,moved_at")
        .order("moved_at", { ascending: false })
        .limit(100),
      supabase
        .from("warehouse_locations")
        .select("id,code,name,warehouse_id,warehouses(id,name,location_id)")
        .eq("is_active", true)
        .order("name"),
    ])

    const firstError = stockResult.error || movementResult.error || locationResult.error
    if (firstError) {
      setError(firstError.message)
      setStock([])
      setMovements([])
      setLocations([])
    } else {
      setStock(((stockResult.data ?? []) as Record<string, unknown>[]).map(normalizeStock))
      setMovements(((movementResult.data ?? []) as MovementRow[]).map((row) => ({
        ...row,
        quantity: numberValue(row.quantity),
        unit_cost: row.unit_cost == null ? null : numberValue(row.unit_cost),
        balance_before: row.balance_before == null ? null : numberValue(row.balance_before),
        balance_after: numberValue(row.balance_after),
      })))
      setLocations(((locationResult.data ?? []) as RawLocation[]).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        warehouse_id: row.warehouse_id,
        warehouse: firstRelation(row.warehouses),
      })))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const selected = stock.find((item) => item.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) return
    setMinimumStock(String(selected.minimum_stock))
    setReorderQuantity(String(selected.reorder_quantity))
    setUnitCost(selected.unit_cost == null ? "" : String(selected.unit_cost))
    setDestinationId("")
    setQuantity("")
    setNewBalance("")
    setReason("")
  }, [selected])

  const warehouses = useMemo(() => Array.from(new Map(
    stock.map((item) => [item.warehouse_id, item.warehouse_name]),
  ).entries()), [stock])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return stock.filter((item) => {
      if (stateFilter !== "all" && item.stock_state !== stateFilter) return false
      if (warehouseFilter !== "all" && item.warehouse_id !== warehouseFilter) return false
      if (!needle) return true
      return `${item.item_code} ${item.name} ${item.category ?? ""} ${item.warehouse_name} ${item.warehouse_location_name}`.toLowerCase().includes(needle)
    })
  }, [query, stateFilter, stock, warehouseFilter])

  const lowStock = stock.filter((item) => item.is_active && ["low", "out"].includes(item.stock_state))
  const inventoryValue = stock.reduce((sum, item) => sum + item.inventory_value, 0)
  const neverCounted = stock.filter((item) => item.is_active && !item.last_counted_at).length
  const names = Object.fromEntries(stock.map((item) => [item.id, item.name]))
  const locationNames = Object.fromEntries(locations.map((location) => [location.id, `${location.warehouse?.name ?? "Bodega"} · ${location.name}`]))

  async function executeOperation() {
    if (!selected || !canOperate || saving) return
    const usesQuantity = ["issue", "return", "transfer"].includes(operation)
    const usesNewBalance = ["count", "adjustment"].includes(operation)
    const parsedQuantity = usesQuantity ? Number(quantity) : null
    const parsedBalance = usesNewBalance ? Number(newBalance) : null

    if (!reason.trim()) return toast({ title: "Falta el motivo", description: "Toda operación de inventario requiere un motivo auditable.", variant: "destructive" })
    if (usesQuantity && (!Number.isFinite(parsedQuantity) || Number(parsedQuantity) <= 0)) return toast({ title: "Cantidad inválida", description: "Ingresa una cantidad mayor que cero.", variant: "destructive" })
    if (usesNewBalance && (!Number.isFinite(parsedBalance) || Number(parsedBalance) < 0)) return toast({ title: "Saldo inválido", description: "El saldo objetivo debe ser cero o mayor.", variant: "destructive" })
    if (operation === "transfer" && !destinationId) return toast({ title: "Falta destino", description: "Selecciona una ubicación de destino.", variant: "destructive" })

    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc("execute_inventory_stock_operation", {
      p_stock_item_id: selected.id,
      p_operation: operation,
      p_quantity: parsedQuantity,
      p_to_location_id: operation === "transfer" ? destinationId : null,
      p_new_balance: parsedBalance,
      p_reason: reason.trim(),
    })
    setSaving(false)

    if (rpcError) return toast({ title: "Operación rechazada", description: rpcError.message, variant: "destructive" })
    toast({ title: "Movimiento registrado", description: `${operationCopy[operation].label} · saldo ${Number(data?.balance_after ?? selected.quantity_on_hand).toLocaleString("es-CL")} ${selected.unit}` })
    setQuantity("")
    setNewBalance("")
    setDestinationId("")
    setReason("")
    await load()
  }

  async function saveSettings() {
    if (!selected || !canOperate || saving) return
    const parsedMinimum = Number(minimumStock)
    const parsedReorder = Number(reorderQuantity)
    const parsedCost = unitCost.trim() ? Number(unitCost) : null
    if (!Number.isFinite(parsedMinimum) || parsedMinimum < 0 || !Number.isFinite(parsedReorder) || parsedReorder < 0 || (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0))) {
      return toast({ title: "Parámetros inválidos", description: "Mínimo, reposición y costo deben ser cero o mayores.", variant: "destructive" })
    }

    setSaving(true)
    const { error: rpcError } = await supabase.rpc("update_inventory_stock_settings", {
      p_stock_item_id: selected.id,
      p_minimum_stock: parsedMinimum,
      p_reorder_quantity: parsedReorder,
      p_unit_cost: parsedCost,
      p_cost_center_id: selected.cost_center_id,
    })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo actualizar", description: rpcError.message, variant: "destructive" })
    toast({ title: "Parámetros actualizados", description: `${selected.name} quedó con control de reposición vigente.` })
    await load()
  }

  const availableDestinations = selected ? locations.filter((location) => location.id !== selected.warehouse_location_id) : locations

  return (
    <AppLayout>
      <PageHeader
        title="Stock y Kardex"
        description="Control operacional de consumibles: salidas, devoluciones, transferencias, conteos, ajustes y reposición."
        actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button><Button variant="outline" asChild><Link href="/inventory/intake"><ClipboardCheck className="mr-2 h-4 w-4" />Ingresos</Link></Button><Button variant="outline" asChild><Link href="/inventory"><ArrowLeft className="mr-2 h-4 w-4" />Inventario</Link></Button></div>}
      />

      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Ítems activos" value={stock.filter((item) => item.is_active).length} detail="Posiciones de stock controladas" />
          <Metric title="Requieren reposición" value={lowStock.length} alert={lowStock.length > 0} detail="Bajo mínimo o sin existencias" />
          <Metric title="Valor registrado" value={formatClp(inventoryValue)} detail="Saldo por costo unitario" />
          <Metric title="Sin conteo registrado" value={neverCounted} alert={neverCounted > 0 && stock.length > 0} detail="Pendientes de control físico" />
        </div>

        {error && <Card className="border-destructive/60"><CardContent className="flex items-center justify-between gap-3 p-4"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}>Reintentar</Button></CardContent></Card>}

        {!accessLoading && !canOperate && <Card className="border-amber-300"><CardContent className="flex items-start gap-3 p-4 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" /><div><p className="font-medium">Acceso de operación restringido</p><p className="text-muted-foreground">Puedes consultar únicamente el stock que permitan tus permisos. Las operaciones requieren inventory.process y scope de Inventario.</p></div></CardContent></Card>}

        {lowStock.length > 0 && <Card className="border-amber-300"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-700" />Cola de reposición</CardTitle><CardDescription>Ítems que alcanzaron el mínimo configurado. La recomendación usa sólo parámetros reales del ítem.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{lowStock.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="rounded-lg border p-3 text-left transition hover:bg-muted/40"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.warehouse_name} · {item.warehouse_location_name}</p></div><Badge variant="outline">{stateCopy[item.stock_state]}</Badge></div><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Saldo / mínimo</p><p className="font-semibold">{item.quantity_on_hand.toLocaleString("es-CL")} / {item.minimum_stock.toLocaleString("es-CL")} {item.unit}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Reposición sugerida</p><p className="font-semibold">{item.suggested_reorder_quantity.toLocaleString("es-CL")} {item.unit}</p></div></div></button>)}</CardContent></Card>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.85fr)]">
          <Card>
            <CardHeader><CardTitle>Existencias</CardTitle><CardDescription>Una fila representa el saldo de un ítem en una ubicación física.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_180px_220px]">
                <Input placeholder="Buscar código, ítem, categoría o ubicación" value={query} onChange={(event) => setQuery(event.target.value)} />
                <select className="rounded-md border bg-background px-3 py-2 text-sm" value={stateFilter} onChange={(event) => setStateFilter(event.target.value as "all" | StockState)}><option value="all">Todos los estados</option><option value="ok">Disponible</option><option value="low">Bajo mínimo</option><option value="out">Sin stock</option><option value="inactive">Inactivo</option></select>
                <select className="rounded-md border bg-background px-3 py-2 text-sm" value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}><option value="all">Todas las bodegas</option>{warehouses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Ítem</TableHead><TableHead>Ubicación</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Mínimo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {loading ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Cargando stock…</TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="py-10 text-center"><PackageSearch className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><p className="font-medium">No hay existencias para este filtro.</p><p className="mt-1 text-sm text-muted-foreground">Los consumibles aparecen después de procesar una recepción de compras.</p></TableCell></TableRow> : filtered.map((item) => <TableRow key={item.id} className={selectedId === item.id ? "bg-muted/40" : undefined}><TableCell className="font-mono text-xs">{item.item_code}</TableCell><TableCell><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.category ?? "Sin categoría"} · {item.unit}</p></TableCell><TableCell><p>{item.warehouse_name}</p><p className="text-xs text-muted-foreground">{item.warehouse_location_code} · {item.warehouse_location_name}</p></TableCell><TableCell className="text-right font-semibold">{item.quantity_on_hand.toLocaleString("es-CL")}</TableCell><TableCell className="text-right">{item.minimum_stock.toLocaleString("es-CL")}</TableCell><TableCell className="text-right">{formatClp(item.inventory_value)}</TableCell><TableCell><StockStateBadge state={item.stock_state} /></TableCell><TableCell className="text-right"><Button size="sm" variant={selectedId === item.id ? "default" : "outline"} onClick={() => setSelectedId(item.id)}>Operar</Button></TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ArrowRightLeft className="h-4 w-4" />Operación de stock</CardTitle><CardDescription>{selected ? `${selected.name} · saldo ${selected.quantity_on_hand.toLocaleString("es-CL")} ${selected.unit}` : "Selecciona un ítem para registrar un movimiento."}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Seleccionar ítem</option>{stock.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.item_code} · {item.name} · {item.warehouse_location_name}</option>)}</select>
                <div className="grid grid-cols-2 gap-2">{(["issue", "return", "transfer", "count", "adjustment"] as StockOperation[]).map((key) => <Button key={key} type="button" size="sm" variant={operation === key ? "default" : "outline"} onClick={() => setOperation(key)}>{key === "issue" ? <ArrowUpFromLine className="mr-2 h-3.5 w-3.5" /> : key === "return" ? <ArrowDownToLine className="mr-2 h-3.5 w-3.5" /> : key === "transfer" ? <ArrowRightLeft className="mr-2 h-3.5 w-3.5" /> : key === "count" ? <ClipboardCheck className="mr-2 h-3.5 w-3.5" /> : <RotateCcw className="mr-2 h-3.5 w-3.5" />}{operationCopy[key].label}</Button>)}</div>
                <p className="text-xs text-muted-foreground">{operationCopy[operation].description}</p>
                {["issue", "return", "transfer"].includes(operation) && <Field label={`Cantidad (${selected?.unit ?? "unidad"})`}><Input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0" /></Field>}
                {["count", "adjustment"].includes(operation) && <Field label={`Nuevo saldo (${selected?.unit ?? "unidad"})`}><Input type="number" min="0" step="any" value={newBalance} onChange={(event) => setNewBalance(event.target.value)} placeholder={selected ? String(selected.quantity_on_hand) : "0"} /></Field>}
                {operation === "transfer" && <Field label="Ubicación de destino"><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">Seleccionar destino</option>{availableDestinations.map((location) => <option key={location.id} value={location.id}>{location.warehouse?.name ?? "Bodega"} · {location.code} · {location.name}</option>)}</select></Field>}
                <Field label="Motivo obligatorio"><textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Indica orden, persona, conteo, consumo o causa del ajuste." /></Field>
                <Button className="w-full" disabled={!selected || !canOperate || saving} onClick={() => void executeOperation()}>{saving ? "Registrando…" : operationCopy[operation].label}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4" />Política de reposición</CardTitle><CardDescription>{selected ? `Parámetros operativos de ${selected.name}.` : "Selecciona un ítem para configurar mínimos y costo."}</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Field label="Stock mínimo"><Input type="number" min="0" step="any" disabled={!selected} value={minimumStock} onChange={(event) => setMinimumStock(event.target.value)} /></Field>
                <Field label="Cantidad habitual a reponer"><Input type="number" min="0" step="any" disabled={!selected} value={reorderQuantity} onChange={(event) => setReorderQuantity(event.target.value)} /></Field>
                <Field label="Costo unitario CLP"><Input type="number" min="0" step="any" disabled={!selected} value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder="Mantener costo actual" /></Field>
                {selected && <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"><p>Centro de costo: {selected.cost_center_name ?? "No asignado"}{selected.cost_center_code ? ` (${selected.cost_center_code})` : ""}</p><p className="mt-1">Último conteo: {selected.last_counted_at ? new Date(selected.last_counted_at).toLocaleString("es-CL") : "Sin registro"}</p></div>}
                <Button className="w-full" variant="outline" disabled={!selected || !canOperate || saving} onClick={() => void saveSettings()}>Guardar parámetros</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Kardex auditable</CardTitle><CardDescription>Últimos 100 movimientos. Transferencias comparten un identificador y registran salida y entrada en la misma transacción.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {movements.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground"><Warehouse className="mx-auto mb-3 h-7 w-7" /><p>Todavía no hay movimientos de stock.</p></div> : movements.map((movement) => <div key={movement.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{names[movement.stock_item_id] ?? "Ítem de stock"}</p><Badge variant="outline">{movementLabel[movement.movement_type] ?? movement.movement_type}</Badge>{movement.transfer_group_id && <span className="font-mono text-[10px] text-muted-foreground">TX {movement.transfer_group_id.slice(0, 8)}</span>}</div><p className="mt-1 text-xs text-muted-foreground">{new Date(movement.moved_at).toLocaleString("es-CL")}{movement.notes ? ` · ${movement.notes}` : ""}</p>{(movement.from_location_id || movement.to_location_id) && <p className="mt-1 text-xs text-muted-foreground">{movement.from_location_id ? locationNames[movement.from_location_id] ?? "Origen" : "Externo"} → {movement.to_location_id ? locationNames[movement.to_location_id] ?? "Destino" : "Salida"}</p>}</div><div className="text-right"><p className="font-semibold">{movementDelta(movement).toLocaleString("es-CL", { maximumFractionDigits: 3, signDisplay: "always" })}</p><p className="text-xs text-muted-foreground">{movement.balance_before == null ? "Saldo" : `${movement.balance_before.toLocaleString("es-CL")} →`} {movement.balance_after.toLocaleString("es-CL")}</p></div></div>)}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function movementDelta(movement: MovementRow) {
  if (movement.balance_before != null) return movement.balance_after - movement.balance_before
  if (["issue", "transfer_out"].includes(movement.movement_type)) return -movement.quantity
  return movement.quantity
}

function StockStateBadge({ state }: { state: StockState }) {
  const className = state === "out" ? "border-red-300 text-red-700" : state === "low" ? "border-amber-300 text-amber-700" : state === "ok" ? "border-emerald-300 text-emerald-700" : ""
  return <Badge variant="outline" className={className}>{stateCopy[state]}</Badge>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-medium">{label}</label>{children}</div>
}

function Metric({ title, value, alert = false, detail }: { title: string; value: number | string; alert?: boolean; detail?: string }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString("es-CL") : value}</div>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>
}
