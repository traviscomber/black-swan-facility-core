"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, ClipboardList, PackageCheck, RefreshCw, UserRoundCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

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

type Operation = "transfer" | "assignment" | "return"

const OPERATION_LABELS: Record<Operation, string> = {
  transfer: "Trasladar",
  assignment: "Asignar custodio",
  return: "Devolver a bodega",
}

const MOVEMENT_LABELS: Record<string, string> = {
  initial: "Carga inicial",
  receipt: "Recepción",
  transfer: "Traslado",
  assignment: "Asignación",
  return: "Devolución",
  retirement: "Retiro",
}

export function InventoryOperationsConsole() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [assets, setAssets] = useState<Asset[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [assetId, setAssetId] = useState("")
  const [operation, setOperation] = useState<Operation>("transfer")
  const [locationId, setLocationId] = useState("")
  const [custodian, setCustodian] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [assetsResult, locationsResult, movementsResult] = await Promise.all([
      supabase.from("assets").select("id, asset_code, name, status, assigned_to, warehouse_location_id, warehouse_location:warehouse_locations(id, code, name, warehouse:warehouses(name))").neq("status", "deprecated").order("asset_code"),
      supabase.from("warehouse_locations").select("id, code, name, warehouse:warehouses(name)").eq("is_active", true).order("name"),
      supabase.from("inventory_movements").select("id, movement_type, assigned_to, notes, moved_at, asset:assets(asset_code, name), from_location:warehouse_locations!inventory_movements_from_location_id_fkey(name), to_location:warehouse_locations!inventory_movements_to_location_id_fkey(name)").order("moved_at", { ascending: false }).limit(12),
    ])
    const firstError = assetsResult.error || locationsResult.error || movementsResult.error
    if (firstError) setError(firstError.message)
    else {
      setAssets((assetsResult.data ?? []) as unknown as Asset[])
      setLocations((locationsResult.data ?? []) as unknown as Location[])
      setMovements((movementsResult.data ?? []) as unknown as Movement[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadData() }, [loadData])

  const selected = assets.find((asset) => asset.id === assetId) ?? null

  useEffect(() => {
    if (!selected) return
    setLocationId(selected.warehouse_location_id ?? "")
    setCustodian(selected.assigned_to ?? "")
  }, [selected])

  async function executeOperation() {
    if (!selected) return setError("Selecciona un activo.")
    if (!reason.trim()) return setError("El motivo operativo es obligatorio.")
    if ((operation === "transfer" || operation === "return") && !locationId) return setError("Selecciona una ubicación de destino.")
    if (operation === "assignment" && !custodian.trim()) return setError("Indica el responsable o custodio.")
    if (operation === "transfer" && locationId === selected.warehouse_location_id) return setError("La ubicación de destino debe ser distinta a la actual.")

    setSaving(true)
    setError(null)
    const now = new Date().toISOString()
    const nextLocationId = operation === "assignment" ? selected.warehouse_location_id : locationId
    const nextCustodian = operation === "assignment" ? custodian.trim() : operation === "return" ? null : selected.assigned_to
    const destination = locations.find((item) => item.id === nextLocationId)
    const canonicalLocation = destination ? `${destination.warehouse?.name ?? "Bodega"} · ${destination.name}` : null

    const { error: updateError } = await supabase.from("assets").update({
      warehouse_location_id: nextLocationId,
      location: canonicalLocation,
      assigned_to: nextCustodian,
      updated_at: now,
    }).eq("id", selected.id)

    if (updateError) {
      setSaving(false)
      return setError(updateError.message)
    }

    const { error: movementError } = await supabase.from("inventory_movements").insert({
      asset_id: selected.id,
      movement_type: operation,
      from_location_id: selected.warehouse_location_id,
      to_location_id: nextLocationId,
      assigned_to: nextCustodian,
      notes: reason.trim(),
      moved_at: now,
    })

    if (movementError) {
      setSaving(false)
      return setError(`El activo se actualizó, pero no se pudo registrar el movimiento: ${movementError.message}`)
    }

    await supabase.from("asset_logs").insert({
      asset_id: selected.id,
      log_type: operation,
      description: `${OPERATION_LABELS[operation]}. ${reason.trim()}`,
      created_at: now,
    })

    toast({ title: "Operación registrada", description: `${selected.asset_code} · ${OPERATION_LABELS[operation]}` })
    setReason("")
    setAssetId("")
    setSaving(false)
    await loadData()
  }

  return (
    <div className="px-4 pt-4 md:px-6 md:pt-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><ArrowLeftRight className="h-4 w-4" /> Movimientos y custodia</CardTitle>
              <CardDescription>Separa traslados, asignaciones y devoluciones de la edición de la ficha maestra. Cada operación exige motivo y conserva trazabilidad.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button>
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
              <option value="assignment">Asignar custodio</option>
              <option value="return">Devolver a bodega</option>
            </select>
            {(operation === "transfer" || operation === "return") ? (
              <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Ubicación de destino</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.warehouse?.name ?? "Bodega"} · {location.name}</option>)}
              </select>
            ) : <Input value={custodian} onChange={(event) => setCustodian(event.target.value)} placeholder="Responsable o custodio" />}
            <Button onClick={() => void executeOperation()} disabled={saving || !assetId}>{saving ? "Registrando…" : OPERATION_LABELS[operation]}</Button>
          </div>

          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo obligatorio: traslado por operación, entrega a responsable, devolución, etc." />

          {selected && <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm md:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Ubicación actual</p><p className="font-medium">{selected.warehouse_location ? `${selected.warehouse_location.warehouse?.name ?? "Bodega"} · ${selected.warehouse_location.name}` : "Sin ubicación"}</p></div>
            <div><p className="text-xs text-muted-foreground">Custodio actual</p><p className="font-medium">{selected.assigned_to || "Sin asignar"}</p></div>
            <div><p className="text-xs text-muted-foreground">Estado</p><p className="font-medium">{selected.status}</p></div>
          </div>}

          <div>
            <div className="mb-2 flex items-center gap-2"><ClipboardList className="h-4 w-4" /><h3 className="text-sm font-semibold">Últimos movimientos</h3></div>
            {movements.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Todavía no existen movimientos registrados.</p> : (
              <div className="divide-y rounded-lg border">
                {movements.map((movement) => <div key={movement.id} className="grid gap-2 p-3 text-sm md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                  <div><p className="font-medium">{movement.asset?.asset_code ?? "Activo"} · {movement.asset?.name ?? "Sin nombre"}</p><p className="text-xs text-muted-foreground">{MOVEMENT_LABELS[movement.movement_type] ?? movement.movement_type}</p></div>
                  <div><p className="text-xs text-muted-foreground">Ruta</p><p>{movement.from_location?.name ?? "Sin origen"} → {movement.to_location?.name ?? "Sin destino"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Custodia / motivo</p><p>{movement.assigned_to || "Sin custodio"}{movement.notes ? ` · ${movement.notes}` : ""}</p></div>
                  <time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(movement.moved_at))}</time>
                </div>)}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border p-3"><ArrowLeftRight className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm font-medium">Traslado</p><p className="text-xs text-muted-foreground">Cambia posición y conserva origen/destino.</p></div></div>
            <div className="flex items-center gap-3 rounded-lg border p-3"><UserRoundCheck className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm font-medium">Asignación</p><p className="text-xs text-muted-foreground">Registra quién mantiene la custodia.</p></div></div>
            <div className="flex items-center gap-3 rounded-lg border p-3"><PackageCheck className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm font-medium">Devolución</p><p className="text-xs text-muted-foreground">Limpia el custodio y devuelve a una posición.</p></div></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
