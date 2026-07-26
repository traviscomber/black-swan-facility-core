"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Boxes, Package, Plus, RefreshCw, Search, UserRound, Warehouse } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { InventoryTable } from "@/components/inventory/inventory-table"
import { InventoryForm } from "@/components/inventory/inventory-form"
import { useToast } from "@/hooks/use-toast"

interface Asset {
  id: string
  asset_code: string
  name: string
  description?: string | null
  category_id?: string | null
  cost_center_id?: string | null
  category?: { name: string; color?: string | null } | null
  cost_center?: { name: string; code?: string | null } | null
  serial_number?: string | null
  brand?: string | null
  model?: string | null
  purchase_date?: string | null
  status: string
  location?: string | null
  assigned_to?: string | null
  notes?: string | null
  photo_url?: string | null
  qr_code_url?: string | null
  purchase_price?: number | null
  created_at: string
}

type AssetRow = Omit<Asset, "category" | "cost_center"> & {
  asset_categories?: { name: string; color?: string | null } | null
  cost_centers?: { name: string; code?: string | null } | null
}

interface MetadataOption {
  id: string
  name: string
  code?: string | null
  color?: string | null
}

type OperationalView = "all" | "equipment" | "storage" | "assigned" | "review"

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  maintenance: "En mantenimiento",
  deprecated: "Retirado",
}

const VIEW_OPTIONS: Array<{ value: OperationalView; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "equipment", label: "Equipos identificados" },
  { value: "storage", label: "En resguardo" },
  { value: "assigned", label: "Asignados" },
  { value: "review", label: "Pendientes de completar" },
]

function isIdentifiedEquipment(asset: Asset) {
  return Boolean(asset.brand?.trim() || asset.model?.trim() || asset.serial_number?.trim())
}

function isInStorage(asset: Asset) {
  return Boolean(asset.location?.trim()) && !asset.assigned_to?.trim() && asset.status !== "deprecated"
}

function needsReview(asset: Asset) {
  return !asset.category_id || !asset.cost_center_id || !asset.location?.trim()
}

