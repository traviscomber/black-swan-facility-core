"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, History, MapPin, RefreshCw, Warehouse } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"

type WarehouseRow = {
  id: string
  code: string
  name: string
  is_active: boolean
  warehouse_locations: Array<{ id: string; name: string; code: string; is_active: boolean }> | null
}

type AssetRow = {
  id: string
  warehouse_location_id: string | null
  category_id: string | null
  cost_center_id: string | null
  asset_code: string
  status: string | null
}

type MovementRow = {
  id: string
  asset_id: string
  movement_type: string
  moved_at: string
  moved_by: string | null
  from_location_id: string | null
  to_location_id: string | null
}

export function InventoryHealthPanel() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [warehousesResult, assetsResult, movementsResult] = await Promise.all([
      supabase.from("warehouses").select("id, code, name, is_active, warehouse_locations(id, name, code, is_active)").order("name"),
      supabase.from("assets").select("id, warehouse_location_id, category_id, cost_center_id, asset_code, status"),
      supabase.from("inventory_movements").select("id, asset_id, movement_type, moved_at, moved_by, from_location_id, to_location_id").order("moved_at", { ascending: false }).limit(100),
    ])

    const firstError = warehousesResult.error || assetsResult.error || movementsResult.error
    if (firstError) {
      setError(firstError.message)
      setWarehouses([])
      setAssets([])
      setMovements([])
    } else {
      setWarehouses((warehousesResult.data ?? []) as WarehouseRow[])
      setAssets((assetsResult.data ?? []) as AssetRow[])
      setMovements((movementsResult.data ?? []) as MovementRow[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const locationToWarehouse = useMemo(() => {
    const map = new Map<string, string>()
    warehouses.forEach((warehouse) => warehouse.warehouse_locations?.forEach((location) => map.set(location.id, warehouse.id)))
    return map
  }, [warehouses])

  const warehouseCoverage = useMemo(() => warehouses.filter((warehouse) => warehouse.is_active).map((warehouse) => {
    const activeLocations = warehouse.warehouse_locations?.filter((location) => location.is_active) ?? []
    const assetCount = assets.filter((asset) => asset.warehouse_location_id && locationToWarehouse.get(asset.warehouse_location_id) === warehouse.id && asset.status !== "deprecated").length
    return { ...warehouse, activeLocations: activeLocations.length, assetCount }
  }), [assets, locationToWarehouse, warehouses])

  const incompleteAssets = assets.filter((asset) => !asset.category_id || !asset.cost_center_id || !asset.warehouse_location_id)
  const untrackedMovements = movements.filter((movement) => !movement.moved_by)
  const movementWithoutDestination = movements.filter((movement) => movement.movement_type !== "retirement" && movement.movement_type !== "initial" && !movement.to_location_id)
  const issueCount = incompleteAssets.length + untrackedMovements.length + movementWithoutDestination.length

  return (
    <Card className="mx-4 mt-4 md:mx-6">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Warehouse className="h-4 w-4" /> Salud de inventario</CardTitle>
            <CardDescription>Control de cobertura de bodegas, completitud de activos y trazabilidad de movimientos.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={issueCount === 0 ? "default" : "destructive"}>{issueCount === 0 ? "Sin observaciones" : `${issueCount} observaciones`}</Badge>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">No fue posible revisar la salud del inventario: {error}</div>}

        <div className="grid gap-3 sm:grid-cols-3">
          <HealthMetric icon={incompleteAssets.length ? AlertTriangle : CheckCircle2} label="Activos incompletos" value={incompleteAssets.length} detail="Sin categoría, centro de costo o posición" alert={incompleteAssets.length > 0} />
          <HealthMetric icon={untrackedMovements.length ? AlertTriangle : History} label="Movimientos sin responsable" value={untrackedMovements.length} detail="Últimos 100 movimientos revisados" alert={untrackedMovements.length > 0} />
          <HealthMetric icon={movementWithoutDestination.length ? AlertTriangle : MapPin} label="Movimientos sin destino" value={movementWithoutDestination.length} detail="Excluye carga inicial y retiros" alert={movementWithoutDestination.length > 0} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {warehouseCoverage.map((warehouse) => (
            <div key={warehouse.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-medium">{warehouse.name}</p><p className="text-xs text-muted-foreground">{warehouse.code}</p></div>
                <Badge variant="outline">{warehouse.assetCount} activos</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{warehouse.activeLocations} {warehouse.activeLocations === 1 ? "posición activa" : "posiciones activas"}</p>
              {warehouse.assetCount === 0 && <p className="mt-2 text-xs text-amber-700">Bodega activa sin activos asignados.</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function HealthMetric({ icon: Icon, label, value, detail, alert }: { icon: typeof AlertTriangle; label: string; value: number; detail: string; alert: boolean }) {
  return <div className={`rounded-lg border p-3 ${alert ? "border-amber-300 bg-amber-50/50" : ""}`}><div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${alert ? "text-amber-700" : "text-muted-foreground"}`} /><span className="text-sm font-medium">{label}</span></div><p className="mt-2 text-2xl font-semibold">{value.toLocaleString("es-CL")}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
}
