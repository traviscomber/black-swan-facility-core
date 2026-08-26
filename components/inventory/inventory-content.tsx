"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Boxes, Package, Plus, RefreshCw, Search, UserRound, Warehouse } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { InventoryTable } from "@/components/inventory/inventory-table"
import { InventoryForm } from "@/components/inventory/inventory-form"
import type { InventoryAsset, InventoryMetadataOption, WarehouseInfo } from "@/components/inventory/types"
import { useToast } from "@/hooks/use-toast"

type OperationalView = "all" | "equipment" | "infrastructure" | "storage" | "assigned" | "review"

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  maintenance: "En mantenimiento",
  deprecated: "Retirado",
}

const VIEW_OPTIONS: Array<{ value: OperationalView; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "equipment", label: "Equipos" },
  { value: "infrastructure", label: "Infraestructura" },
  { value: "storage", label: "En bodega" },
  { value: "assigned", label: "Asignados" },
  { value: "review", label: "Pendientes" },
]

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function needsReview(asset: InventoryAsset) {
  return !asset.category_id || !asset.cost_center_id || !asset.warehouse_location_id
}

export function InventoryContent() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [assets, setAssets] = useState<InventoryAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedWarehouse, setSelectedWarehouse] = useState("all")
  const [operationalView, setOperationalView] = useState<OperationalView>("all")
  const [showForm, setShowForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<InventoryAsset | null>(null)
  const [categories, setCategories] = useState<InventoryMetadataOption[]>([])
  const [costCenters, setCostCenters] = useState<InventoryMetadataOption[]>([])
  const [retirementTarget, setRetirementTarget] = useState<InventoryAsset | null>(null)
  const [retirementReason, setRetirementReason] = useState("")
  const [submittingRetirement, setSubmittingRetirement] = useState(false)

  const loadAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("assets")
      .select("id, asset_code, name, description, status, location, assigned_to, photo_url, qr_code_url, purchase_price, purchase_date, serial_number, brand, model, notes, created_at, category_id, cost_center_id, warehouse_location_id, asset_class, asset_categories(name, color), cost_centers(name, code), warehouse_locations(id, code, name, warehouses(id, code, name))")
      .order("created_at", { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setAssets([])
    } else {
      setAssets((data ?? []).map((asset) => {
        const location = firstRelation(asset.warehouse_locations)
        return {
          ...asset,
          category: firstRelation(asset.asset_categories),
          cost_center: firstRelation(asset.cost_centers),
          warehouse_location: location
            ? {
                id: location.id,
                code: location.code,
                name: location.name,
                warehouse: firstRelation(location.warehouses),
              }
            : null,
        } satisfies InventoryAsset
      }))
    }
    setLoading(false)
  }, [supabase])

  const loadMetadata = useCallback(async () => {
    const [categoriesResult, costCentersResult] = await Promise.all([
      supabase.from("asset_categories").select("id, name, code, color").eq("is_active", true).order("name"),
      supabase.from("cost_centers").select("id, name, code").eq("is_active", true).order("name"),
    ])
    if (categoriesResult.error || costCentersResult.error) {
      setError(categoriesResult.error?.message ?? costCentersResult.error?.message ?? "No fue posible cargar la configuración de inventario.")
      return
    }
    setCategories(categoriesResult.data ?? [])
    setCostCenters(costCentersResult.data ?? [])
  }, [supabase])

  useEffect(() => { void Promise.all([loadAssets(), loadMetadata()]) }, [loadAssets, loadMetadata])

  const warehouses = useMemo(() => {
    const map = new Map<string, WarehouseInfo>()
    assets.forEach((asset) => {
      const warehouse = asset.warehouse_location?.warehouse
      if (warehouse) map.set(warehouse.id, warehouse)
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "es"))
  }, [assets])

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    const term = searchTerm.trim().toLowerCase()
    const warehouse = asset.warehouse_location?.warehouse
    const matchesSearch = !term || [asset.name, asset.asset_code, asset.location, asset.assigned_to, asset.brand, asset.model, asset.serial_number, warehouse?.name, asset.warehouse_location?.name]
      .some((value) => value?.toLowerCase().includes(term))
    const matchesCategory = selectedCategory === "all" || asset.category_id === selectedCategory
    const matchesStatus = selectedStatus === "all" || asset.status === selectedStatus
    const matchesWarehouse = selectedWarehouse === "all" || warehouse?.id === selectedWarehouse
    const matchesView = operationalView === "all"
      || (operationalView === "equipment" && asset.asset_class === "equipment")
      || (operationalView === "infrastructure" && asset.asset_class === "infrastructure")
      || (operationalView === "storage" && Boolean(asset.warehouse_location_id) && !asset.assigned_to?.trim())
      || (operationalView === "assigned" && Boolean(asset.assigned_to?.trim()))
      || (operationalView === "review" && needsReview(asset))
    return matchesSearch && matchesCategory && matchesStatus && matchesWarehouse && matchesView
  }), [assets, operationalView, searchTerm, selectedCategory, selectedStatus, selectedWarehouse])

  const registeredValue = filteredAssets.reduce((sum, asset) => sum + Number(asset.purchase_price ?? 0), 0)
  const equipmentCount = assets.filter((asset) => asset.asset_class === "equipment").length
  const infrastructureCount = assets.filter((asset) => asset.asset_class === "infrastructure").length
  const assignedCount = assets.filter((asset) => Boolean(asset.assigned_to?.trim())).length
  const pendingReview = assets.filter(needsReview).length
  const availableStatuses = Array.from(new Set(assets.map((asset) => asset.status).filter(Boolean))).sort()

  const warehouseCards = warehouses.map((warehouse) => {
    const warehouseAssets = assets.filter((asset) => asset.warehouse_location?.warehouse?.id === warehouse.id && asset.status !== "deprecated")
    const positions = new Set(warehouseAssets.map((asset) => asset.warehouse_location?.name).filter(Boolean))
    return { ...warehouse, assetCount: warehouseAssets.length, positionCount: positions.size }
  })

  const handleFormClose = () => { setShowForm(false); setEditingAsset(null) }

  const openRetirementRequest = (id: string) => {
    const asset = assets.find((item) => item.id === id)
    if (!asset || asset.status === "deprecated") return
    setRetirementTarget(asset)
    setRetirementReason("")
  }

  const closeRetirementRequest = () => {
    if (submittingRetirement) return
    setRetirementTarget(null)
    setRetirementReason("")
  }

  const submitRetirementRequest = async () => {
    if (!retirementTarget || !retirementReason.trim() || submittingRetirement) return
    setSubmittingRetirement(true)
    const { error: retirementError } = await supabase.rpc("request_inventory_asset_retirement", {
      p_asset_id: retirementTarget.id,
      p_reason: retirementReason.trim(),
    })
    setSubmittingRetirement(false)

    if (retirementError) {
      toast({ title: "No se pudo crear la solicitud", description: retirementError.message, variant: "destructive" })
      return
    }

    toast({
      title: "Solicitud de baja creada",
      description: `${retirementTarget.name} continúa activo hasta que un aprobador revise y ejecute la baja.`,
    })
    closeRetirementRequest()
    await loadAssets()
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operaciones · Fundo Corcovado</p>
            <h1 className="text-3xl font-semibold tracking-tight">Inventario, bodegas y equipos</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Control de activos individuales por clase, bodega, posición de resguardo y responsable. Las bajas requieren solicitud, aprobación y ejecución con trazabilidad.</p>
          </div>
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Registrar equipo o activo</Button>
        </div>

        {error && <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><span>No fue posible cargar inventario: {error}</span><Button variant="outline" size="sm" onClick={() => void Promise.all([loadAssets(), loadMetadata()])}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric title="Activos registrados" value={assets.length.toLocaleString("es-CL")} icon={Package} />
          <Metric title="Equipos" value={equipmentCount.toLocaleString("es-CL")} icon={Boxes} />
          <Metric title="Infraestructura" value={infrastructureCount.toLocaleString("es-CL")} icon={Warehouse} />
          <Metric title="Con responsable" value={assignedCount.toLocaleString("es-CL")} icon={UserRound} />
          <Metric title="Pendientes de completar" value={pendingReview.toLocaleString("es-CL")} alert={pendingReview > 0} icon={AlertTriangle} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {warehouseCards.map((warehouse) => (
            <Card key={warehouse.id} className={selectedWarehouse === warehouse.id ? "border-primary" : undefined}>
              <CardHeader className="pb-2"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{warehouse.name}</CardTitle><CardDescription>{warehouse.code}</CardDescription></div><Warehouse className="h-5 w-5 text-muted-foreground" /></div></CardHeader>
              <CardContent><div className="flex items-end justify-between gap-4"><div><p className="text-2xl font-semibold">{warehouse.assetCount}</p><p className="text-xs text-muted-foreground">activos en {warehouse.positionCount} {warehouse.positionCount === 1 ? "posición" : "posiciones"}</p></div><Button size="sm" variant={selectedWarehouse === warehouse.id ? "default" : "outline"} onClick={() => setSelectedWarehouse(selectedWarehouse === warehouse.id ? "all" : warehouse.id)}>{selectedWarehouse === warehouse.id ? "Ver todos" : "Filtrar"}</Button></div></CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Vista operativa</CardTitle><CardDescription>Consulta por clase de activo, custodia, bodega, categoría y estado.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">{VIEW_OPTIONS.map((option) => <Button key={option.value} type="button" size="sm" variant={operationalView === option.value ? "default" : "outline"} onClick={() => setOperationalView(option.value)}>{option.label}</Button>)}</div>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="relative md:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por activo, código, bodega, posición, responsable o serie" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
              <select value={selectedWarehouse} onChange={(event) => setSelectedWarehouse(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="all">Todas las bodegas</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select>
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="all">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="all">Todos los estados</option>{availableStatuses.map((status) => <option key={status} value={status}>{STATUS_LABELS[status] ?? status}</option>)}</select>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{filteredAssets.length.toLocaleString("es-CL")} registros visibles</span><span>Valor de compra visible: {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(registeredValue)}</span></div>

        {loading ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Cargando inventario…</CardContent></Card> : filteredAssets.length === 0 ? <Card><CardContent className="py-12 text-center"><Package className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">No hay registros para esta vista.</p><p className="mt-1 text-sm text-muted-foreground">Ajusta los filtros o registra un nuevo equipo o activo.</p></CardContent></Card> : <InventoryTable assets={filteredAssets} loading={false} onEdit={setEditingAsset} onDelete={openRetirementRequest} onEditClick={() => setShowForm(true)} />}

        {showForm && <InventoryForm asset={editingAsset} categories={categories} costCenters={costCenters} onClose={handleFormClose} onSuccess={async () => { await loadAssets(); handleFormClose() }} />}
      </div>

      <Dialog open={Boolean(retirementTarget)} onOpenChange={(open) => { if (!open) closeRetirementRequest() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar baja de activo</DialogTitle>
            <DialogDescription>{retirementTarget ? `${retirementTarget.name} (${retirementTarget.asset_code}) seguirá activo hasta que un aprobador revise y ejecute la baja.` : "La baja requiere aprobación."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="retirement-reason" className="text-sm font-medium">Motivo obligatorio</label>
            <textarea id="retirement-reason" className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm" value={retirementReason} onChange={(event) => setRetirementReason(event.target.value)} placeholder="Describe la causa, condición del activo y cualquier referencia operacional relevante." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRetirementRequest} disabled={submittingRetirement}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void submitRetirementRequest()} disabled={submittingRetirement || !retirementReason.trim()}>{submittingRetirement ? "Registrando…" : "Crear solicitud"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

function Metric({ title, value, alert = false, icon: Icon }: { title: string; value: string; alert?: boolean; icon: typeof Package }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></div></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div></CardContent></Card>
}