export function InventoryContent() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [operationalView, setOperationalView] = useState<OperationalView>("all")
  const [showForm, setShowForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [categories, setCategories] = useState<MetadataOption[]>([])
  const [costCenters, setCostCenters] = useState<MetadataOption[]>([])

  const loadAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("assets")
      .select("id, asset_code, name, description, status, location, assigned_to, photo_url, qr_code_url, purchase_price, purchase_date, serial_number, brand, model, notes, created_at, category_id, cost_center_id, asset_categories(name, color), cost_centers(name, code)")
      .order("created_at", { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setAssets([])
    } else {
      setAssets(((data ?? []) as AssetRow[]).map((asset) => ({
        ...asset,
        category: asset.asset_categories ?? null,
        cost_center: asset.cost_centers ?? null,
      })))
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
    setCategories((categoriesResult.data ?? []) as MetadataOption[])
    setCostCenters((costCentersResult.data ?? []) as MetadataOption[])
  }, [supabase])

  useEffect(() => { void Promise.all([loadAssets(), loadMetadata()]) }, [loadAssets, loadMetadata])

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    const term = searchTerm.trim().toLowerCase()
    const matchesSearch = !term || [asset.name, asset.asset_code, asset.location, asset.assigned_to, asset.brand, asset.model, asset.serial_number]
      .some((value) => value?.toLowerCase().includes(term))
    const matchesCategory = selectedCategory === "all" || asset.category_id === selectedCategory
    const matchesStatus = selectedStatus === "all" || asset.status === selectedStatus
    const matchesView = operationalView === "all"
      || (operationalView === "equipment" && isIdentifiedEquipment(asset))
      || (operationalView === "storage" && isInStorage(asset))
      || (operationalView === "assigned" && Boolean(asset.assigned_to?.trim()))
      || (operationalView === "review" && needsReview(asset))
    return matchesSearch && matchesCategory && matchesStatus && matchesView
  }), [assets, operationalView, searchTerm, selectedCategory, selectedStatus])

  const registeredValue = filteredAssets.reduce((sum, asset) => sum + Number(asset.purchase_price ?? 0), 0)
  const identifiedEquipment = assets.filter(isIdentifiedEquipment).length
  const inStorage = assets.filter(isInStorage).length
  const assigned = assets.filter((asset) => Boolean(asset.assigned_to?.trim())).length
  const pendingReview = assets.filter(needsReview).length
  const availableStatuses = Array.from(new Set(assets.map((asset) => asset.status).filter(Boolean))).sort()

  const handleFormClose = () => { setShowForm(false); setEditingAsset(null) }

  const handleRetire = async (id: string) => {
    const asset = assets.find((item) => item.id === id)
    if (!asset || asset.status === "deprecated") return
    if (!window.confirm(`¿Marcar “${asset.name}” (${asset.asset_code}) como retirado? El registro y sus vínculos se conservarán.`)) return

    const { error: updateError } = await supabase.from("assets").update({ status: "deprecated", updated_at: new Date().toISOString() }).eq("id", id)
    if (updateError) {
      toast({ title: "No se pudo retirar", description: updateError.message, variant: "destructive" })
      return
    }
    toast({ title: "Activo retirado", description: `${asset.name} permanece en el registro canónico con estado Retirado.` })
    await loadAssets()
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Inventario · Fundo Corcovado</p>
            <h1 className="text-3xl font-semibold tracking-tight">Inventario, bodega y equipos</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Registro de equipos serializables, activos operativos, responsables y ubicaciones de resguardo. Los valores corresponden a precios de compra registrados, no a valorizaciones contables actuales.</p>
          </div>
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Registrar equipo o activo</Button>
        </div>

        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="flex gap-3 p-4 text-sm">
            <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <div><p className="font-medium">Alcance actual del módulo</p><p className="mt-1 text-muted-foreground">La base registra activos individuales. Todavía no existe control de stock consumible, cantidades, entradas, salidas ni ubicaciones jerárquicas de bodega. La vista separa custodia y equipos sin inventar movimientos que no están registrados.</p></div>
          </CardContent>
        </Card>

        {assets.length <= 6 && !loading && !error && <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">Cobertura de inventario aún limitada</p><p className="mt-1">El sistema contiene {assets.length} registros. Cinco son activos heredados de infraestructura y solo uno tiene marca, modelo, serie y responsable completos.</p></div></div>}

        {error && <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><span>No fue posible cargar inventario: {error}</span><Button variant="outline" size="sm" onClick={() => void Promise.all([loadAssets(), loadMetadata()])}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric title="Registros totales" value={assets.length.toLocaleString("es-CL")} icon={Package} />
          <Metric title="Equipos identificados" value={identifiedEquipment.toLocaleString("es-CL")} icon={Boxes} />
          <Metric title="En ubicación de resguardo" value={inStorage.toLocaleString("es-CL")} icon={Warehouse} />
          <Metric title="Con responsable" value={assigned.toLocaleString("es-CL")} icon={UserRound} />
          <Metric title="Pendientes de completar" value={pendingReview.toLocaleString("es-CL")} alert={pendingReview > 0} icon={AlertTriangle} />
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Vista operativa</CardTitle><CardDescription>Separa equipos identificados, activos en resguardo, asignaciones y registros incompletos.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">{VIEW_OPTIONS.map((option) => <Button key={option.value} type="button" size="sm" variant={operationalView === option.value ? "default" : "outline"} onClick={() => setOperationalView(option.value)}>{option.label}</Button>)}</div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="relative md:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por equipo, código, ubicación, responsable o serie" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="all">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="all">Todos los estados</option>{availableStatuses.map((status) => <option key={status} value={status}>{STATUS_LABELS[status] ?? status}</option>)}</select>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{filteredAssets.length.toLocaleString("es-CL")} registros visibles</span><span>Valor de compra visible: {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(registeredValue)}</span></div>

        {loading ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Cargando inventario…</CardContent></Card> : filteredAssets.length === 0 ? <Card><CardContent className="py-12 text-center"><Package className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">No hay registros para esta vista.</p><p className="mt-1 text-sm text-muted-foreground">Ajusta los filtros o registra un nuevo equipo o activo.</p></CardContent></Card> : <InventoryTable assets={filteredAssets} loading={false} onEdit={setEditingAsset} onDelete={handleRetire} onEditClick={() => setShowForm(true)} />}

        {showForm && <InventoryForm asset={editingAsset} categories={categories} costCenters={costCenters} onClose={handleFormClose} onSuccess={async () => { await loadAssets(); handleFormClose() }} />}
      </div>
    </AppLayout>
  )
}

function Metric({ title, value, alert = false, icon: Icon }: { title: string; value: string; alert?: boolean; icon: typeof Package }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></div></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div></CardContent></Card>
}
