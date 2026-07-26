"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Package, Plus, RefreshCw, Search } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

interface MetadataOption {
  id: string
  name: string
  code?: string | null
  color?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  maintenance: "En mantenimiento",
  deprecated: "Retirado",
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
  const [showForm, setShowForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [categories, setCategories] = useState<MetadataOption[]>([])
  const [costCenters, setCostCenters] = useState<MetadataOption[]>([])

  const loadAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("assets")
      .select(`id, asset_code, name, description, status, location, assigned_to, photo_url, qr_code_url, purchase_price, purchase_date, serial_number, brand, model, notes, created_at, category_id, cost_center_id, asset_categories(name, color), cost_centers(name, code)`)
      .order("created_at", { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setAssets([])
    } else {
      setAssets((data ?? []).map((asset: any) => ({ ...asset, category: asset.asset_categories, cost_center: asset.cost_centers })))
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
    const matchesSearch = !term || asset.name.toLowerCase().includes(term) || asset.asset_code.toLowerCase().includes(term) || asset.location?.toLowerCase().includes(term)
    const matchesCategory = selectedCategory === "all" || asset.category_id === selectedCategory
    const matchesStatus = selectedStatus === "all" || asset.status === selectedStatus
    return matchesSearch && matchesCategory && matchesStatus
  }), [assets, searchTerm, selectedCategory, selectedStatus])

  const registeredValue = filteredAssets.reduce((sum, asset) => sum + Number(asset.purchase_price ?? 0), 0)
  const withoutLocation = filteredAssets.filter((asset) => !asset.location?.trim()).length
  const withoutAssignment = filteredAssets.filter((asset) => !asset.assigned_to?.trim()).length
  const availableStatuses = Array.from(new Set(assets.map((asset) => asset.status).filter(Boolean))).sort()

  const handleFormClose = () => { setShowForm(false); setEditingAsset(null) }

  const handleRetire = async (id: string) => {
    const asset = assets.find((item) => item.id === id)
    if (!asset || asset.status === "deprecated") return
    if (!window.confirm(`¿Marcar “${asset.name}” (${asset.asset_code}) como retirado? El registro y sus vínculos se conservarán.`)) return

    const { error: updateError } = await supabase
      .from("assets")
      .update({ status: "deprecated", updated_at: new Date().toISOString() })
      .eq("id", id)

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
            <h1 className="text-3xl font-semibold tracking-tight">Activos registrados</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Registro canónico de activos operativos, equipos, herramientas y bienes asociados a la operación. Los valores corresponden a precios de compra registrados, no a valorizaciones contables actuales.</p>
          </div>
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Registrar activo</Button>
        </div>

        {assets.length <= 6 && !loading && !error && (
          <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div><p className="font-medium">Cobertura de inventario aún limitada</p><p className="mt-1">El sistema contiene {assets.length} activo{assets.length === 1 ? "" : "s"}. Esta cifra refleja registros cargados, no necesariamente el inventario físico completo del fundo.</p></div>
          </div>
        )}

        {error && <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><span>No fue posible cargar inventario: {error}</span><Button variant="outline" size="sm" onClick={() => void Promise.all([loadAssets(), loadMetadata()])}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Activos visibles" value={filteredAssets.length.toLocaleString("es-CL")} />
          <Metric title="Valor de compra registrado" value={new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(registeredValue)} />
          <Metric title="Sin ubicación informada" value={withoutLocation.toLocaleString("es-CL")} alert={withoutLocation > 0} />
          <Metric title="Sin responsable asignado" value={withoutAssignment.toLocaleString("es-CL")} alert={withoutAssignment > 0} />
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Buscar y filtrar</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nombre, código o ubicación" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
            <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="all">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="all">Todos los estados</option>{availableStatuses.map((status) => <option key={status} value={status}>{STATUS_LABELS[status] ?? status}</option>)}</select>
          </CardContent>
        </Card>

        {loading ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Cargando inventario…</CardContent></Card> : filteredAssets.length === 0 ? <Card><CardContent className="py-12 text-center"><Package className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">No hay activos para los filtros seleccionados.</p><p className="mt-1 text-sm text-muted-foreground">Ajusta los filtros o registra un nuevo activo.</p></CardContent></Card> : <InventoryTable assets={filteredAssets} loading={false} onEdit={setEditingAsset} onDelete={handleRetire} onEditClick={() => setShowForm(true)} />}

        {showForm && <InventoryForm asset={editingAsset} categories={categories} costCenters={costCenters} onClose={handleFormClose} onSuccess={async () => { await loadAssets(); handleFormClose() }} />}
      </div>
    </AppLayout>
  )
}

function Metric({ title, value, alert = false }: { title: string; value: string; alert?: boolean }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div></CardContent></Card>
}
