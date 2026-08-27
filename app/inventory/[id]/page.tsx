"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ChevronLeft, Download, History, MapPin, ShieldCheck, UserRound, Wrench } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

type Warehouse = { id: string; code: string; name: string }
type WarehouseLocation = { id: string; code: string; name: string; warehouse_id: string; warehouses?: Warehouse | null }
type Category = { name: string; color?: string | null }
type CostCenter = { name: string; code?: string | null }

type Asset = {
  id: string
  asset_code: string
  name: string
  asset_class?: string | null
  description?: string | null
  brand?: string | null
  model?: string | null
  serial_number?: string | null
  assigned_to?: string | null
  status?: string | null
  purchase_date?: string | null
  purchase_price?: number | null
  photo_url?: string | null
  qr_code_url?: string | null
  notes?: string | null
  created_at?: string | null
  warehouse_location_id?: string | null
  warehouse_locations?: WarehouseLocation | null
  asset_categories?: Category | null
  cost_centers?: CostCenter | null
}

type Movement = {
  id: string
  movement_type: string
  from_location_id?: string | null
  to_location_id?: string | null
  assigned_to?: string | null
  notes?: string | null
  moved_at?: string | null
  created_at?: string | null
}

type MaintenanceTask = {
  id: string
  title: string
  status: string | null
  prioridad: string | null
  fecha_objetivo: string | null
  bloqueado: boolean | null
  created_at: string | null
}

type Issue = {
  id: string
  title: string | null
  description: string | null
  status: string | null
  priority: string | null
  severity: string | null
  created_at: string | null
  resolved_at: string | null
}

