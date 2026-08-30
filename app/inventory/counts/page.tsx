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
import { useLanguage } from "@/lib/hooks/use-language"
import { createBrowserClient } from "@/lib/supabase/client"

type SessionStatus = "in_progress" | "submitted" | "approved" | "rejected" | "applied" | "cancelled"
type LocationOption = { id: string; code: string; name: string; warehouse: { id: string; code: string; name: string; location_id: string | null } | null }
type CountSession = { id: string; count_code: string; warehouse_location_id: string; status: SessionStatus; notes: string | null; review_notes: string | null; created_at: string; submitted_at: string | null; reviewed_at: string | null; applied_at: string | null; location: LocationOption | null }
type CountLine = { id: string; session_id: string; stock_item_id: string; expected_quantity: number; counted_quantity: number | null; variance: number | null; notes: string | null; counted_at: string | null; stock_item: { id: string; item_code: string; name: string; unit: string; quantity_on_hand: number } | null }
type RawWarehouse = { id: string; code: string; name: string; location_id: string | null }
type RawLocation = { id: string; code: string; name: string; warehouses: RawWarehouse | RawWarehouse[] | null }
type RawSession = Omit<CountSession, "location"> & { warehouse_location: RawLocation | RawLocation[] | null }
type RawLine = Omit<CountLine, "stock_item"> & { inventory_stock_items: CountLine["stock_item"] | CountLine["stock_item"][] | null }

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const COPY = {
  en: {
    title: "Cycle counts", description: "Blind physical counts, controlled variances, approval, and atomic Kardex application.", refresh: "Refresh", stock: "Stock", loadError: "Count workspace could not be loaded.", linesError: "Count lines could not be loaded.", restricted: "Your access only permits authorized visibility. Creating or recording counts requires inventory.process and Inventory scope.", openSessions: "Open sessions", pendingReview: "Pending review", locations: "Locations with stock", appliedCounts: "Applied counts", start: "Start count", startDescription: "Starting captures each item balance and freezes the location for consumable stock movements until the session closes.", selectLocation: "Select a location with stock", warehouse: "Warehouse", items: "items", notePlaceholder: "Optional note: area, responsible person, or reason for the count", startFreeze: "Start and freeze", sessions: "Sessions", sessionsDescription: "Latest 100 counts within your scope.", loadingSessions: "Loading sessions…", noSessions: "No counts exist yet.", location: "Location", countDetail: "Count detail", selectSession: "Select a session.", noSelected: "No session selected.", counted: "Counted", varianceCount: "With variance", netVariance: "Net variance", hidden: "Hidden", blindActive: "Blind count active", blindDetail: "Expected balances and variances remain hidden until submission, reducing bias during physical counting.", item: "Item", expected: "Expected", countedColumn: "Counted", difference: "Difference", note: "Note", save: "Save", loadingLines: "Loading lines…", optional: "Optional", register: "Record", update: "Update", closeCapture: "Close physical capture", closeDetail: "Submission is available only after every line has a counted quantity.", submit: "Submit for review", review: "Variance review", reviewDetail: "An approver must accept or reject before the Kardex can be modified.", reviewNotes: "Review notes", approve: "Approve", reject: "Reject", approvedTitle: "Approved for application", approvedDetail: "Application verifies that no balance changed since the snapshot and creates one auditable adjustment movement per variance.", apply: "Apply variances to Kardex", cancelReason: "Mandatory cancellation reason", cancel: "Cancel count", reviewNote: "Review note", startFailed: "Count could not be started.", started: "Count started", startedDetail: "created a snapshot and froze the location for stock movements.", invalidQty: "Invalid quantity", invalidQtyDetail: "Physical count must be zero or greater.", saveFailed: "Count line could not be recorded.", submitFailed: "Count could not be submitted.", submitted: "Count submitted for review", varianceLines: "lines have a variance.", reviewFailed: "Count could not be reviewed.", approved: "Count approved", rejected: "Count rejected", approvedResult: "Variances are ready for controlled application.", rejectedResult: "The location was released without changing balances.", applyFailed: "Count could not be applied.", applied: "Count applied", adjustedLines: "lines generated an auditable Kardex adjustment.", cancelFailed: "Count could not be cancelled.", cancelled: "Count cancelled", cancelledDetail: "The location was released and no balance was modified.", session: "Session" },
  es: {
    title: "Conteos cíclicos", description: "Conteo físico ciego, diferencias controladas, aprobación y aplicación atómica al kardex.", refresh: "Actualizar", stock: "Stock", loadError: "No fue posible cargar el espacio de conteos.", linesError: "No fue posible cargar las líneas del conteo.", restricted: "Tu acceso permite consultar sólo lo autorizado. Crear o registrar conteos requiere inventory.process y scope de Inventario.", openSessions: "Sesiones abiertas", pendingReview: "Pendientes de revisión", locations: "Ubicaciones con stock", appliedCounts: "Conteos aplicados", start: "Iniciar conteo", startDescription: "Al iniciar, se captura el saldo de cada ítem y la ubicación queda congelada para movimientos de consumibles hasta cerrar la sesión.", selectLocation: "Seleccionar ubicación con stock", warehouse: "Bodega", items: "ítems", notePlaceholder: "Nota opcional: sector, responsable o motivo del conteo", startFreeze: "Iniciar y congelar", sessions: "Sesiones", sessionsDescription: "Últimos 100 conteos dentro de tu scope.", loadingSessions: "Cargando sesiones…", noSessions: "No existen conteos todavía.", location: "Ubicación", countDetail: "Detalle de conteo", selectSession: "Selecciona una sesión.", noSelected: "No hay una sesión seleccionada.", counted: "Contados", varianceCount: "Con diferencia", netVariance: "Diferencia neta", hidden: "Oculto", blindActive: "Conteo ciego activo", blindDetail: "El saldo esperado y las diferencias permanecen ocultos hasta enviar el conteo, reduciendo sesgo durante el conteo físico.", item: "Ítem", expected: "Esperado", countedColumn: "Contado", difference: "Diferencia", note: "Nota", save: "Guardar", loadingLines: "Cargando líneas…", optional: "Opcional", register: "Registrar", update: "Actualizar", closeCapture: "Cerrar captura física", closeDetail: "Sólo se puede enviar cuando todas las líneas tienen cantidad contada.", submit: "Enviar a revisión", review: "Revisión de diferencias", reviewDetail: "Un aprobador debe aceptar o rechazar antes de modificar el kardex.", reviewNotes: "Notas de revisión", approve: "Aprobar", reject: "Rechazar", approvedTitle: "Aprobado para aplicación", approvedDetail: "La aplicación verifica que ningún saldo haya cambiado desde el snapshot y genera un movimiento de ajuste por cada diferencia.", apply: "Aplicar diferencias al kardex", cancelReason: "Motivo obligatorio para cancelar", cancel: "Cancelar conteo", reviewNote: "Nota de revisión", startFailed: "No se pudo iniciar el conteo.", started: "Conteo iniciado", startedDetail: "creó un snapshot y congeló la ubicación para movimientos de stock.", invalidQty: "Cantidad inválida", invalidQtyDetail: "El conteo físico debe ser cero o mayor.", saveFailed: "No se pudo registrar la línea.", submitFailed: "No se pudo enviar el conteo.", submitted: "Conteo enviado a revisión", varianceLines: "líneas presentan diferencia.", reviewFailed: "No se pudo revisar el conteo.", approved: "Conteo aprobado", rejected: "Conteo rechazado", approvedResult: "Las diferencias están listas para aplicación controlada.", rejectedResult: "La ubicación quedó liberada sin modificar saldos.", applyFailed: "No se pudo aplicar el conteo.", applied: "Conteo aplicado", adjustedLines: "líneas generaron ajuste auditable en el kardex.", cancelFailed: "No se pudo cancelar el conteo.", cancelled: "Conteo cancelado", cancelledDetail: "La ubicación quedó liberada y ningún saldo fue modificado.", session: "Sesión" },
  de: {
    title: "Zyklische Inventurzählungen", description: "Blinde physische Zählung, kontrollierte Abweichungen, Genehmigung und atomare Anwendung im Kardex.", refresh: "Aktualisieren", stock: "Bestand", loadError: "Der Zählungsarbeitsbereich konnte nicht geladen werden.", linesError: "Die Zählungszeilen konnten nicht geladen werden.", restricted: "Dein Zugriff erlaubt nur autorisierte Sichtbarkeit. Das Erstellen und Erfassen von Zählungen erfordert inventory.process und Inventar-Scope.", openSessions: "Offene Sitzungen", pendingReview: "Zur Prüfung", locations: "Standorte mit Bestand", appliedCounts: "Angewandte Zählungen", start: "Zählung starten", startDescription: "Beim Start wird der Bestand jedes Artikels erfasst und der Standort bis zum Abschluss für Verbrauchsmaterialbewegungen gesperrt.", selectLocation: "Standort mit Bestand auswählen", warehouse: "Lager", items: "Artikel", notePlaceholder: "Optionale Notiz: Bereich, Verantwortlicher oder Zählgrund", startFreeze: "Starten und sperren", sessions: "Sitzungen", sessionsDescription: "Letzte 100 Zählungen innerhalb deines Scopes.", loadingSessions: "Sitzungen werden geladen…", noSessions: "Noch keine Zählungen vorhanden.", location: "Standort", countDetail: "Zählungsdetails", selectSession: "Sitzung auswählen.", noSelected: "Keine Sitzung ausgewählt.", counted: "Gezählt", varianceCount: "Mit Abweichung", netVariance: "Nettoabweichung", hidden: "Ausgeblendet", blindActive: "Blinde Zählung aktiv", blindDetail: "Erwartete Bestände und Abweichungen bleiben bis zur Einreichung verborgen und reduzieren so Verzerrungen bei der physischen Zählung.", item: "Artikel", expected: "Erwartet", countedColumn: "Gezählt", difference: "Abweichung", note: "Notiz", save: "Speichern", loadingLines: "Zeilen werden geladen…", optional: "Optional", register: "Erfassen", update: "Aktualisieren", closeCapture: "Physische Erfassung schließen", closeDetail: "Einreichen ist erst möglich, wenn jede Zeile eine gezählte Menge enthält.", submit: "Zur Prüfung einreichen", review: "Abweichungsprüfung", reviewDetail: "Ein Genehmiger muss akzeptieren oder ablehnen, bevor der Kardex geändert werden darf.", reviewNotes: "Prüfnotizen", approve: "Genehmigen", reject: "Ablehnen", approvedTitle: "Zur Anwendung genehmigt", approvedDetail: "Die Anwendung prüft, dass sich seit dem Snapshot kein Bestand geändert hat, und erzeugt für jede Abweichung eine prüfbare Korrekturbewegung.", apply: "Abweichungen auf Kardex anwenden", cancelReason: "Pflichtgrund für Stornierung", cancel: "Zählung stornieren", reviewNote: "Prüfnotiz", startFailed: "Zählung konnte nicht gestartet werden.", started: "Zählung gestartet", startedDetail: "hat einen Snapshot erstellt und den Standort für Bestandsbewegungen gesperrt.", invalidQty: "Ungültige Menge", invalidQtyDetail: "Die physische Zählung muss null oder größer sein.", saveFailed: "Zählungszeile konnte nicht erfasst werden.", submitFailed: "Zählung konnte nicht eingereicht werden.", submitted: "Zählung zur Prüfung eingereicht", varianceLines: "Zeilen weisen eine Abweichung auf.", reviewFailed: "Zählung konnte nicht geprüft werden.", approved: "Zählung genehmigt", rejected: "Zählung abgelehnt", approvedResult: "Die Abweichungen sind für die kontrollierte Anwendung bereit.", rejectedResult: "Der Standort wurde freigegeben, ohne Bestände zu ändern.", applyFailed: "Zählung konnte nicht angewendet werden.", applied: "Zählung angewendet", adjustedLines: "Zeilen erzeugten eine prüfbare Kardex-Korrektur.", cancelFailed: "Zählung konnte nicht storniert werden.", cancelled: "Zählung storniert", cancelledDetail: "Der Standort wurde freigegeben und kein Bestand geändert.", session: "Sitzung" },
} as const
const STATUS_LABELS = {
  en: { in_progress: "Counting", submitted: "In review", approved: "Approved", rejected: "Rejected", applied: "Applied", cancelled: "Cancelled" },
  es: { in_progress: "En conteo", submitted: "En revisión", approved: "Aprobado", rejected: "Rechazado", applied: "Aplicado", cancelled: "Cancelado" },
  de: { in_progress: "In Zählung", submitted: "In Prüfung", approved: "Genehmigt", rejected: "Abgelehnt", applied: "Angewendet", cancelled: "Storniert" },
} as const
const STATUS_CLASS: Record<SessionStatus, string> = { in_progress: "border-sky-300 text-sky-700", submitted: "border-amber-300 text-amber-700", approved: "border-violet-300 text-violet-700", rejected: "border-red-300 text-red-700", applied: "border-emerald-300 text-emerald-700", cancelled: "text-muted-foreground" }

