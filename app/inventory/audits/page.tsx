"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, EyeOff, RefreshCw, ScanLine, ShieldCheck, Warehouse, XCircle } from "lucide-react"
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

type AuditStatus = "in_progress" | "submitted" | "approved" | "rejected" | "closed" | "cancelled"
type ScanStatus = "pending" | "present" | "missing" | "unexpected"

type WarehouseRelation = { id: string; code: string; name: string; location_id: string | null }
type LocationRelation = { id: string; code: string; name: string; warehouse_id: string; warehouses: WarehouseRelation | WarehouseRelation[] | null }
type LocationOption = { id: string; code: string; name: string; warehouse_id: string; warehouse: WarehouseRelation | null }
type RawSession = {
  id: string
  audit_code: string
  warehouse_location_id: string
  status: AuditStatus
  notes: string | null
  review_notes: string | null
  created_at: string
  submitted_at: string | null
  reviewed_at: string | null
  closed_at: string | null
  warehouse_location: LocationRelation | LocationRelation[] | null
}
type AuditSession = Omit<RawSession, "warehouse_location"> & { location: LocationOption | null }
type AuditLine = {
  id: string
  session_id: string
  asset_id: string
  asset_code_snapshot: string
  asset_name_snapshot: string
  is_expected: boolean
  expected_location_id: string | null
  observed_location_id: string | null
  scan_status: ScanStatus
  condition: string | null
  notes: string | null
  scanned_at: string | null
}
type AssetOption = { id: string; asset_code: string; name: string; status: string | null; warehouse_location_id: string | null; assigned_to: string | null }
type CustodyRow = { asset_id: string; status: string }

const STATUS_COPY: Record<AuditStatus, { label: string; className: string }> = {
  in_progress: { label: "En terreno", className: "border-sky-300 text-sky-700" },
  submitted: { label: "En revisión", className: "border-amber-300 text-amber-700" },
  approved: { label: "Aprobada", className: "border-violet-300 text-violet-700" },
  rejected: { label: "Rechazada", className: "border-red-300 text-red-700" },
  closed: { label: "Cerrada", className: "border-emerald-300 text-emerald-700" },
  cancelled: { label: "Cancelada", className: "text-muted-foreground" },
}

