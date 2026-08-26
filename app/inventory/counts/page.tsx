"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, ClipboardList, EyeOff, RefreshCw, ShieldCheck, Warehouse, XCircle } from "lucide-react"
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

type SessionStatus = "in_progress" | "submitted" | "approved" | "rejected" | "applied" | "cancelled"

type LocationOption = {
  id: string
  code: string
  name: string
  warehouse: { id: string; code: string; name: string; location_id: string | null } | null
}

type CountSession = {
  id: string
  count_code: string
  warehouse_location_id: string
  status: SessionStatus
  notes: string | null
  review_notes: string | null
  created_at: string
  submitted_at: string | null
  reviewed_at: string | null
  applied_at: string | null
  location: LocationOption | null
}

type CountLine = {
  id: string
  session_id: string
  stock_item_id: string
  expected_quantity: number
  counted_quantity: number | null
  variance: number | null
  notes: string | null
  counted_at: string | null
  stock_item: { id: string; item_code: string; name: string; unit: string; quantity_on_hand: number } | null
}

type RawWarehouse = { id: string; code: string; name: string; location_id: string | null }
type RawLocation = { id: string; code: string; name: string; warehouses: RawWarehouse | RawWarehouse[] | null }
type RawSession = Omit<CountSession, "location"> & { warehouse_location: RawLocation | RawLocation[] | null }
type RawLine = Omit<CountLine, "stock_item"> & { inventory_stock_items: CountLine["stock_item"] | CountLine["stock_item"][] | null }