function firstRelation<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }
function asNumber(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }

export default function InventoryCountsPage() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const locale = LOCALES[language]
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }), [locale])
  const signed = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 3, signDisplay: "always" }), [locale])
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }), [locale])
  const localize = (href: string) => `/${language}${href}`
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
    setLoading(true); setError(null)
    const [sessionResult, locationResult, stockResult] = await Promise.all([
      supabase.from("inventory_count_sessions").select("id,count_code,warehouse_location_id,status,notes,review_notes,created_at,submitted_at,reviewed_at,applied_at,warehouse_location:warehouse_locations(id,code,name,warehouses(id,code,name,location_id))").order("created_at", { ascending: false }).limit(100),
      supabase.from("warehouse_locations").select("id,code,name,warehouses(id,code,name,location_id)").eq("is_active", true).order("name"),
      supabase.from("inventory_stock_status").select("id,warehouse_location_id").eq("is_active", true),
    ])
    const firstError = sessionResult.error || locationResult.error || stockResult.error
    if (firstError) {
      console.error("[inventory-counts] workspace load failed", firstError)
      setError(copy.loadError); setSessions([]); setLocations([]); setPositionCountByLocation({}); setLoading(false); return
    }
    const normalizedLocations = ((locationResult.data ?? []) as RawLocation[]).map((row) => ({ id: row.id, code: row.code, name: row.name, warehouse: firstRelation(row.warehouses) }))
    const locationMap = new Map(normalizedLocations.map((location) => [location.id, location]))
    const normalizedSessions = ((sessionResult.data ?? []) as RawSession[]).map((row) => ({ ...row, status: row.status as SessionStatus, location: locationMap.get(row.warehouse_location_id) ?? (() => { const relation = firstRelation(row.warehouse_location); if (!relation) return null; return { id: relation.id, code: relation.code, name: relation.name, warehouse: firstRelation(relation.warehouses) } })() }))
    const counts: Record<string, number> = {}; ((stockResult.data ?? []) as Array<{ warehouse_location_id: string }>).forEach((row) => { counts[row.warehouse_location_id] = (counts[row.warehouse_location_id] ?? 0) + 1 })
    setSessions(normalizedSessions); setLocations(normalizedLocations); setPositionCountByLocation(counts); setSelectedSessionId((current) => current && normalizedSessions.some((session) => session.id === current) ? current : normalizedSessions[0]?.id ?? ""); setLoading(false)
  }, [copy.loadError, supabase])

  const loadLines = useCallback(async (sessionId: string) => {
    if (!sessionId) { setLines([]); setLineDrafts({}); return }
    setLoadingLines(true)
    const { data, error: lineError } = await supabase.from("inventory_count_lines").select("id,session_id,stock_item_id,expected_quantity,counted_quantity,variance,notes,counted_at,inventory_stock_items(id,item_code,name,unit,quantity_on_hand)").eq("session_id", sessionId).order("created_at")
    if (lineError) {
      console.error("[inventory-counts] lines load failed", lineError)
      setError(copy.linesError); setLines([]); setLineDrafts({})
    } else {
      const normalized = ((data ?? []) as RawLine[]).map((row) => ({ ...row, expected_quantity: asNumber(row.expected_quantity), counted_quantity: row.counted_quantity == null ? null : asNumber(row.counted_quantity), variance: row.variance == null ? null : asNumber(row.variance), stock_item: firstRelation(row.inventory_stock_items) }))
      setLines(normalized); setLineDrafts(Object.fromEntries(normalized.map((line) => [line.id, { quantity: line.counted_quantity == null ? "" : String(line.counted_quantity), notes: line.notes ?? "" }])))
    }
    setLoadingLines(false)
  }, [copy.linesError, supabase])

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
    const { data, error: rpcError } = await supabase.rpc("create_inventory_count_session", { p_warehouse_location_id: newLocationId, p_notes: newNotes.trim() || null })
    setSaving(false)
    if (rpcError) { console.error("[inventory-counts] create failed", rpcError); return toast({ title: copy.startFailed, variant: "destructive" }) }
    toast({ title: copy.started, description: `${data?.count_code ?? copy.session} ${copy.startedDetail}` }); setNewLocationId(""); setNewNotes(""); await loadWorkspace(); if (data?.session_id) setSelectedSessionId(String(data.session_id))
  }

  async function saveLine(line: CountLine) {
    if (!selected || selected.status !== "in_progress" || !canOperate || saving) return
    const draft = lineDrafts[line.id] ?? { quantity: "", notes: "" }; const quantity = Number(draft.quantity)
    if (!Number.isFinite(quantity) || quantity < 0) return toast({ title: copy.invalidQty, description: copy.invalidQtyDetail, variant: "destructive" })
    setSaving(true); const { error: rpcError } = await supabase.rpc("record_inventory_count_line", { p_line_id: line.id, p_counted_quantity: quantity, p_notes: draft.notes.trim() || null }); setSaving(false)
    if (rpcError) { console.error("[inventory-counts] line save failed", rpcError); return toast({ title: copy.saveFailed, variant: "destructive" }) }
    await loadLines(selected.id)
  }

  async function submitSession() {
    if (!selected || saving) return
    setSaving(true); const { data, error: rpcError } = await supabase.rpc("submit_inventory_count_session", { p_session_id: selected.id }); setSaving(false)
    if (rpcError) { console.error("[inventory-counts] submit failed", rpcError); return toast({ title: copy.submitFailed, variant: "destructive" }) }
    toast({ title: copy.submitted, description: `${number.format(Number(data?.variance_count ?? 0))} ${copy.varianceLines}` }); await loadWorkspace(); await loadLines(selected.id)
  }

  async function reviewSession(approved: boolean) {
    if (!selected || !canApprove || saving) return
    setSaving(true); const { error: rpcError } = await supabase.rpc("review_inventory_count_session", { p_session_id: selected.id, p_approved: approved, p_notes: reviewNotes.trim() || null }); setSaving(false)
    if (rpcError) { console.error("[inventory-counts] review failed", rpcError); return toast({ title: copy.reviewFailed, variant: "destructive" }) }
    toast({ title: approved ? copy.approved : copy.rejected, description: approved ? copy.approvedResult : copy.rejectedResult }); setReviewNotes(""); await loadWorkspace()
  }

  async function applySession() {
    if (!selected || !canApprove || saving) return
    setSaving(true); const { data, error: rpcError } = await supabase.rpc("apply_inventory_count_session", { p_session_id: selected.id }); setSaving(false)
    if (rpcError) { console.error("[inventory-counts] apply failed", rpcError); return toast({ title: copy.applyFailed, variant: "destructive" }) }
    toast({ title: copy.applied, description: `${number.format(Number(data?.adjusted_lines ?? 0))} ${copy.adjustedLines}` }); await loadWorkspace(); await loadLines(selected.id)
  }

  async function cancelSession() {
    if (!selected || !cancelReason.trim() || !canOperate || saving) return
    setSaving(true); const { error: rpcError } = await supabase.rpc("cancel_inventory_count_session", { p_session_id: selected.id, p_reason: cancelReason.trim() }); setSaving(false)
    if (rpcError) { console.error("[inventory-counts] cancel failed", rpcError); return toast({ title: copy.cancelFailed, variant: "destructive" }) }
    toast({ title: copy.cancelled, description: copy.cancelledDetail }); setCancelReason(""); await loadWorkspace()
  }

  return <AppLayout>
    <PageHeader title={copy.title} description={copy.description} actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void loadWorkspace()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{copy.refresh}</Button><Button variant="outline" asChild><Link href={localize("/inventory/stock")}><ArrowLeft className="mr-2 h-4 w-4" />{copy.stock}</Link></Button></div>} />
    <div className="space-y-6 p-4 sm:p-8">
      {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      {!accessLoading && !canOperate && <Card className="border-amber-300"><CardContent className="p-4 text-sm text-amber-800">{copy.restricted}</CardContent></Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric title={copy.openSessions} value={sessions.filter((session) => ["in_progress", "submitted", "approved"].includes(session.status)).length} locale={locale} /><Metric title={copy.pendingReview} value={sessions.filter((session) => session.status === "submitted").length} alert={sessions.some((session) => session.status === "submitted")} locale={locale} /><Metric title={copy.locations} value={Object.keys(positionCountByLocation).length} locale={locale} /><Metric title={copy.appliedCounts} value={sessions.filter((session) => session.status === "applied").length} locale={locale} /></div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" />{copy.start}</CardTitle><CardDescription>{copy.startDescription}</CardDescription></CardHeader><CardContent className="grid gap-3 lg:grid-cols-[minmax(280px,0.8fr)_minmax(320px,1fr)_auto]"><select className="rounded-md border bg-background px-3 py-2 text-sm" value={newLocationId} onChange={(event) => setNewLocationId(event.target.value)}><option value="">{copy.selectLocation}</option>{eligibleLocations.map((location) => <option key={location.id} value={location.id}>{location.warehouse?.name ?? copy.warehouse} · {location.code} · {location.name} · {number.format(positionCountByLocation[location.id] ?? 0)} {copy.items}</option>)}</select><Input placeholder={copy.notePlaceholder} value={newNotes} onChange={(event) => setNewNotes(event.target.value)} /><Button onClick={() => void createSession()} disabled={!newLocationId || !canOperate || saving}>{copy.startFreeze}</Button></CardContent></Card>
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card><CardHeader><CardTitle>{copy.sessions}</CardTitle><CardDescription>{copy.sessionsDescription}</CardDescription></CardHeader><CardContent className="space-y-2">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">{copy.loadingSessions}</p> : sessions.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground"><Warehouse className="mx-auto mb-3 h-7 w-7" /><p>{copy.noSessions}</p></div> : sessions.map((session) => <button key={session.id} type="button" className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/40 ${selectedSessionId === session.id ? "border-primary bg-muted/30" : ""}`} onClick={() => setSelectedSessionId(session.id)}><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold">{session.count_code}</p><p className="mt-1 font-medium">{session.location?.warehouse?.name ?? copy.warehouse} · {session.location?.name ?? copy.location}</p></div><StatusBadge status={session.status} label={STATUS_LABELS[language][session.status]} /></div><p className="mt-2 text-xs text-muted-foreground">{dateTime.format(new Date(session.created_at))}{session.notes ? ` · ${session.notes}` : ""}</p></button>)}</CardContent></Card>
        <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{selected?.count_code ?? copy.countDetail}</CardTitle><CardDescription>{selected ? `${selected.location?.warehouse?.name ?? copy.warehouse} · ${selected.location?.code ?? ""} ${selected.location?.name ?? ""}` : copy.selectSession}</CardDescription></div>{selected && <StatusBadge status={selected.status} label={STATUS_LABELS[language][selected.status]} />}</div></CardHeader><CardContent className="space-y-5">{!selected ? <p className="py-12 text-center text-sm text-muted-foreground">{copy.noSelected}</p> : <>
          <div className="grid gap-3 sm:grid-cols-3"><MiniMetric title={copy.counted} value={`${number.format(countedLines)}/${number.format(lines.length)}`} /><MiniMetric title={copy.varianceCount} value={selected.status === "in_progress" ? copy.hidden : number.format(varianceLines)} /><MiniMetric title={copy.netVariance} value={selected.status === "in_progress" ? copy.hidden : signed.format(totalVariance)} /></div>
          {selected.status === "in_progress" && <div className="flex items-start gap-3 rounded-lg border border-sky-300 bg-sky-50/40 p-3 text-sm text-sky-900"><EyeOff className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">{copy.blindActive}</p><p className="text-xs">{copy.blindDetail}</p></div></div>}
          <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>{copy.item}</TableHead>{selected.status !== "in_progress" && <TableHead className="text-right">{copy.expected}</TableHead>}<TableHead className="text-right">{copy.countedColumn}</TableHead>{selected.status !== "in_progress" && <TableHead className="text-right">{copy.difference}</TableHead>}<TableHead>{copy.note}</TableHead>{selected.status === "in_progress" && <TableHead className="text-right">{copy.save}</TableHead>}</TableRow></TableHeader><TableBody>{loadingLines ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{copy.loadingLines}</TableCell></TableRow> : lines.map((line) => { const draft = lineDrafts[line.id] ?? { quantity: "", notes: "" }; const variance = line.variance ?? 0; return <TableRow key={line.id}><TableCell><p className="font-medium">{line.stock_item?.name ?? copy.item}</p><p className="font-mono text-xs text-muted-foreground">{line.stock_item?.item_code ?? line.stock_item_id}</p></TableCell>{selected.status !== "in_progress" && <TableCell className="text-right">{number.format(line.expected_quantity)} {line.stock_item?.unit ?? ""}</TableCell>}<TableCell className="text-right">{selected.status === "in_progress" ? <Input className="ml-auto w-28 text-right" type="number" min="0" step="any" value={draft.quantity} onChange={(event) => setLineDrafts((current) => ({ ...current, [line.id]: { ...draft, quantity: event.target.value } }))} /> : <span className="font-semibold">{line.counted_quantity == null ? "—" : number.format(line.counted_quantity)} {line.stock_item?.unit ?? ""}</span>}</TableCell>{selected.status !== "in_progress" && <TableCell className={`text-right font-semibold ${variance === 0 ? "text-emerald-700" : "text-amber-700"}`}>{signed.format(variance)}</TableCell>}<TableCell>{selected.status === "in_progress" ? <Input value={draft.notes} onChange={(event) => setLineDrafts((current) => ({ ...current, [line.id]: { ...draft, notes: event.target.value } }))} placeholder={copy.optional} /> : <span className="text-xs text-muted-foreground">{line.notes || "—"}</span>}</TableCell>{selected.status === "in_progress" && <TableCell className="text-right"><Button size="sm" variant={line.counted_quantity == null ? "default" : "outline"} disabled={saving || !canOperate || draft.quantity === ""} onClick={() => void saveLine(line)}>{line.counted_quantity == null ? copy.register : copy.update}</Button></TableCell>}</TableRow> })}</TableBody></Table></div>
          {selected.status === "in_progress" && <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{copy.closeCapture}</p><p className="text-xs text-muted-foreground">{copy.closeDetail}</p></div><Button disabled={saving || !canOperate || countedLines !== lines.length || lines.length === 0} onClick={() => void submitSession()}>{copy.submit}</Button></div>}
          {selected.status === "submitted" && <div className="space-y-3 rounded-lg border border-amber-300 p-4"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-amber-700" /><div><p className="font-medium">{copy.review}</p><p className="text-xs text-muted-foreground">{copy.reviewDetail}</p></div></div><Input placeholder={copy.reviewNotes} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} /><div className="flex gap-2"><Button disabled={!canApprove || saving} onClick={() => void reviewSession(true)}><CheckCircle2 className="mr-2 h-4 w-4" />{copy.approve}</Button><Button variant="outline" disabled={!canApprove || saving} onClick={() => void reviewSession(false)}><XCircle className="mr-2 h-4 w-4" />{copy.reject}</Button></div></div>}
          {selected.status === "approved" && <div className="rounded-lg border border-violet-300 p-4"><p className="font-medium">{copy.approvedTitle}</p><p className="mt-1 text-xs text-muted-foreground">{copy.approvedDetail}</p><Button className="mt-3" disabled={!canApprove || saving} onClick={() => void applySession()}>{copy.apply}</Button></div>}
          {["in_progress", "submitted", "approved"].includes(selected.status) && <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row"><Input placeholder={copy.cancelReason} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /><Button variant="outline" disabled={!canOperate || saving || !cancelReason.trim()} onClick={() => void cancelSession()}>{copy.cancel}</Button></div>}
          {selected.review_notes && <div className="rounded-lg border bg-muted/20 p-3 text-sm"><p className="font-medium">{copy.reviewNote}</p><p className="mt-1 text-muted-foreground">{selected.review_notes}</p></div>}
        </>}</CardContent></Card>
      </div>
    </div>
  </AppLayout>
}

function StatusBadge({ status, label }: { status: SessionStatus; label: string }) { return <Badge variant="outline" className={STATUS_CLASS[status]}>{label}</Badge> }
function Metric({ title, value, alert=false, locale }: { title:string; value:number; alert?:boolean; locale:string }) { return <Card className={alert?"border-amber-300":undefined}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{new Intl.NumberFormat(locale).format(value)}</div></CardContent></Card> }
function MiniMetric({ title, value }: { title:string; value:string }) { return <div className="rounded-lg border bg-muted/15 p-3"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-lg font-semibold">{value}</p></div> }