type Custody = {
  id: string
  employee_id: string
  employee_name_snapshot: string
  status: string
  issued_at: string
  due_at: string | null
  returned_at: string | null
  issue_condition: string | null
  return_condition: string | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

const statusLabels: Record<string, string> = {
  active: "Operativo",
  maintenance: "En mantenimiento",
  inactive: "Fuera de servicio",
  deprecated: "Retirado",
}

const classLabels: Record<string, string> = {
  equipment: "Equipo",
  tool: "Herramienta",
  infrastructure: "Infraestructura fija",
  vehicle: "Vehículo o maquinaria",
  other: "Otro",
}

const movementLabels: Record<string, string> = {
  initial: "Carga inicial",
  receipt: "Ingreso",
  transfer: "Traslado",
  assignment: "Asignación",
  return: "Devolución",
  retirement: "Retiro",
}

function compactDate(value?: string | null) {
  if (!value) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(value.includes("T") ? value : `${value}T12:00:00-04:00`))
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceTask[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [custodies, setCustodies] = useState<Custody[]>([])
  const [locations, setLocations] = useState<Record<string, WarehouseLocation>>({})
  const [partialError, setPartialError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAsset() {
      setLoading(true)
      setPartialError(false)
      const [assetResult, movementResult, maintenanceResult, issuesResult, custodyResult, locationResult] = await Promise.all([
        supabase
          .from("assets")
          .select("*, asset_categories(name, color), cost_centers(name, code), warehouse_locations(id, code, name, warehouse_id, warehouses(id, code, name))")
          .eq("id", params.id)
          .single(),
        supabase
          .from("inventory_movements")
          .select("id, movement_type, from_location_id, to_location_id, assigned_to, notes, moved_at, created_at")
          .eq("asset_id", params.id)
          .order("moved_at", { ascending: false })
          .limit(20),
        supabase
          .from("maintenance_tasks")
          .select("id,title,status,prioridad,fecha_objetivo,bloqueado,created_at")
          .eq("asset_id", params.id)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("issues")
          .select("id,title,description,status,priority,severity,created_at,resolved_at")
          .eq("asset_id", params.id)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("inventory_asset_custodies")
          .select("id,employee_id,employee_name_snapshot,status,issued_at,due_at,returned_at,issue_condition,return_condition")
          .eq("asset_id", params.id)
          .order("issued_at", { ascending: false })
          .limit(12),
        supabase
          .from("warehouse_locations")
          .select("id, code, name, warehouse_id, warehouses(id, code, name)"),
      ])

      if (cancelled) return
      if (assetResult.error) {
        toast({ title: "No fue posible cargar el registro", description: assetResult.error.message, variant: "destructive" })
        setAsset(null)
      } else {
        const rawLocation = firstRelation(assetResult.data.warehouse_locations)
        setAsset({
          ...assetResult.data,
          asset_categories: firstRelation(assetResult.data.asset_categories),
          cost_centers: firstRelation(assetResult.data.cost_centers),
          warehouse_locations: rawLocation
            ? { ...rawLocation, warehouses: firstRelation(rawLocation.warehouses) }
            : null,
        })
      }

      const relatedError = movementResult.error || maintenanceResult.error || issuesResult.error || custodyResult.error || locationResult.error
      setPartialError(Boolean(relatedError))
      if (!movementResult.error) setMovements((movementResult.data ?? []) as Movement[])
      if (!maintenanceResult.error) setMaintenance((maintenanceResult.data ?? []) as MaintenanceTask[])
      if (!issuesResult.error) setIssues((issuesResult.data ?? []) as Issue[])
      if (!custodyResult.error) setCustodies((custodyResult.data ?? []) as Custody[])
      if (!locationResult.error) {
        const locationMap = Object.fromEntries(
          (locationResult.data ?? []).map((location) => [
            location.id,
            { ...location, warehouses: firstRelation(location.warehouses) } satisfies WarehouseLocation,
          ]),
        )
        setLocations(locationMap)
      }
      setLoading(false)
    }

    void loadAsset()
    return () => { cancelled = true }
  }, [params.id, supabase, toast])

  function downloadQRCode() {
    if (!asset?.qr_code_url) return
    const link = document.createElement("a")
    link.href = asset.qr_code_url
    link.download = `${asset.asset_code}-qr.png`
    link.click()
  }

  function locationLabel(locationId?: string | null) {
    if (!locationId) return "Sin ubicación registrada"
    const location = locations[locationId]
    if (!location) return "Ubicación no disponible"
    return `${location.warehouses?.name ?? "Bodega"} · ${location.name}`
  }

  if (loading) return <AppLayout><div className="p-8 text-center text-muted-foreground">Cargando objeto activo…</div></AppLayout>
  if (!asset) return <AppLayout><div className="space-y-4 p-8 text-center"><p>El equipo o activo no fue encontrado.</p><Button variant="outline" onClick={() => router.push("/inventory")}>Volver a inventario</Button></div></AppLayout>

  const currentLocation = asset.warehouse_locations
  const price = asset.purchase_price == null ? null : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(asset.purchase_price)
  const activeMaintenance = maintenance.filter((item) => !["completed", "done", "cancelled", "canceled"].includes(item.status?.toLowerCase() ?? ""))
  const openIssues = issues.filter((item) => !["resolved", "closed", "completed", "cancelled", "canceled"].includes(item.status?.toLowerCase() ?? ""))
  const activeCustody = custodies.find((item) => item.status === "active" && !item.returned_at) ?? null

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/inventory")} className="mt-1 gap-2"><ChevronLeft className="h-4 w-4" />Inventario</Button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Objeto · Activo</p>
              <h1 className="mt-1 text-2xl font-bold text-accent sm:text-3xl">{asset.name}</h1>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{asset.asset_code}</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit">{statusLabels[asset.status ?? ""] ?? asset.status ?? "Sin estado"}</Badge>
        </div>

        {partialError && <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">Parte del contexto relacionado no pudo cargarse. El activo sigue mostrando únicamente la información permitida por RLS.</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StateCard label="Estado" value={statusLabels[asset.status ?? ""] ?? asset.status ?? "Sin estado"} />
          <StateCard label="Mantenimiento abierto" value={String(activeMaintenance.length)} attention={activeMaintenance.some((item) => item.bloqueado)} />
          <StateCard label="Incidencias abiertas" value={String(openIssues.length)} attention={openIssues.length > 0} />
          <StateCard label="Custodia" value={activeCustody?.employee_name_snapshot ?? "Disponible"} />
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {asset.photo_url && <Card className="overflow-hidden"><img src={asset.photo_url} alt={asset.name} className="aspect-video w-full object-cover" /></Card>}

            <Card className="p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">Información operativa</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Info label="Clase" value={classLabels[asset.asset_class ?? ""] ?? asset.asset_class ?? "Sin clasificar"} />
                <Info label="Categoría" value={asset.asset_categories?.name ?? "Sin categoría"} />
                <Info label="Marca y modelo" value={[asset.brand, asset.model].filter(Boolean).join(" · ") || "No registrado"} />
                <Info label="Número de serie" value={asset.serial_number ?? "No registrado"} mono />
                <Info label="Centro de costo" value={asset.cost_centers ? `${asset.cost_centers.name}${asset.cost_centers.code ? ` (${asset.cost_centers.code})` : ""}` : "No registrado"} />
                <Info label="Fecha de compra" value={asset.purchase_date ? compactDate(asset.purchase_date) : "No registrada"} />
                <Info label="Valor registrado" value={price ?? "No registrado"} />
                <Info label="Creado" value={compactDate(asset.created_at)} />
              </div>
            </Card>

            {(asset.description || asset.notes) && <Card className="space-y-4 p-5 sm:p-6">{asset.description && <section><h2 className="mb-1 font-semibold">Descripción</h2><p className="text-sm text-muted-foreground">{asset.description}</p></section>}{asset.notes && <section><h2 className="mb-1 font-semibold">Notas</h2><p className="text-sm text-muted-foreground">{asset.notes}</p></section>}</Card>}

            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Wrench className="h-5 w-5" /><h2 className="text-lg font-semibold">Mantenimiento</h2></div><Link href="/maintenance" className="text-sm font-medium text-primary hover:underline">Abrir mantenimiento</Link></div>
              {maintenance.length === 0 ? <p className="text-sm text-muted-foreground">No hay mantenimiento visible para este activo.</p> : <div className="space-y-3">{maintenance.map((item) => <div key={item.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item.title}</p><Badge variant={item.bloqueado ? "destructive" : "outline"}>{item.bloqueado ? "bloqueado" : item.status ?? "sin estado"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Prioridad {item.prioridad ?? "sin registrar"} · objetivo {compactDate(item.fecha_objetivo)}</p></div>)}</div>}
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /><h2 className="text-lg font-semibold">Incidencias</h2></div><Link href="/issues" className="text-sm font-medium text-primary hover:underline">Abrir incidencias</Link></div>
              {issues.length === 0 ? <p className="text-sm text-muted-foreground">No hay incidencias visibles para este activo.</p> : <div className="space-y-3">{issues.map((item) => <div key={item.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item.title ?? "Incidencia"}</p><Badge variant={openIssues.some((open) => open.id === item.id) ? "destructive" : "outline"}>{item.status ?? "sin estado"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.priority ?? item.severity ?? "prioridad sin registrar"} · {compactDate(item.created_at)}</p>{item.description && <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>}</div>)}</div>}
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5" /><h2 className="text-lg font-semibold">Custodia</h2></div>
              {custodies.length === 0 ? <p className="text-sm text-muted-foreground">No hay historial de custodia visible para este activo.</p> : <div className="space-y-3">{custodies.map((custody) => <div key={custody.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{custody.employee_name_snapshot}</p><Badge variant="outline">{custody.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Entregado {compactDate(custody.issued_at)}{custody.due_at ? ` · vence ${compactDate(custody.due_at)}` : ""}{custody.returned_at ? ` · devuelto ${compactDate(custody.returned_at)}` : ""}</p>{custody.issue_condition && <p className="mt-2 text-xs text-muted-foreground">Condición entrega: {custody.issue_condition}</p>}{custody.return_condition && <p className="mt-1 text-xs text-muted-foreground">Condición devolución: {custody.return_condition}</p>}</div>)}</div>}
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2"><History className="h-5 w-5" /><h2 className="text-lg font-semibold">Historial de movimientos</h2></div>
              {movements.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay movimientos registrados para este activo.</p> : <div className="space-y-3">{movements.map((movement) => <div key={movement.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{movementLabels[movement.movement_type] ?? movement.movement_type}</p><time className="text-xs text-muted-foreground">{compactDate(movement.moved_at ?? movement.created_at)}</time></div><p className="mt-1 text-sm text-muted-foreground">{locationLabel(movement.from_location_id)} → {locationLabel(movement.to_location_id)}</p>{movement.assigned_to && <p className="mt-1 text-sm">Responsable: {movement.assigned_to}</p>}{movement.notes && <p className="mt-1 text-xs text-muted-foreground">{movement.notes}</p>}</div>)}</div>}
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><MapPin className="h-4 w-4" />Ubicación actual</div><p className="font-medium">{currentLocation?.warehouses?.name ?? "Sin bodega"}</p><p className="text-sm text-muted-foreground">{currentLocation ? `${currentLocation.name} (${currentLocation.code})` : "Sin posición registrada"}</p></Card>
            <Card className="p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><UserRound className="h-4 w-4" />Responsable</div><p className="font-medium">{activeCustody?.employee_name_snapshot ?? asset.assigned_to ?? "Disponible en bodega"}</p>{activeCustody?.due_at && <p className="mt-1 text-xs text-muted-foreground">Custodia vigente hasta {compactDate(activeCustody.due_at)}</p>}</Card>
            {asset.qr_code_url && <Card className="p-5"><h2 className="mb-3 text-sm font-semibold text-muted-foreground">Código QR</h2><img src={asset.qr_code_url} alt={`Código QR de ${asset.name}`} className="w-full rounded-lg border p-2" /><Button onClick={downloadQRCode} className="mt-3 w-full gap-2" variant="outline"><Download className="h-4 w-4" />Descargar QR</Button></Card>}
          </aside>
        </div>
      </div>
    </AppLayout>
  )
}

function StateCard({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return <Card className={attention ? "border-amber-500/35 bg-amber-500/5 p-4" : "p-4"}><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></Card>
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className={mono ? "mt-1 font-mono text-sm" : "mt-1 text-sm font-medium"}>{value}</p></div>
}
