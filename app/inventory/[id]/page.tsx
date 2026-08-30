"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ChevronLeft, Download, History, MapPin, ShieldCheck, UserRound, Wrench } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/hooks/use-language"
import { createBrowserClient } from "@/lib/supabase/client"

type Warehouse = { id: string; code: string; name: string }
type WarehouseLocation = { id: string; code: string; name: string; warehouse_id: string; warehouses?: Warehouse | null }
type Category = { name: string; color?: string | null }
type CostCenter = { name: string; code?: string | null }
type Asset = { id: string; asset_code: string; name: string; asset_class?: string | null; description?: string | null; brand?: string | null; model?: string | null; serial_number?: string | null; assigned_to?: string | null; status?: string | null; purchase_date?: string | null; purchase_price?: number | null; photo_url?: string | null; qr_code_url?: string | null; notes?: string | null; created_at?: string | null; warehouse_location_id?: string | null; warehouse_locations?: WarehouseLocation | null; asset_categories?: Category | null; cost_centers?: CostCenter | null }
type Movement = { id: string; movement_type: string; from_location_id?: string | null; to_location_id?: string | null; assigned_to?: string | null; notes?: string | null; moved_at?: string | null; created_at?: string | null }
type MaintenanceTask = { id: string; title: string; status: string | null; prioridad: string | null; fecha_objetivo: string | null; bloqueado: boolean | null; created_at: string | null }
type Issue = { id: string; title: string | null; description: string | null; status: string | null; priority: string | null; severity: string | null; created_at: string | null; resolved_at: string | null }
type Custody = { id: string; employee_id: string; employee_name_snapshot: string; status: string; issued_at: string; due_at: string | null; returned_at: string | null; issue_condition: string | null; return_condition: string | null }

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const COPY = {
  en: {
    loadError: "The asset record could not be loaded.", noDate: "No date", noLocation: "No location recorded", locationUnavailable: "Location unavailable", warehouse: "Warehouse", loading: "Loading asset object…", notFound: "The equipment or asset was not found.", backInventory: "Back to inventory", objectAsset: "Object · Asset", noStatus: "No status", partial: "Some related context could not be loaded. The asset continues to show only information allowed by RLS.", state: "Status", maintenanceOpen: "Open maintenance", issuesOpen: "Open issues", custody: "Custody", available: "Available", operational: "Operational information", class: "Class", category: "Category", noClass: "Unclassified", noCategory: "No category", brandModel: "Brand and model", notRecorded: "Not recorded", serial: "Serial number", costCenter: "Cost center", purchaseDate: "Purchase date", purchaseValue: "Recorded value", created: "Created", description: "Description", notes: "Notes", maintenance: "Maintenance", openMaintenance: "Open maintenance", noMaintenance: "No visible maintenance for this asset.", blocked: "blocked", priority: "Priority", target: "target", unregistered: "not recorded", issues: "Issues", openIssues: "Open issues", noIssues: "No visible issues for this asset.", issue: "Issue", priorityMissing: "priority not recorded", noCustody: "No visible custody history for this asset.", delivered: "Issued", due: "due", returned: "returned", issueCondition: "Issue condition", returnCondition: "Return condition", movements: "Movement history", noMovements: "No movements have been recorded for this asset yet.", responsible: "Responsible", currentLocation: "Current location", noWarehouse: "No warehouse", noPosition: "No position recorded", availableWarehouse: "Available in warehouse", custodyUntil: "Custody active until", qr: "QR code", qrAlt: "QR code for", downloadQr: "Download QR" },
  es: {
    loadError: "No fue posible cargar el registro del activo.", noDate: "Sin fecha", noLocation: "Sin ubicación registrada", locationUnavailable: "Ubicación no disponible", warehouse: "Bodega", loading: "Cargando objeto activo…", notFound: "El equipo o activo no fue encontrado.", backInventory: "Volver a inventario", objectAsset: "Objeto · Activo", noStatus: "Sin estado", partial: "Parte del contexto relacionado no pudo cargarse. El activo sigue mostrando únicamente la información permitida por RLS.", state: "Estado", maintenanceOpen: "Mantenimiento abierto", issuesOpen: "Incidencias abiertas", custody: "Custodia", available: "Disponible", operational: "Información operativa", class: "Clase", category: "Categoría", noClass: "Sin clasificar", noCategory: "Sin categoría", brandModel: "Marca y modelo", notRecorded: "No registrado", serial: "Número de serie", costCenter: "Centro de costo", purchaseDate: "Fecha de compra", purchaseValue: "Valor registrado", created: "Creado", description: "Descripción", notes: "Notas", maintenance: "Mantenimiento", openMaintenance: "Abrir mantenimiento", noMaintenance: "No hay mantenimiento visible para este activo.", blocked: "bloqueado", priority: "Prioridad", target: "objetivo", unregistered: "sin registrar", issues: "Incidencias", openIssues: "Abrir incidencias", noIssues: "No hay incidencias visibles para este activo.", issue: "Incidencia", priorityMissing: "prioridad sin registrar", noCustody: "No hay historial de custodia visible para este activo.", delivered: "Entregado", due: "vence", returned: "devuelto", issueCondition: "Condición entrega", returnCondition: "Condición devolución", movements: "Historial de movimientos", noMovements: "Todavía no hay movimientos registrados para este activo.", responsible: "Responsable", currentLocation: "Ubicación actual", noWarehouse: "Sin bodega", noPosition: "Sin posición registrada", availableWarehouse: "Disponible en bodega", custodyUntil: "Custodia vigente hasta", qr: "Código QR", qrAlt: "Código QR de", downloadQr: "Descargar QR" },
  de: {
    loadError: "Der Anlagen-Datensatz konnte nicht geladen werden.", noDate: "Kein Datum", noLocation: "Kein Standort erfasst", locationUnavailable: "Standort nicht verfügbar", warehouse: "Lager", loading: "Anlage wird geladen…", notFound: "Das Gerät oder die Anlage wurde nicht gefunden.", backInventory: "Zurück zum Inventar", objectAsset: "Objekt · Anlage", noStatus: "Kein Status", partial: "Ein Teil des zugehörigen Kontexts konnte nicht geladen werden. Die Anlage zeigt weiterhin nur durch RLS erlaubte Informationen.", state: "Status", maintenanceOpen: "Offene Instandhaltung", issuesOpen: "Offene Vorfälle", custody: "Verwahrung", available: "Verfügbar", operational: "Betriebsinformationen", class: "Klasse", category: "Kategorie", noClass: "Nicht klassifiziert", noCategory: "Keine Kategorie", brandModel: "Marke und Modell", notRecorded: "Nicht erfasst", serial: "Seriennummer", costCenter: "Kostenstelle", purchaseDate: "Kaufdatum", purchaseValue: "Erfasster Wert", created: "Erstellt", description: "Beschreibung", notes: "Notizen", maintenance: "Instandhaltung", openMaintenance: "Instandhaltung öffnen", noMaintenance: "Für diese Anlage ist keine sichtbare Instandhaltung vorhanden.", blocked: "blockiert", priority: "Priorität", target: "Ziel", unregistered: "nicht erfasst", issues: "Vorfälle", openIssues: "Vorfälle öffnen", noIssues: "Für diese Anlage sind keine sichtbaren Vorfälle vorhanden.", issue: "Vorfall", priorityMissing: "Priorität nicht erfasst", noCustody: "Für diese Anlage ist kein sichtbarer Verwahrungsverlauf vorhanden.", delivered: "Ausgegeben", due: "fällig", returned: "zurückgegeben", issueCondition: "Zustand bei Ausgabe", returnCondition: "Zustand bei Rückgabe", movements: "Bewegungsverlauf", noMovements: "Für diese Anlage wurden noch keine Bewegungen erfasst.", responsible: "Verantwortlich", currentLocation: "Aktueller Standort", noWarehouse: "Kein Lager", noPosition: "Keine Position erfasst", availableWarehouse: "Im Lager verfügbar", custodyUntil: "Verwahrung aktiv bis", qr: "QR-Code", qrAlt: "QR-Code für", downloadQr: "QR herunterladen" },
} as const
const STATUS_LABELS = {
  en: { active: "Operational", maintenance: "Under maintenance", inactive: "Out of service", deprecated: "Retired" },
  es: { active: "Operativo", maintenance: "En mantenimiento", inactive: "Fuera de servicio", deprecated: "Retirado" },
  de: { active: "Betriebsbereit", maintenance: "In Instandhaltung", inactive: "Außer Betrieb", deprecated: "Ausgemustert" },
} as const
const CLASS_LABELS = {
  en: { equipment: "Equipment", tool: "Tool", infrastructure: "Fixed infrastructure", vehicle: "Vehicle or machinery", other: "Other" },
  es: { equipment: "Equipo", tool: "Herramienta", infrastructure: "Infraestructura fija", vehicle: "Vehículo o maquinaria", other: "Otro" },
  de: { equipment: "Ausrüstung", tool: "Werkzeug", infrastructure: "Feste Infrastruktur", vehicle: "Fahrzeug oder Maschine", other: "Sonstiges" },
} as const
const MOVEMENT_LABELS = {
  en: { initial: "Initial load", receipt: "Receipt", transfer: "Transfer", assignment: "Assignment", return: "Return", retirement: "Retirement" },
  es: { initial: "Carga inicial", receipt: "Ingreso", transfer: "Traslado", assignment: "Asignación", return: "Devolución", retirement: "Retiro" },
  de: { initial: "Erstbestand", receipt: "Eingang", transfer: "Transfer", assignment: "Zuweisung", return: "Rückgabe", retirement: "Ausmusterung" },
} as const