const STATUS_COPY: Record<SessionStatus, { label: string; className: string }> = {
  in_progress: { label: "En conteo", className: "border-sky-300 text-sky-700" },
  submitted: { label: "En revisión", className: "border-amber-300 text-amber-700" },
  approved: { label: "Aprobado", className: "border-violet-300 text-violet-700" },
  rejected: { label: "Rechazado", className: "border-red-300 text-red-700" },
  applied: { label: "Aplicado", className: "border-emerald-300 text-emerald-700" },
  cancelled: { label: "Cancelado", className: "text-muted-foreground" },
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function InventoryCountsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { access, can, canAccessDepartment, loading: accessLoading } = useEffectiveAccess()
  const canOperate = can("inventory.process") && canAccessDepartment("inventory")
  const canApprove = canOperate && (access.is_admin || access.role === "approver")

  const [sessions, setSessions] = useState<CountSession[]>([])
  const [lines, setLines] = useState<CountLine[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [positionCountByLocation, setPositionCountByLocation] = useState<Record<string, number>>({})
  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [newLocationId, setNewLocationId] = useState("")
  const [newNotes, setNewNotes] = useState("")
  const [reviewNotes, setReviewNotes] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [lineDrafts, setLineDrafts] = useState<Record<string, { quantity: string; notes: string }>>({})
  const [loading, setLoading] = useState(true)
  const [loadingLines, setLoadingLines] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [sessionResult, locationResult, stockResult] = await Promise.all([
      supabase
        .from("inventory_count_sessions")
        .select("id,count_code,warehouse_location_id,status,notes,review_notes,created_at,submitted_at,reviewed_at,applied_at,warehouse_location:warehouse_locations(id,code,name,warehouses(id,code,name,location_id))")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("warehouse_locations")
        .select("id,code,name,warehouses(id,code,name,location_id)")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("inventory_stock_status")
        .select("id,warehouse_location_id")
        .eq("is_active", true),
    ])

    const firstError = sessionResult.error || locationResult.error || stockResult.error
    if (firstError) {
      setError(firstError.message)
      setSessions([])
      setLocations([])
      setPositionCountByLocation({})
      setLoading(false)
      return
    }

    const normalizedLocations = ((locationResult.data ?? []) as RawLocation[]).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      warehouse: firstRelation(row.warehouses),
    }))
    const locationMap = new Map(normalizedLocations.map((location) => [location.id, location]))

    const normalizedSessions = ((sessionResult.data ?? []) as RawSession[]).map((row) => ({
      ...row,
      status: row.status as SessionStatus,
      location: locationMap.get(row.warehouse_location_id) ?? (() => {
        const relation = firstRelation(row.warehouse_location)
        if (!relation) return null
        return { id: relation.id, code: relation.code, name: relation.name, warehouse: firstRelation(relation.warehouses) }
      })(),
    }))

    const counts: Record<string, number> = {}
    ;((stockResult.data ?? []) as Array<{ warehouse_location_id: string }>).forEach((row) => {
      counts[row.warehouse_location_id] = (counts[row.warehouse_location_id] ?? 0) + 1
    })

    setSessions(normalizedSessions)
    setLocations(normalizedLocations)
    setPositionCountByLocation(counts)
    setSelectedSessionId((current) => current && normalizedSessions.some((session) => session.id === current) ? current : normalizedSessions[0]?.id ?? "")
    setLoading(false)
  }, [supabase])

  const loadLines = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      setLines([])
      setLineDrafts({})
      return
    }
    setLoadingLines(true)
    const { data, error: lineError } = await supabase
      .from("inventory_count_lines")
      .select("id,session_id,stock_item_id,expected_quantity,counted_quantity,variance,notes,counted_at,inventory_stock_items(id,item_code,name,unit,quantity_on_hand)")
      .eq("session_id", sessionId)
      .order("created_at")

    if (lineError) {
      setError(lineError.message)
      setLines([])
      setLineDrafts({})
    } else {
      const normalized = ((data ?? []) as RawLine[]).map((row) => ({
        ...row,
        expected_quantity: asNumber(row.expected_quantity),
        counted_quantity: row.counted_quantity == null ? null : asNumber(row.counted_quantity),
        variance: row.variance == null ? null : asNumber(row.variance),
        stock_item: firstRelation(row.inventory_stock_items),
      }))
      setLines(normalized)
      setLineDrafts(Object.fromEntries(normalized.map((line) => [line.id, {
        quantity: line.counted_quantity == null ? "" : String(line.counted_quantity),
        notes: line.notes ?? "",
      }])))
    }
    setLoadingLines(false)
  }, [supabase])

  useEffect(() => { void loadWorkspace() }, [loadWorkspace])
  useEffect(() => { void loadLines(selectedSessionId) }, [loadLines, selectedSessionId])

  const selected = sessions.find((session) => session.id === selectedSessionId) ?? null
  const countedLines = lines.filter((line) => line.counted_quantity != null).length
  const varianceLines = lines.filter((line) => line.variance != null && line.variance !== 0).length
  const totalVariance = lines.reduce((sum, line) => sum + (line.variance ?? 0), 0)
  const openLocations = new Set(sessions.filter((session) => ["in_progress", "submitted", "approved"].includes(session.status)).map((session) => session.warehouse_location_id))
  const eligibleLocations = locations.filter((location) => (positionCountByLocation[location.id] ?? 0) > 0 && !openLocations.has(location.id))

  async function createSession() {
    if (!newLocationId || !canOperate || saving) return
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc("create_inventory_count_session", {
      p_warehouse_location_id: newLocationId,
      p_notes: newNotes.trim() || null,
    })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo iniciar", description: rpcError.message, variant: "destructive" })

    toast({ title: "Conteo iniciado", description: `${data?.count_code ?? "Sesión"} creó un snapshot y congeló la ubicación para movimientos de stock.` })
    setNewLocationId("")
    setNewNotes("")
    await loadWorkspace()
    if (data?.session_id) setSelectedSessionId(String(data.session_id))
  }

  async function saveLine(line: CountLine) {
    if (!selected || selected.status !== "in_progress" || !canOperate || saving) return
    const draft = lineDrafts[line.id] ?? { quantity: "", notes: "" }
    const quantity = Number(draft.quantity)
    if (!Number.isFinite(quantity) || quantity < 0) return toast({ title: "Cantidad inválida", description: "El conteo físico debe ser cero o mayor.", variant: "destructive" })

    setSaving(true)
    const { error: rpcError } = await supabase.rpc("record_inventory_count_line", {
      p_line_id: line.id,
      p_counted_quantity: quantity,
      p_notes: draft.notes.trim() || null,
    })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo registrar", description: rpcError.message, variant: "destructive" })
    await loadLines(selected.id)
  }

  async function submitSession() {
    if (!selected || saving) return
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc("submit_inventory_count_session", { p_session_id: selected.id })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo enviar", description: rpcError.message, variant: "destructive" })
    toast({ title: "Conteo enviado a revisión", description: `${Number(data?.variance_count ?? 0)} líneas presentan diferencia.` })
    await loadWorkspace()
    await loadLines(selected.id)
  }

  async function reviewSession(approved: boolean) {
    if (!selected || !canApprove || saving) return
    setSaving(true)
    const { error: rpcError } = await supabase.rpc("review_inventory_count_session", {
      p_session_id: selected.id,
      p_approved: approved,
      p_notes: reviewNotes.trim() || null,
    })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo revisar", description: rpcError.message, variant: "destructive" })
    toast({ title: approved ? "Conteo aprobado" : "Conteo rechazado", description: approved ? "Las diferencias están listas para aplicación controlada." : "La ubicación quedó liberada sin modificar saldos." })
    setReviewNotes("")
    await loadWorkspace()
  }

  async function applySession() {
    if (!selected || !canApprove || saving) return
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc("apply_inventory_count_session", { p_session_id: selected.id })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo aplicar", description: rpcError.message, variant: "destructive" })
    toast({ title: "Conteo aplicado", description: `${Number(data?.adjusted_lines ?? 0)} líneas generaron ajuste auditable en el kardex.` })
    await loadWorkspace()
    await loadLines(selected.id)
  }

  async function cancelSession() {
    if (!selected || !cancelReason.trim() || !canOperate || saving) return
    setSaving(true)
    const { error: rpcError } = await supabase.rpc("cancel_inventory_count_session", { p_session_id: selected.id, p_reason: cancelReason.trim() })
    setSaving(false)
    if (rpcError) return toast({ title: "No se pudo cancelar", description: rpcError.message, variant: "destructive" })
    toast({ title: "Conteo cancelado", description: "La ubicación quedó liberada y ningún saldo fue modificado." })
    setCancelReason("")
    await loadWorkspace()
  }

  return (
    <AppLayout>
      <PageHeader
        title="Conteos cíclicos"
        description="Conteo físico ciego, diferencias controladas, aprobación y aplicación atómica al kardex."
        actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void loadWorkspace()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button><Button variant="outline" asChild><Link href="/inventory/stock"><ArrowLeft className="mr-2 h-4 w-4" />Stock</Link></Button></div>}
      />

      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
        {!accessLoading && !canOperate && <Card className="border-amber-300"><CardContent className="p-4 text-sm text-amber-800">Tu acceso permite consultar sólo lo autorizado. Crear o registrar conteos requiere <strong>inventory.process</strong> y scope de Inventario.</CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Sesiones abiertas" value={sessions.filter((session) => ["in_progress", "submitted", "approved"].includes(session.status)).length} />
          <Metric title="Pendientes de revisión" value={sessions.filter((session) => session.status === "submitted").length} alert={sessions.some((session) => session.status === "submitted")} />
          <Metric title="Ubicaciones con stock" value={Object.keys(positionCountByLocation).length} />
          <Metric title="Conteos aplicados" value={sessions.filter((session) => session.status === "applied").length} />
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" />Iniciar conteo</CardTitle><CardDescription>Al iniciar, se captura el saldo de cada ítem y la ubicación queda congelada para movimientos de consumibles hasta cerrar la sesión.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-[minmax(280px,0.8fr)_minmax(320px,1fr)_auto]">
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={newLocationId} onChange={(event) => setNewLocationId(event.target.value)}><option value="">Seleccionar ubicación con stock</option>{eligibleLocations.map((location) => <option key={location.id} value={location.id}>{location.warehouse?.name ?? "Bodega"} · {location.code} · {location.name} · {positionCountByLocation[location.id] ?? 0} ítems</option>)}</select>
            <Input placeholder="Nota opcional: sector, responsable, motivo del conteo" value={newNotes} onChange={(event) => setNewNotes(event.target.value)} />
            <Button onClick={() => void createSession()} disabled={!newLocationId || !canOperate || saving}>Iniciar y congelar</Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card>
            <CardHeader><CardTitle>Sesiones</CardTitle><CardDescription>Últimos 100 conteos dentro de tu scope.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando sesiones…</p> : sessions.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground"><Warehouse className="mx-auto mb-3 h-7 w-7" /><p>No existen conteos todavía.</p></div> : sessions.map((session) => <button key={session.id} type="button" className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/40 ${selectedSessionId === session.id ? "border-primary bg-muted/30" : ""}`} onClick={() => setSelectedSessionId(session.id)}><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold">{session.count_code}</p><p className="mt-1 font-medium">{session.location?.warehouse?.name ?? "Bodega"} · {session.location?.name ?? "Ubicación"}</p></div><StatusBadge status={session.status} /></div><p className="mt-2 text-xs text-muted-foreground">{new Date(session.created_at).toLocaleString("es-CL")}{session.notes ? ` · ${session.notes}` : ""}</p></button>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{selected?.count_code ?? "Detalle de conteo"}</CardTitle><CardDescription>{selected ? `${selected.location?.warehouse?.name ?? "Bodega"} · ${selected.location?.code ?? ""} ${selected.location?.name ?? ""}` : "Selecciona una sesión."}</CardDescription></div>{selected && <StatusBadge status={selected.status} />}</div></CardHeader>
            <CardContent className="space-y-5">
              {!selected ? <p className="py-12 text-center text-sm text-muted-foreground">No hay una sesión seleccionada.</p> : <>
                <div className="grid gap-3 sm:grid-cols-3"><MiniMetric title="Contados" value={`${countedLines}/${lines.length}`} /><MiniMetric title="Con diferencia" value={selected.status === "in_progress" ? "Oculto" : varianceLines} /><MiniMetric title="Diferencia neta" value={selected.status === "in_progress" ? "Oculta" : totalVariance.toLocaleString("es-CL", { maximumFractionDigits: 3, signDisplay: "always" })} /></div>

                {selected.status === "in_progress" && <div className="flex items-start gap-3 rounded-lg border border-sky-300 bg-sky-50/40 p-3 text-sm text-sky-900"><EyeOff className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">Conteo ciego activo</p><p className="text-xs">El saldo esperado y las diferencias permanecen ocultos hasta enviar el conteo, reduciendo sesgo durante el conteo físico.</p></div></div>}

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Ítem</TableHead>{selected.status !== "in_progress" && <TableHead className="text-right">Esperado</TableHead>}<TableHead className="text-right">Contado</TableHead>{selected.status !== "in_progress" && <TableHead className="text-right">Diferencia</TableHead>}<TableHead>Nota</TableHead>{selected.status === "in_progress" && <TableHead className="text-right">Guardar</TableHead>}</TableRow></TableHeader>
                    <TableBody>
                      {loadingLines ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Cargando líneas…</TableCell></TableRow> : lines.map((line) => {
                        const draft = lineDrafts[line.id] ?? { quantity: "", notes: "" }
                        const variance = line.variance ?? 0
                        return <TableRow key={line.id}><TableCell><p className="font-medium">{line.stock_item?.name ?? "Ítem"}</p><p className="font-mono text-xs text-muted-foreground">{line.stock_item?.item_code ?? line.stock_item_id}</p></TableCell>{selected.status !== "in_progress" && <TableCell className="text-right">{line.expected_quantity.toLocaleString("es-CL")} {line.stock_item?.unit ?? ""}</TableCell>}<TableCell className="text-right">{selected.status === "in_progress" ? <Input className="ml-auto w-28 text-right" type="number" min="0" step="any" value={draft.quantity} onChange={(event) => setLineDrafts((current) => ({ ...current, [line.id]: { ...draft, quantity: event.target.value } }))} /> : <span className="font-semibold">{line.counted_quantity?.toLocaleString("es-CL") ?? "—"} {line.stock_item?.unit ?? ""}</span>}</TableCell>{selected.status !== "in_progress" && <TableCell className={`text-right font-semibold ${variance === 0 ? "text-emerald-700" : "text-amber-700"}`}>{variance.toLocaleString("es-CL", { maximumFractionDigits: 3, signDisplay: "always" })}</TableCell>}<TableCell>{selected.status === "in_progress" ? <Input value={draft.notes} onChange={(event) => setLineDrafts((current) => ({ ...current, [line.id]: { ...draft, notes: event.target.value } }))} placeholder="Opcional" /> : <span className="text-xs text-muted-foreground">{line.notes || "—"}</span>}</TableCell>{selected.status === "in_progress" && <TableCell className="text-right"><Button size="sm" variant={line.counted_quantity == null ? "default" : "outline"} disabled={saving || !canOperate || draft.quantity === ""} onClick={() => void saveLine(line)}>{line.counted_quantity == null ? "Registrar" : "Actualizar"}</Button></TableCell>}</TableRow>
                      })}
                    </TableBody>
                  </Table>
                </div>

                {selected.status === "in_progress" && <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Cerrar captura física</p><p className="text-xs text-muted-foreground">Sólo se puede enviar cuando todas las líneas tienen cantidad contada.</p></div><Button disabled={saving || !canOperate || countedLines !== lines.length || lines.length === 0} onClick={() => void submitSession()}>Enviar a revisión</Button></div>}

                {selected.status === "submitted" && <div className="space-y-3 rounded-lg border border-amber-300 p-4"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-amber-700" /><div><p className="font-medium">Revisión de diferencias</p><p className="text-xs text-muted-foreground">Un aprobador debe aceptar o rechazar antes de modificar el kardex.</p></div></div><Input placeholder="Notas de revisión" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} /><div className="flex gap-2"><Button disabled={!canApprove || saving} onClick={() => void reviewSession(true)}><CheckCircle2 className="mr-2 h-4 w-4" />Aprobar</Button><Button variant="outline" disabled={!canApprove || saving} onClick={() => void reviewSession(false)}><XCircle className="mr-2 h-4 w-4" />Rechazar</Button></div></div>}

                {selected.status === "approved" && <div className="rounded-lg border border-violet-300 p-4"><p className="font-medium">Aprobado para aplicación</p><p className="mt-1 text-xs text-muted-foreground">La aplicación verifica que ningún saldo haya cambiado desde el snapshot y genera un movimiento de ajuste por cada diferencia.</p><Button className="mt-3" disabled={!canApprove || saving} onClick={() => void applySession()}>Aplicar diferencias al kardex</Button></div>}

                {["in_progress", "submitted", "approved"].includes(selected.status) && <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row"><Input placeholder="Motivo obligatorio para cancelar" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /><Button variant="outline" disabled={!canOperate || saving || !cancelReason.trim()} onClick={() => void cancelSession()}>Cancelar conteo</Button></div>}

                {selected.review_notes && <div className="rounded-lg border bg-muted/20 p-3 text-sm"><p className="font-medium">Nota de revisión</p><p className="mt-1 text-muted-foreground">{selected.review_notes}</p></div>}
              </>}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const copy = STATUS_COPY[status]
  return <Badge variant="outline" className={copy.className}>{copy.label}</Badge>
}

function Metric({ title, value, alert = false }: { title: string; value: number; alert?: boolean }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value.toLocaleString("es-CL")}</div></CardContent></Card>
}

function MiniMetric({ title, value }: { title: string; value: number | string }) {
  return <div className="rounded-lg border bg-muted/15 p-3"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-lg font-semibold">{typeof value === "number" ? value.toLocaleString("es-CL") : value}</p></div>
}
