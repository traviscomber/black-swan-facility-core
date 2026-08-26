"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, CalendarClock, ClipboardList, PackageCheck, RefreshCw, ShieldCheck, UserRoundCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"

type Asset = {
  id: string
  asset_code: string
  name: string
  status: string
  assigned_to: string | null
  warehouse_location_id: string | null
  warehouse_location: { id: string; code: string; name: string; warehouse: { name: string } | null } | null
}

type Location = { id: string; code: string; name: string; warehouse: { name: string } | null }
type Movement = {
  id: string
  movement_type: string
  assigned_to: string | null
  notes: string | null
  moved_at: string
  asset: { asset_code: string; name: string } | null
  from_location: { name: string } | null
  to_location: { name: string } | null
}

type CustodianOption = {
  employee_id: string
  employee_name: string
  employee_role: string | null
}

type Custody = {
  id: string
  asset_id: string
  employee_id: string
  employee_name_snapshot: string
  status: "active" | "returned"
  issued_at: string
  due_at: string | null
  returned_at: string | null
  issue_condition: string | null
  return_condition: string | null
  issue_notes: string
  return_notes: string | null
  asset: { asset_code: string; name: string } | null
  issued_from: { name: string } | null
  returned_to: { name: string } | null
}

type Operation = "transfer" | "assignment" | "return"

const OPERATION_LABELS: Record<Operation, string> = {
  transfer: "Trasladar",
  assignment: "Entregar en custodia",
  return: "Recibir devolución",
}

const MOVEMENT_LABELS: Record<string, string> = {
  initial: "Carga inicial",
  receipt: "Recepción",
  transfer: "Traslado",
  assignment: "Custodia",
  return: "Devolución",
  retirement: "Retiro",
}

const CONDITION_LABELS: Record<string, string> = {
  good: "Buen estado",
  observations: "Con observaciones",
  damaged: "Dañado",
}