function firstRelation<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { language } = useLanguage()
  const copy = COPY[language]
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const date = useMemo(() => new Intl.DateTimeFormat(LOCALES[language], { dateStyle: "medium", timeZone: "America/Santiago" }), [language])
  const money = useMemo(() => new Intl.NumberFormat(LOCALES[language], { style: "currency", currency: "CLP", maximumFractionDigits: 0 }), [language])
  const number = useMemo(() => new Intl.NumberFormat(LOCALES[language]), [language])
  const [asset, setAsset] = useState<Asset | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceTask[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [custodies, setCustodies] = useState<Custody[]>([])
  const [locations, setLocations] = useState<Record<string, WarehouseLocation>>({})
  const [partialError, setPartialError] = useState(false)
  const [loading, setLoading] = useState(true)
  const compactDate = (value?: string | null) => value ? date.format(new Date(value.includes("T") ? value : `${value}T12:00:00-04:00`)) : copy.noDate
  const localize = (href: string) => `/${language}${href}`

  useEffect(() => {
    let cancelled = false
    async function loadAsset() {
      setLoading(true); setPartialError(false)
      const [assetResult, movementResult, maintenanceResult, issuesResult, custodyResult, locationResult] = await Promise.all([
        supabase.from("assets").select("*, asset_categories(name, color), cost_centers(name, code), warehouse_locations(id, code, name, warehouse_id, warehouses(id, code, name))").eq("id", params.id).single(),
        supabase.from("inventory_movements").select("id, movement_type, from_location_id, to_location_id, assigned_to, notes, moved_at, created_at").eq("asset_id", params.id).order("moved_at", { ascending: false }).limit(20),
        supabase.from("maintenance_tasks").select("id,title,status,prioridad,fecha_objetivo,bloqueado,created_at").eq("asset_id", params.id).order("created_at", { ascending: false }).limit(12),
        supabase.from("issues").select("id,title,description,status,priority,severity,created_at,resolved_at").eq("asset_id", params.id).order("created_at", { ascending: false }).limit(12),
        supabase.from("inventory_asset_custodies").select("id,employee_id,employee_name_snapshot,status,issued_at,due_at,returned_at,issue_condition,return_condition").eq("asset_id", params.id).order("issued_at", { ascending: false }).limit(12),
        supabase.from("warehouse_locations").select("id, code, name, warehouse_id, warehouses(id, code, name)"),
      ])
      if (cancelled) return
      if (assetResult.error) {
        console.error("[inventory-asset] load failed", assetResult.error)
        toast({ title: copy.loadError, variant: "destructive" }); setAsset(null)
      } else {
        const rawLocation = firstRelation(assetResult.data.warehouse_locations)
        setAsset({ ...assetResult.data, asset_categories: firstRelation(assetResult.data.asset_categories), cost_centers: firstRelation(assetResult.data.cost_centers), warehouse_locations: rawLocation ? { ...rawLocation, warehouses: firstRelation(rawLocation.warehouses) } : null })
      }
      const relatedError = movementResult.error || maintenanceResult.error || issuesResult.error || custodyResult.error || locationResult.error
      setPartialError(Boolean(relatedError))
      if (relatedError) console.error("[inventory-asset] related context partially failed", relatedError)
      if (!movementResult.error) setMovements((movementResult.data ?? []) as Movement[])
      if (!maintenanceResult.error) setMaintenance((maintenanceResult.data ?? []) as MaintenanceTask[])
      if (!issuesResult.error) setIssues((issuesResult.data ?? []) as Issue[])
      if (!custodyResult.error) setCustodies((custodyResult.data ?? []) as Custody[])
      if (!locationResult.error) setLocations(Object.fromEntries((locationResult.data ?? []).map((location) => [location.id, { ...location, warehouses: firstRelation(location.warehouses) } satisfies WarehouseLocation])))
      setLoading(false)
    }
    void loadAsset(); return () => { cancelled = true }
  }, [copy.loadError, params.id, supabase, toast])

  function downloadQRCode() { if (!asset?.qr_code_url) return; const link = document.createElement("a"); link.href = asset.qr_code_url; link.download = `${asset.asset_code}-qr.png`; link.click() }
  function locationLabel(locationId?: string | null) { if (!locationId) return copy.noLocation; const location = locations[locationId]; if (!location) return copy.locationUnavailable; return `${location.warehouses?.name ?? copy.warehouse} · ${location.name}` }

  if (loading) return <AppLayout><div className="p-8 text-center text-muted-foreground">{copy.loading}</div></AppLayout>
  if (!asset) return <AppLayout><div className="space-y-4 p-8 text-center"><p>{copy.notFound}</p><Button variant="outline" onClick={() => router.push(localize("/inventory"))}>{copy.backInventory}</Button></div></AppLayout>

  const currentLocation = asset.warehouse_locations
  const price = asset.purchase_price == null ? null : money.format(asset.purchase_price)
  const activeMaintenance = maintenance.filter((item) => !["completed", "done", "cancelled", "canceled"].includes(item.status?.toLowerCase() ?? ""))
  const openIssues = issues.filter((item) => !["resolved", "closed", "completed", "cancelled", "canceled"].includes(item.status?.toLowerCase() ?? ""))
  const activeCustody = custodies.find((item) => item.status === "active" && !item.returned_at) ?? null
  const statusLabel = STATUS_LABELS[language][asset.status as keyof typeof STATUS_LABELS.en] ?? asset.status ?? copy.noStatus
  const classLabel = CLASS_LABELS[language][asset.asset_class as keyof typeof CLASS_LABELS.en] ?? asset.asset_class ?? copy.noClass

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><Button variant="ghost" size="sm" onClick={() => router.push(localize("/inventory"))} className="mt-1 gap-2"><ChevronLeft className="h-4 w-4" />{copy.backInventory}</Button><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{copy.objectAsset}</p><h1 className="mt-1 text-2xl font-bold text-accent sm:text-3xl">{asset.name}</h1><p className="mt-1 font-mono text-sm text-muted-foreground">{asset.asset_code}</p></div></div><Badge variant="outline" className="w-fit">{statusLabel}</Badge></div>
        {partialError && <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">{copy.partial}</div>}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StateCard label={copy.state} value={statusLabel} /><StateCard label={copy.maintenanceOpen} value={number.format(activeMaintenance.length)} attention={activeMaintenance.some((item) => item.bloqueado)} /><StateCard label={copy.issuesOpen} value={number.format(openIssues.length)} attention={openIssues.length > 0} /><StateCard label={copy.custody} value={activeCustody?.employee_name_snapshot ?? copy.available} /></section>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {asset.photo_url && <Card className="overflow-hidden"><img src={asset.photo_url} alt={asset.name} className="aspect-video w-full object-cover" /></Card>}
            <Card className="p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold">{copy.operational}</h2><div className="grid gap-5 sm:grid-cols-2"><Info label={copy.class} value={classLabel} /><Info label={copy.category} value={asset.asset_categories?.name ?? copy.noCategory} /><Info label={copy.brandModel} value={[asset.brand, asset.model].filter(Boolean).join(" · ") || copy.notRecorded} /><Info label={copy.serial} value={asset.serial_number ?? copy.notRecorded} mono /><Info label={copy.costCenter} value={asset.cost_centers ? `${asset.cost_centers.name}${asset.cost_centers.code ? ` (${asset.cost_centers.code})` : ""}` : copy.notRecorded} /><Info label={copy.purchaseDate} value={asset.purchase_date ? compactDate(asset.purchase_date) : copy.notRecorded} /><Info label={copy.purchaseValue} value={price ?? copy.notRecorded} /><Info label={copy.created} value={compactDate(asset.created_at)} /></div></Card>
            {(asset.description || asset.notes) && <Card className="space-y-4 p-5 sm:p-6">{asset.description && <section><h2 className="mb-1 font-semibold">{copy.description}</h2><p className="text-sm text-muted-foreground">{asset.description}</p></section>}{asset.notes && <section><h2 className="mb-1 font-semibold">{copy.notes}</h2><p className="text-sm text-muted-foreground">{asset.notes}</p></section>}</Card>}
            <Card className="p-5 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Wrench className="h-5 w-5" /><h2 className="text-lg font-semibold">{copy.maintenance}</h2></div><Link href={localize("/maintenance")} className="text-sm font-medium text-primary hover:underline">{copy.openMaintenance}</Link></div>{maintenance.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noMaintenance}</p> : <div className="space-y-3">{maintenance.map((item) => <div key={item.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item.title}</p><Badge variant={item.bloqueado ? "destructive" : "outline"}>{item.bloqueado ? copy.blocked : item.status ?? copy.noStatus}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{copy.priority} {item.prioridad ?? copy.unregistered} · {copy.target} {compactDate(item.fecha_objetivo)}</p></div>)}</div>}</Card>
            <Card className="p-5 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /><h2 className="text-lg font-semibold">{copy.issues}</h2></div><Link href={localize("/issues")} className="text-sm font-medium text-primary hover:underline">{copy.openIssues}</Link></div>{issues.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noIssues}</p> : <div className="space-y-3">{issues.map((item) => <div key={item.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item.title ?? copy.issue}</p><Badge variant={openIssues.some((open) => open.id === item.id) ? "destructive" : "outline"}>{item.status ?? copy.noStatus}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.priority ?? item.severity ?? copy.priorityMissing} · {compactDate(item.created_at)}</p>{item.description && <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>}</div>)}</div>}</Card>
            <Card className="p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5" /><h2 className="text-lg font-semibold">{copy.custody}</h2></div>{custodies.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noCustody}</p> : <div className="space-y-3">{custodies.map((custody) => <div key={custody.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{custody.employee_name_snapshot}</p><Badge variant="outline">{custody.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{copy.delivered} {compactDate(custody.issued_at)}{custody.due_at ? ` · ${copy.due} ${compactDate(custody.due_at)}` : ""}{custody.returned_at ? ` · ${copy.returned} ${compactDate(custody.returned_at)}` : ""}</p>{custody.issue_condition && <p className="mt-2 text-xs text-muted-foreground">{copy.issueCondition}: {custody.issue_condition}</p>}{custody.return_condition && <p className="mt-1 text-xs text-muted-foreground">{copy.returnCondition}: {custody.return_condition}</p>}</div>)}</div>}</Card>
            <Card className="p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><History className="h-5 w-5" /><h2 className="text-lg font-semibold">{copy.movements}</h2></div>{movements.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noMovements}</p> : <div className="space-y-3">{movements.map((movement) => <div key={movement.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{MOVEMENT_LABELS[language][movement.movement_type as keyof typeof MOVEMENT_LABELS.en] ?? movement.movement_type}</p><time className="text-xs text-muted-foreground">{compactDate(movement.moved_at ?? movement.created_at)}</time></div><p className="mt-1 text-sm text-muted-foreground">{locationLabel(movement.from_location_id)} → {locationLabel(movement.to_location_id)}</p>{movement.assigned_to && <p className="mt-1 text-sm">{copy.responsible}: {movement.assigned_to}</p>}{movement.notes && <p className="mt-1 text-xs text-muted-foreground">{movement.notes}</p>}</div>)}</div>}</Card>
          </div>
          <aside className="space-y-4"><Card className="p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><MapPin className="h-4 w-4" />{copy.currentLocation}</div><p className="font-medium">{currentLocation?.warehouses?.name ?? copy.noWarehouse}</p><p className="text-sm text-muted-foreground">{currentLocation ? `${currentLocation.name} (${currentLocation.code})` : copy.noPosition}</p></Card><Card className="p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><UserRound className="h-4 w-4" />{copy.responsible}</div><p className="font-medium">{activeCustody?.employee_name_snapshot ?? asset.assigned_to ?? copy.availableWarehouse}</p>{activeCustody?.due_at && <p className="mt-1 text-xs text-muted-foreground">{copy.custodyUntil} {compactDate(activeCustody.due_at)}</p>}</Card>{asset.qr_code_url && <Card className="p-5"><h2 className="mb-3 text-sm font-semibold text-muted-foreground">{copy.qr}</h2><img src={asset.qr_code_url} alt={`${copy.qrAlt} ${asset.name}`} className="w-full rounded-lg border p-2" /><Button onClick={downloadQRCode} className="mt-3 w-full gap-2" variant="outline"><Download className="h-4 w-4" />{copy.downloadQr}</Button></Card>}</aside>
        </div>
      </div>
    </AppLayout>
  )
}

function StateCard({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) { return <Card className={attention ? "border-amber-500/35 bg-amber-500/5 p-4" : "p-4"}><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></Card> }
function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className={mono ? "mt-1 font-mono text-sm" : "mt-1 text-sm font-medium"}>{value}</p></div> }