const SCAN_COPY: Record<ScanStatus, string> = {
  pending: "Pendiente",
  present: "Presente",
  missing: "Faltante",
  unexpected: "Inesperado",
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default function InventoryAssetAuditsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { access, loading: accessLoading, can, canAccessDepartment } = useEffectiveAccess()
  const canOperate = can("inventory.process") && canAccessDepartment("inventory")
  const canApprove = canOperate && (access.is_admin || access.role === "approver")
  const [sessions, setSessions] = useState<AuditSession[]>([])
  const [lines, setLines] = useState<AuditLine[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [assets, setAssets] = useState<AssetOption[]>([])
  const [activeCustodyIds, setActiveCustodyIds] = useState<Set<string>>(new Set())
  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [newLocationId, setNewLocationId] = useState("")
  const [newNotes, setNewNotes] = useState("")
  const [assetCode, setAssetCode] = useState("")
  const [condition, setCondition] = useState("good")
  const [scanNotes, setScanNotes] = useState("")
  const [reviewNotes, setReviewNotes] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingLines, setLoadingLines] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [sessionsResult, locationsResult, assetsResult, custodiesResult] = await Promise.all([
      supabase.from("inventory_asset_audit_sessions").select("id,audit_code,warehouse_location_id,status,notes,review_notes,created_at,submitted_at,reviewed_at,closed_at,warehouse_location:warehouse_locations(id,code,name,warehouse_id,warehouses(id,code,name,location_id))").order("created_at", { ascending: false }).limit(100),
      supabase.from("warehouse_locations").select("id,code,name,warehouse_id,warehouses(id,code,name,location_id)").eq("is_active", true).order("name"),
      supabase.from("assets").select("id,asset_code,name,status,warehouse_location_id,assigned_to").neq("status", "deprecated").order("asset_code"),
      supabase.from("inventory_asset_custodies").select("asset_id,status").eq("status", "active"),
    ])

    const firstError = sessionsResult.error || locationsResult.error || assetsResult.error || custodiesResult.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const normalizedLocations = ((locationsResult.data ?? []) as LocationRelation[]).map((row) => ({
      id: row.id, code: row.code, name: row.name, warehouse_id: row.warehouse_id, warehouse: firstRelation(row.warehouses),
    }))
    const locationMap = new Map(normalizedLocations.map((location) => [location.id, location]))
    const normalizedSessions = ((sessionsResult.data ?? []) as unknown as RawSession[]).map((row) => {
      const relation = firstRelation(row.warehouse_location)
      return {
        ...row,
        location: locationMap.get(row.warehouse_location_id) ?? (relation ? { id: relation.id, code: relation.code, name: relation.name, warehouse_id: relation.warehouse_id, warehouse: firstRelation(relation.warehouses) } : null),
      }
    })

    setLocations(normalizedLocations)
    setAssets((assetsResult.data ?? []) as AssetOption[])
    setActiveCustodyIds(new Set(((custodiesResult.data ?? []) as CustodyRow[]).map((row) => row.asset_id)))
    setSessions(normalizedSessions)
    setSelectedSessionId((current) => current && normalizedSessions.some((session) => session.id === current) ? current : normalizedSessions[0]?.id ?? "")
    setLoading(false)
  }, [supabase])

  const loadLines = useCallback(async (sessionId: string) => {
    if (!sessionId) { setLines([]); return }
    setLoadingLines(true)
    const { data, error: lineError } = await supabase.from("inventory_asset_audit_lines").select("id,session_id,asset_id,asset_code_snapshot,asset_name_snapshot,is_expected,expected_location_id,observed_location_id,scan_status,condition,notes,scanned_at").eq("session_id", sessionId).order("created_at")
    if (lineError) { setError(lineError.message); setLines([]) } else setLines((data ?? []) as AuditLine[])
    setLoadingLines(false)
  }, [supabase])

  useEffect(() => { void loadWorkspace() }, [loadWorkspace])
  useEffect(() => { void loadLines(selectedSessionId) }, [loadLines, selectedSessionId])

  const selected = sessions.find((session) => session.id === selectedSessionId) ?? null
  const openLocations = new Set(sessions.filter((session) => ["in_progress", "submitted", "approved"].includes(session.status)).map((session) => session.warehouse_location_id))
  const eligibleLocations = locations.filter((location) => !openLocations.has(location.id) && assets.some((asset) => asset.warehouse_location_id === location.id && asset.status !== "maintenance" && !asset.assigned_to?.trim() && !activeCustodyIds.has(asset.id)))
  const expectedCount = lines.filter((line) => line.is_expected).length
  const presentCount = lines.filter((line) => line.scan_status === "present").length
  const missingCount = lines.filter((line) => line.scan_status === "missing").length
  const unexpectedCount = lines.filter((line) => line.scan_status === "unexpected").length
  const conditionFindings = lines.filter((line) => ["observations", "damaged"].includes(line.condition ?? "")).length
  const visibleLines = selected?.status === "in_progress" ? lines.filter((line) => line.scan_status !== "pending") : lines

  async function createSession() {
    if (!canOperate || !newLocationId || saving) return
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc("create_inventory_asset_audit_session", { p_warehouse_location_id: newLocationId, p_notes: newNotes.trim() || null })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo iniciar", description: rpcError.message, variant: "destructive" })
    toast({ title: "Auditoría iniciada", description: `${data?.audit_code ?? "Sesión"} tomó un snapshot de ${Number(data?.expected_assets ?? 0)} activos esperados.` })
    setNewLocationId("")
    setNewNotes("")
    await loadWorkspace()
    if (data?.session_id) setSelectedSessionId(String(data.session_id))
  }

  async function recordScan() {
    if (!selected || selected.status !== "in_progress" || !canOperate || saving) return
    const normalized = assetCode.trim().toLowerCase()
    const asset = assets.find((item) => item.asset_code.trim().toLowerCase() === normalized)
    if (!asset) return toast({ title: "Activo no encontrado", description: "Ingresa un código de activo exacto y visible en tu scope.", variant: "destructive" })
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc("record_inventory_asset_audit_scan", { p_session_id: selected.id, p_asset_id: asset.id, p_condition: condition, p_notes: scanNotes.trim() || null })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo registrar", description: rpcError.message, variant: "destructive" })
    toast({ title: data?.scan_status === "unexpected" ? "Activo inesperado" : "Activo presente", description: `${asset.asset_code} · ${asset.name}` })
    setAssetCode("")
    setCondition("good")
    setScanNotes("")
    await loadLines(selected.id)
  }

  async function submitSession() {
    if (!selected || selected.status !== "in_progress" || saving) return
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc("submit_inventory_asset_audit_session", { p_session_id: selected.id })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo enviar", description: rpcError.message, variant: "destructive" })
    toast({ title: "Auditoría enviada", description: `${Number(data?.missing_assets ?? 0)} faltantes y ${Number(data?.unexpected_assets ?? 0)} inesperados quedaron para revisión.` })
    await loadWorkspace(); await loadLines(selected.id)
  }

  async function reviewSession(approved: boolean) {
    if (!selected || selected.status !== "submitted" || !canApprove || saving) return
    setSaving(true)
    const { error: rpcError } = await supabase.rpc("review_inventory_asset_audit_session", { p_session_id: selected.id, p_approved: approved, p_notes: reviewNotes.trim() || null })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo revisar", description: rpcError.message, variant: "destructive" })
    toast({ title: approved ? "Auditoría aprobada" : "Auditoría rechazada", description: approved ? "Los hallazgos pueden cerrarse y registrarse en las bitácoras." : "La sesión quedó cerrada como rechazada sin modificar activos." })
    setReviewNotes("")
    await loadWorkspace()
  }

  async function closeSession() {
    if (!selected || selected.status !== "approved" || !canApprove || saving) return
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc("close_inventory_asset_audit_session", { p_session_id: selected.id })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo cerrar", description: rpcError.message, variant: "destructive" })
    toast({ title: "Auditoría cerrada", description: `${Number(data?.findings_logged ?? 0)} hallazgos se registraron. Ningún activo ni ubicación fue modificado automáticamente.` })
    await loadWorkspace()
  }

  async function cancelSession() {
    if (!selected || !cancelReason.trim() || saving) return
    setSaving(true)
    const { error: rpcError } = await supabase.rpc("cancel_inventory_asset_audit_session", { p_session_id: selected.id, p_reason: cancelReason.trim() })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo cancelar", description: rpcError.message, variant: "destructive" })
    toast({ title: "Auditoría cancelada", description: "No se modificó ningún activo." })
    setCancelReason("")
    await loadWorkspace()
  }

  return (
    <AppLayout>
      <PageHeader title="Auditoría física de activos" description="Verificación serializada por ubicación: presentes, faltantes, inesperados y condición, sin correcciones automáticas." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void loadWorkspace()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button><Button variant="outline" asChild><Link href="/inventory"><ArrowLeft className="mr-2 h-4 w-4" />Inventario</Link></Button></div>} />

      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
        {!accessLoading && !canOperate && <Card className="border-amber-300"><CardContent className="p-4 text-sm text-amber-800">Crear y registrar auditorías requiere <strong>inventory.process</strong> y scope de Inventario.</CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric title="Auditorías abiertas" value={sessions.filter((session) => ["in_progress", "submitted", "approved"].includes(session.status)).length} />
          <Metric title="Esperados" value={expectedCount} />
          <Metric title="Presentes" value={presentCount} />
          <Metric title="Hallazgos ubicación" value={missingCount + unexpectedCount} alert={missingCount + unexpectedCount > 0} />
          <Metric title="Hallazgos condición" value={conditionFindings} alert={conditionFindings > 0} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Warehouse className="h-4 w-4" /> Nueva auditoría</CardTitle><CardDescription>El snapshot excluye activos retirados, en mantenimiento o bajo custodia activa.</CardDescription></CardHeader>
              <CardContent className="space-y-3"><select value={newLocationId} onChange={(event) => setNewLocationId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="">Ubicación con activos auditables</option>{eligibleLocations.map((location) => <option key={location.id} value={location.id}>{location.warehouse?.name ?? "Bodega"} · {location.name}</option>)}</select><Input value={newNotes} onChange={(event) => setNewNotes(event.target.value)} placeholder="Objetivo, turno o contexto" /><Button className="w-full" onClick={() => void createSession()} disabled={!newLocationId || saving || !canOperate}><ClipboardCheck className="mr-2 h-4 w-4" />Iniciar auditoría</Button></CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Sesiones</CardTitle></CardHeader>
              <CardContent className="space-y-2">{sessions.length === 0 ? <p className="text-sm text-muted-foreground">Sin auditorías registradas.</p> : sessions.map((session) => <button type="button" key={session.id} onClick={() => setSelectedSessionId(session.id)} className={`w-full rounded-lg border p-3 text-left ${selectedSessionId === session.id ? "border-primary bg-primary/5" : ""}`}><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{session.audit_code}</p><p className="text-xs text-muted-foreground">{session.location ? `${session.location.warehouse?.name ?? "Bodega"} · ${session.location.name}` : "Sin ubicación"}</p></div><Badge variant="outline" className={STATUS_COPY[session.status].className}>{STATUS_COPY[session.status].label}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{formatDateTime(session.created_at)}</p></button>)}</CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {!selected ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Selecciona o inicia una auditoría.</CardContent></Card> : <>
              <Card>
                <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{selected.audit_code}</CardTitle><CardDescription>{selected.location ? `${selected.location.warehouse?.name ?? "Bodega"} · ${selected.location.name}` : "Ubicación"}</CardDescription></div><Badge variant="outline" className={STATUS_COPY[selected.status].className}>{STATUS_COPY[selected.status].label}</Badge></div></CardHeader>
                <CardContent className="space-y-4">
                  {selected.status === "in_progress" && <div className="rounded-lg border bg-muted/20 p-4"><div className="mb-3 flex items-center gap-2"><EyeOff className="h-4 w-4" /><p className="font-medium">Verificación ciega</p></div><p className="mb-4 text-sm text-muted-foreground">Los activos pendientes del snapshot permanecen ocultos. Registra sólo lo que encuentres físicamente; al enviar, los no escaneados pasan a Faltante.</p><div className="grid gap-3 md:grid-cols-4"><Input value={assetCode} onChange={(event) => setAssetCode(event.target.value)} placeholder="Código exacto del activo" /><select value={condition} onChange={(event) => setCondition(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="good">Buen estado</option><option value="observations">Con observaciones</option><option value="damaged">Dañado</option></select><Input value={scanNotes} onChange={(event) => setScanNotes(event.target.value)} placeholder="Observación opcional" /><Button onClick={() => void recordScan()} disabled={!assetCode.trim() || saving}><ScanLine className="mr-2 h-4 w-4" />Registrar</Button></div></div>}

                  <div className="grid gap-3 sm:grid-cols-4"><MiniMetric label="Snapshot esperado" value={expectedCount} /><MiniMetric label="Escaneados presentes" value={presentCount} /><MiniMetric label="Faltantes" value={missingCount} alert={missingCount > 0} /><MiniMetric label="Inesperados" value={unexpectedCount} alert={unexpectedCount > 0} /></div>

                  {selected.status === "in_progress" && <div className="flex flex-wrap items-end gap-3"><div className="min-w-[260px] flex-1"><p className="mb-1 text-xs text-muted-foreground">Al enviar, todo esperado no escaneado queda formalmente faltante.</p></div><Button onClick={() => void submitSession()} disabled={saving || loadingLines}><ShieldCheck className="mr-2 h-4 w-4" />Enviar a revisión</Button><Input className="max-w-xs" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Motivo para cancelar" /><Button variant="outline" onClick={() => void cancelSession()} disabled={!cancelReason.trim() || saving}><XCircle className="mr-2 h-4 w-4" />Cancelar</Button></div>}

                  {selected.status === "submitted" && canApprove && <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4"><p className="font-medium">Revisión independiente</p><p className="mt-1 text-sm text-muted-foreground">Aprobar no cambia ubicaciones. Sólo habilita el cierre formal de hallazgos.</p><div className="mt-3 flex flex-wrap gap-2"><Input className="min-w-[280px] flex-1" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Nota de revisión" /><Button variant="outline" onClick={() => void reviewSession(false)} disabled={saving}><XCircle className="mr-2 h-4 w-4" />Rechazar</Button><Button onClick={() => void reviewSession(true)} disabled={saving}><CheckCircle2 className="mr-2 h-4 w-4" />Aprobar</Button></div></div>}

                  {selected.status === "approved" && canApprove && <div className="rounded-lg border border-violet-300 bg-violet-50/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">Auditoría aprobada</p><p className="text-sm text-muted-foreground">Cerrar registra faltantes, inesperados y daños en la bitácora, sin alterar datos maestros.</p></div><Button onClick={() => void closeSession()} disabled={saving}><CheckCircle2 className="mr-2 h-4 w-4" />Cerrar y registrar hallazgos</Button></div></div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Evidencia de auditoría</CardTitle><CardDescription>{selected.status === "in_progress" ? "Sólo se muestran activos ya escaneados; el snapshot pendiente permanece oculto." : "Snapshot completo y resultado final de cada activo."}</CardDescription></CardHeader>
                <CardContent>{loadingLines ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando evidencia…</p> : visibleLines.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay activos escaneados.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Activo</TableHead><TableHead>Resultado</TableHead><TableHead>Condición</TableHead><TableHead>Observación</TableHead><TableHead>Escaneado</TableHead></TableRow></TableHeader><TableBody>{visibleLines.map((line) => <TableRow key={line.id}><TableCell><p className="font-medium">{line.asset_code_snapshot}</p><p className="text-xs text-muted-foreground">{line.asset_name_snapshot}</p></TableCell><TableCell><Badge variant={line.scan_status === "missing" || line.scan_status === "unexpected" ? "destructive" : "outline"}>{SCAN_COPY[line.scan_status]}</Badge></TableCell><TableCell>{line.condition === "damaged" ? <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Dañado</span> : line.condition === "observations" ? "Observaciones" : line.condition === "good" ? "Buen estado" : "—"}</TableCell><TableCell className="max-w-xs text-sm text-muted-foreground">{line.notes || "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{line.scanned_at ? formatDateTime(line.scanned_at) : "—"}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent>
              </Card>
            </>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function Metric({ title, value, alert = false }: { title: string; value: number; alert?: boolean }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold tabular-nums">{value.toLocaleString("es-CL")}</p></CardContent></Card>
}

function MiniMetric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return <div className={`rounded-lg border p-3 ${alert ? "border-amber-300 bg-amber-50/50" : ""}`}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value.toLocaleString("es-CL")}</p></div>
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}