export function InventoryOperationsConsole() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { loading: accessLoading, can, canAccessDepartment } = useEffectiveAccess()
  const canOperate = can("inventory.process") && canAccessDepartment("inventory")
  const [assets, setAssets] = useState<Asset[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [custodians, setCustodians] = useState<CustodianOption[]>([])
  const [custodies, setCustodies] = useState<Custody[]>([])
  const [assetId, setAssetId] = useState("")
  const [operation, setOperation] = useState<Operation>("transfer")
  const [locationId, setLocationId] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [condition, setCondition] = useState("good")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (accessLoading) return
    if (!canOperate) {
      setAssets([])
      setLocations([])
      setMovements([])
      setCustodians([])
      setCustodies([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const [assetsResult, locationsResult, movementsResult, custodiansResult, custodiesResult] = await Promise.all([
      supabase.from("assets").select("id, asset_code, name, status, assigned_to, warehouse_location_id, warehouse_location:warehouse_locations(id, code, name, warehouse:warehouses(name))").neq("status", "deprecated").order("asset_code"),
      supabase.from("warehouse_locations").select("id, code, name, warehouse:warehouses(name)").eq("is_active", true).order("name"),
      supabase.from("inventory_movements").select("id, movement_type, assigned_to, notes, moved_at, asset:assets(asset_code, name), from_location:warehouse_locations!inventory_movements_from_location_id_fkey(name), to_location:warehouse_locations!inventory_movements_to_location_id_fkey(name)").order("moved_at", { ascending: false }).limit(12),
      supabase.rpc("list_inventory_custodians"),
      supabase.from("inventory_asset_custodies").select("id, asset_id, employee_id, employee_name_snapshot, status, issued_at, due_at, returned_at, issue_condition, return_condition, issue_notes, return_notes, asset:assets(asset_code, name), issued_from:warehouse_locations!inventory_asset_custodies_issued_from_location_id_fkey(name), returned_to:warehouse_locations!inventory_asset_custodies_returned_to_location_id_fkey(name)").order("issued_at", { ascending: false }).limit(20),
    ])
    const firstError = assetsResult.error || locationsResult.error || movementsResult.error || custodiansResult.error || custodiesResult.error
    if (firstError) setError(firstError.message)
    else {
      setAssets((assetsResult.data ?? []) as unknown as Asset[])
      setLocations((locationsResult.data ?? []) as unknown as Location[])
      setMovements((movementsResult.data ?? []) as unknown as Movement[])
      setCustodians((custodiansResult.data ?? []) as unknown as CustodianOption[])
      setCustodies((custodiesResult.data ?? []) as unknown as Custody[])
    }
    setLoading(false)
  }, [accessLoading, canOperate, supabase])

  useEffect(() => { void loadData() }, [loadData])

  const selected = assets.find((asset) => asset.id === assetId) ?? null
  const activeCustodies = useMemo(() => custodies.filter((custody) => custody.status === "active"), [custodies])
  const selectedCustody = selected ? activeCustodies.find((custody) => custody.asset_id === selected.id) ?? null : null
  const overdueCustodies = activeCustodies.filter((custody) => custody.due_at && new Date(custody.due_at).getTime() < Date.now())

  useEffect(() => {
    if (!selected) return
    setLocationId(selected.warehouse_location_id ?? "")
    setEmployeeId("")
    setDueDate("")
    setCondition("good")
  }, [selected])

  useEffect(() => {
    if (operation === "assignment" && selectedCustody) setError("Este activo ya tiene una custodia activa. Registra primero su devolución.")
    else setError(null)
  }, [operation, selectedCustody])

  async function executeOperation() {
    if (!canOperate) return setError("No tienes permiso para registrar movimientos de Inventario.")
    if (!selected) return setError("Selecciona un activo.")
    if (!reason.trim()) return setError("El motivo operativo es obligatorio.")
    if ((operation === "transfer" || operation === "return") && !locationId) return setError("Selecciona una ubicación de destino.")
    if (operation === "assignment" && !employeeId) return setError("Selecciona un custodio activo.")
    if (operation === "assignment" && selectedCustody) return setError("El activo ya tiene una custodia activa.")
    if (operation === "return" && !selectedCustody && !selected.assigned_to) return setError("El activo no tiene una custodia o asignación vigente.")

    setSaving(true)
    setError(null)

    let operationError: { message: string } | null = null
    if (operation === "transfer") {
      const result = await supabase.rpc("execute_inventory_asset_operation", {
        p_asset_id: selected.id,
        p_operation: "transfer",
        p_to_location_id: locationId,
        p_custodian: null,
        p_reason: reason.trim(),
      })
      operationError = result.error
    } else if (operation === "assignment") {
      const result = await supabase.rpc("assign_inventory_asset_custody", {
        p_asset_id: selected.id,
        p_employee_id: employeeId,
        p_reason: reason.trim(),
        p_due_at: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
        p_issue_condition: condition,
      })
      operationError = result.error
    } else {
      const result = await supabase.rpc("return_inventory_asset_custody", {
        p_asset_id: selected.id,
        p_to_location_id: locationId,
        p_reason: reason.trim(),
        p_return_condition: condition,
      })
      operationError = result.error
    }

    if (operationError) {
      setSaving(false)
      return setError(operationError.message)
    }

    toast({ title: "Operación registrada", description: `${selected.asset_code} · ${OPERATION_LABELS[operation]}` })
    setReason("")
    setAssetId("")
    setEmployeeId("")
    setDueDate("")
    setCondition("good")
    setSaving(false)
    await loadData()
  }

  if (accessLoading) return <div className="px-4 pt-4 text-sm text-muted-foreground md:px-6">Verificando acceso a Inventario…</div>
  if (!canOperate) return null

  return (
    <div className="px-4 pt-4 md:px-6 md:pt-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Operación y custodia de activos</CardTitle>
              <CardDescription>Traslados físicos y custodia formal por empleado. Cada entrega y devolución queda transaccionalmente ligada al kardex y a la bitácora del activo.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={overdueCustodies.length > 0 ? "destructive" : "outline"}>{activeCustodies.length} en custodia</Badge>
              {overdueCustodies.length > 0 && <Badge variant="destructive">{overdueCustodies.length} vencidas</Badge>}
              <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

          <div className="grid gap-3 lg:grid-cols-5">
            <select value={assetId} onChange={(event) => setAssetId(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm lg:col-span-2">
              <option value="">Seleccionar activo</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.asset_code} · {asset.name}</option>)}
            </select>
            <select value={operation} onChange={(event) => setOperation(event.target.value as Operation)} className="rounded-md border bg-background px-3 py-2 text-sm">
              <option value="transfer">Trasladar</option>
              <option value="assignment">Entregar en custodia</option>
              <option value="return">Recibir devolución</option>
            </select>
            {operation === "assignment" ? (
              <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Custodio</option>
                {custodians.map((custodian) => <option key={custodian.employee_id} value={custodian.employee_id}>{custodian.employee_name}{custodian.employee_role ? ` · ${custodian.employee_role}` : ""}</option>)}
              </select>
            ) : (
              <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Ubicación de destino</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.warehouse?.name ?? "Bodega"} · {location.name}</option>)}
              </select>
            )}
            <Button onClick={() => void executeOperation()} disabled={saving || !assetId || (operation === "assignment" && Boolean(selectedCustody))}>{saving ? "Registrando…" : OPERATION_LABELS[operation]}</Button>
          </div>

          {operation === "assignment" && <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Fecha esperada de devolución</label><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} min={new Date().toISOString().slice(0, 10)} /></div>
            <ConditionSelect value={condition} onChange={setCondition} label="Condición de entrega" />
          </div>}
          {operation === "return" && <ConditionSelect value={condition} onChange={setCondition} label="Condición al retornar" />}

          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo auditable: uso en terreno, cambio de ubicación, devolución, observación de condición, etc." />

          {selected && <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm md:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Ubicación actual</p><p className="font-medium">{selected.warehouse_location ? `${selected.warehouse_location.warehouse?.name ?? "Bodega"} · ${selected.warehouse_location.name}` : "Sin ubicación"}</p></div>
            <div><p className="text-xs text-muted-foreground">Custodio actual</p><p className="font-medium">{selectedCustody?.employee_name_snapshot || selected.assigned_to || "Sin custodia"}</p>{selected.assigned_to && !selectedCustody && <Badge variant="outline" className="mt-1">Asignación legacy</Badge>}</div>
            <div><p className="text-xs text-muted-foreground">Vencimiento</p><p className="font-medium">{selectedCustody?.due_at ? formatDate(selectedCustody.due_at) : "Sin vencimiento"}</p></div>
            <div><p className="text-xs text-muted-foreground">Estado</p><p className="font-medium">{selected.status}</p></div>
          </div>}

          <div className="grid gap-4 xl:grid-cols-2">
            <section>
              <div className="mb-2 flex items-center gap-2"><UserRoundCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Custodias recientes</h3></div>
              {custodies.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Todavía no existen custodias formalizadas.</p> : (
                <div className="divide-y rounded-lg border">
                  {custodies.slice(0, 8).map((custody) => <div key={custody.id} className="grid gap-2 p-3 text-sm md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                    <div><p className="font-medium">{custody.asset?.asset_code ?? "Activo"} · {custody.asset?.name ?? "Sin nombre"}</p><p className="text-xs text-muted-foreground">{custody.employee_name_snapshot}</p></div>
                    <div><p className="text-xs text-muted-foreground">Entrega / retorno</p><p>{formatDate(custody.issued_at)}{custody.returned_at ? ` → ${formatDate(custody.returned_at)}` : " → En custodia"}</p>{custody.due_at && custody.status === "active" && <p className={`text-xs ${new Date(custody.due_at).getTime() < Date.now() ? "text-destructive" : "text-muted-foreground"}`}>Vence {formatDate(custody.due_at)}</p>}</div>
                    <Badge variant={custody.status === "active" ? "default" : "outline"}>{custody.status === "active" ? "Activa" : "Devuelta"}</Badge>
                  </div>)}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2"><ClipboardList className="h-4 w-4" /><h3 className="text-sm font-semibold">Últimos movimientos</h3></div>
              {movements.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Todavía no existen movimientos registrados.</p> : (
                <div className="divide-y rounded-lg border">
                  {movements.slice(0, 8).map((movement) => <div key={movement.id} className="grid gap-2 p-3 text-sm md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                    <div><p className="font-medium">{movement.asset?.asset_code ?? "Activo"} · {movement.asset?.name ?? "Sin nombre"}</p><p className="text-xs text-muted-foreground">{MOVEMENT_LABELS[movement.movement_type] ?? movement.movement_type}</p></div>
                    <div><p className="text-xs text-muted-foreground">Ruta / motivo</p><p>{movement.from_location?.name ?? "Sin origen"} → {movement.to_location?.name ?? "Sin destino"}{movement.notes ? ` · ${movement.notes}` : ""}</p></div>
                    <time className="text-xs text-muted-foreground">{formatDateTime(movement.moved_at)}</time>
                  </div>)}
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border p-3"><ArrowLeftRight className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm font-medium">Traslado atómico</p><p className="text-xs text-muted-foreground">Mueve el activo entre ubicaciones autorizadas.</p></div></div>
            <div className="flex items-center gap-3 rounded-lg border p-3"><CalendarClock className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm font-medium">Custodia con vencimiento</p><p className="text-xs text-muted-foreground">Empleado, condición y fecha esperada quedan registrados.</p></div></div>
            <div className="flex items-center gap-3 rounded-lg border p-3"><PackageCheck className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm font-medium">Devolución trazable</p><p className="text-xs text-muted-foreground">Cierra custodia y devuelve el activo a una posición física.</p></div></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ConditionSelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="good">Buen estado</option><option value="observations">Con observaciones</option><option value="damaged">Dañado</option></select><p className="text-xs text-muted-foreground">{CONDITION_LABELS[value]}</p></div>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short" }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}