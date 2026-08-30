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
import { useLanguage } from "@/lib/hooks/use-language"
import { createBrowserClient } from "@/lib/supabase/client"

type AuditStatus = "in_progress" | "submitted" | "approved" | "rejected" | "closed" | "cancelled"
type ScanStatus = "pending" | "present" | "missing" | "unexpected"
type WarehouseRelation = { id: string; code: string; name: string; location_id: string | null }
type LocationRelation = { id: string; code: string; name: string; warehouse_id: string; warehouses: WarehouseRelation | WarehouseRelation[] | null }
type LocationOption = { id: string; code: string; name: string; warehouse_id: string; warehouse: WarehouseRelation | null }
type RawSession = { id: string; audit_code: string; warehouse_location_id: string; status: AuditStatus; notes: string | null; review_notes: string | null; created_at: string; submitted_at: string | null; reviewed_at: string | null; closed_at: string | null; warehouse_location: LocationRelation | LocationRelation[] | null }
type AuditSession = Omit<RawSession, "warehouse_location"> & { location: LocationOption | null }
type AuditLine = { id: string; session_id: string; asset_id: string; asset_code_snapshot: string; asset_name_snapshot: string; is_expected: boolean; expected_location_id: string | null; observed_location_id: string | null; scan_status: ScanStatus; condition: string | null; notes: string | null; scanned_at: string | null }
type AssetOption = { id: string; asset_code: string; name: string; status: string | null; warehouse_location_id: string | null; assigned_to: string | null }
type CustodyRow = { asset_id: string; status: string }

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const COPY = {
  en: {
    title: "Physical asset audit", description: "Serialized verification by location: present, missing, unexpected, and condition findings, without automatic corrections.", refresh: "Refresh", inventory: "Inventory", loadError: "Asset audit workspace could not be loaded.", linesError: "Audit evidence could not be loaded.", restricted: "Creating and recording audits requires inventory.process and Inventory scope.", open: "Open audits", expected: "Expected", present: "Present", locationFindings: "Location findings", conditionFindings: "Condition findings", newAudit: "New audit", newDescription: "The snapshot excludes retired assets, assets under maintenance, and assets under active custody.", selectLocation: "Location with auditable assets", warehouse: "Warehouse", noLocation: "No location", context: "Objective, shift, or context", start: "Start audit", sessions: "Sessions", noSessions: "No audits recorded.", selectOrStart: "Select or start an audit.", location: "Location", blind: "Blind verification", blindDetail: "Pending snapshot assets remain hidden. Record only what you physically find; on submission, expected assets not scanned become Missing.", assetCode: "Exact asset code", good: "Good condition", observations: "With observations", damaged: "Damaged", observationOptional: "Optional observation", register: "Record", expectedSnapshot: "Expected snapshot", presentScans: "Present scans", missing: "Missing", unexpected: "Unexpected", submitHint: "On submission, every expected asset not scanned becomes formally missing.", submit: "Submit for review", cancelReason: "Cancellation reason", cancel: "Cancel", independentReview: "Independent review", independentDetail: "Approval does not change locations. It only enables formal closure of findings.", reviewNote: "Review note", reject: "Reject", approve: "Approve", approvedTitle: "Audit approved", approvedDetail: "Closing records missing, unexpected, and damage findings in the audit log without changing master data.", close: "Close and record findings", evidence: "Audit evidence", evidenceBlind: "Only scanned assets are shown; the pending snapshot remains hidden.", evidenceFull: "Complete snapshot and final result for each asset.", loadingEvidence: "Loading evidence…", noScans: "No assets scanned yet.", asset: "Asset", result: "Result", condition: "Condition", observation: "Observation", scanned: "Scanned", startFailed: "Audit could not be started.", started: "Audit started", session: "Session", snapshotOf: "captured a snapshot of", expectedAssets: "expected assets.", assetNotFound: "Asset not found", assetNotFoundDetail: "Enter an exact asset code visible in your scope.", scanFailed: "Scan could not be recorded.", unexpectedAsset: "Unexpected asset", presentAsset: "Asset present", submitFailed: "Audit could not be submitted.", submitted: "Audit submitted", missingAnd: "missing and", unexpectedReview: "unexpected assets require review.", reviewFailed: "Audit could not be reviewed.", approved: "Audit approved", rejected: "Audit rejected", approvedResult: "Findings can now be closed and recorded in the audit logs.", rejectedResult: "The session was closed as rejected without modifying assets.", closeFailed: "Audit could not be closed.", closed: "Audit closed", findingsLogged: "findings were recorded. No asset or location was changed automatically.", cancelFailed: "Audit could not be cancelled.", cancelled: "Audit cancelled", cancelledDetail: "No asset was modified." },
  es: {
    title: "Auditoría física de activos", description: "Verificación serializada por ubicación: presentes, faltantes, inesperados y condición, sin correcciones automáticas.", refresh: "Actualizar", inventory: "Inventario", loadError: "No fue posible cargar el espacio de auditorías de activos.", linesError: "No fue posible cargar la evidencia de auditoría.", restricted: "Crear y registrar auditorías requiere inventory.process y scope de Inventario.", open: "Auditorías abiertas", expected: "Esperados", present: "Presentes", locationFindings: "Hallazgos ubicación", conditionFindings: "Hallazgos condición", newAudit: "Nueva auditoría", newDescription: "El snapshot excluye activos retirados, en mantenimiento o bajo custodia activa.", selectLocation: "Ubicación con activos auditables", warehouse: "Bodega", noLocation: "Sin ubicación", context: "Objetivo, turno o contexto", start: "Iniciar auditoría", sessions: "Sesiones", noSessions: "Sin auditorías registradas.", selectOrStart: "Selecciona o inicia una auditoría.", location: "Ubicación", blind: "Verificación ciega", blindDetail: "Los activos pendientes del snapshot permanecen ocultos. Registra sólo lo que encuentres físicamente; al enviar, los no escaneados pasan a Faltante.", assetCode: "Código exacto del activo", good: "Buen estado", observations: "Con observaciones", damaged: "Dañado", observationOptional: "Observación opcional", register: "Registrar", expectedSnapshot: "Snapshot esperado", presentScans: "Escaneados presentes", missing: "Faltantes", unexpected: "Inesperados", submitHint: "Al enviar, todo esperado no escaneado queda formalmente faltante.", submit: "Enviar a revisión", cancelReason: "Motivo para cancelar", cancel: "Cancelar", independentReview: "Revisión independiente", independentDetail: "Aprobar no cambia ubicaciones. Sólo habilita el cierre formal de hallazgos.", reviewNote: "Nota de revisión", reject: "Rechazar", approve: "Aprobar", approvedTitle: "Auditoría aprobada", approvedDetail: "Cerrar registra faltantes, inesperados y daños en la bitácora, sin alterar datos maestros.", close: "Cerrar y registrar hallazgos", evidence: "Evidencia de auditoría", evidenceBlind: "Sólo se muestran activos ya escaneados; el snapshot pendiente permanece oculto.", evidenceFull: "Snapshot completo y resultado final de cada activo.", loadingEvidence: "Cargando evidencia…", noScans: "Aún no hay activos escaneados.", asset: "Activo", result: "Resultado", condition: "Condición", observation: "Observación", scanned: "Escaneado", startFailed: "No se pudo iniciar la auditoría.", started: "Auditoría iniciada", session: "Sesión", snapshotOf: "tomó un snapshot de", expectedAssets: "activos esperados.", assetNotFound: "Activo no encontrado", assetNotFoundDetail: "Ingresa un código de activo exacto y visible en tu scope.", scanFailed: "No se pudo registrar el escaneo.", unexpectedAsset: "Activo inesperado", presentAsset: "Activo presente", submitFailed: "No se pudo enviar la auditoría.", submitted: "Auditoría enviada", missingAnd: "faltantes y", unexpectedReview: "inesperados quedaron para revisión.", reviewFailed: "No se pudo revisar la auditoría.", approved: "Auditoría aprobada", rejected: "Auditoría rechazada", approvedResult: "Los hallazgos pueden cerrarse y registrarse en las bitácoras.", rejectedResult: "La sesión quedó cerrada como rechazada sin modificar activos.", closeFailed: "No se pudo cerrar la auditoría.", closed: "Auditoría cerrada", findingsLogged: "hallazgos se registraron. Ningún activo ni ubicación fue modificado automáticamente.", cancelFailed: "No se pudo cancelar la auditoría.", cancelled: "Auditoría cancelada", cancelledDetail: "No se modificó ningún activo." },
  de: {
    title: "Physische Anlagenprüfung", description: "Serialisierte Prüfung je Standort: vorhanden, fehlend, unerwartet und Zustandsbefunde – ohne automatische Korrekturen.", refresh: "Aktualisieren", inventory: "Inventar", loadError: "Der Arbeitsbereich für Anlagenprüfungen konnte nicht geladen werden.", linesError: "Die Prüfnachweise konnten nicht geladen werden.", restricted: "Das Erstellen und Erfassen von Prüfungen erfordert inventory.process und Inventar-Scope.", open: "Offene Prüfungen", expected: "Erwartet", present: "Vorhanden", locationFindings: "Standortbefunde", conditionFindings: "Zustandsbefunde", newAudit: "Neue Prüfung", newDescription: "Der Snapshot schließt ausgemusterte Anlagen, Anlagen in Instandhaltung und Anlagen unter aktiver Verwahrung aus.", selectLocation: "Standort mit prüfbaren Anlagen", warehouse: "Lager", noLocation: "Kein Standort", context: "Ziel, Schicht oder Kontext", start: "Prüfung starten", sessions: "Sitzungen", noSessions: "Keine Prüfungen erfasst.", selectOrStart: "Prüfung auswählen oder starten.", location: "Standort", blind: "Blinde Prüfung", blindDetail: "Ausstehende Snapshot-Anlagen bleiben verborgen. Erfasse nur, was physisch gefunden wird; beim Einreichen werden nicht gescannte erwartete Anlagen als Fehlend markiert.", assetCode: "Exakter Anlagen-Code", good: "Guter Zustand", observations: "Mit Beobachtungen", damaged: "Beschädigt", observationOptional: "Optionale Beobachtung", register: "Erfassen", expectedSnapshot: "Erwarteter Snapshot", presentScans: "Vorhandene Scans", missing: "Fehlend", unexpected: "Unerwartet", submitHint: "Beim Einreichen wird jede erwartete, nicht gescannte Anlage formal als fehlend markiert.", submit: "Zur Prüfung einreichen", cancelReason: "Stornierungsgrund", cancel: "Stornieren", independentReview: "Unabhängige Prüfung", independentDetail: "Genehmigung ändert keine Standorte. Sie ermöglicht nur den formalen Abschluss der Befunde.", reviewNote: "Prüfnotiz", reject: "Ablehnen", approve: "Genehmigen", approvedTitle: "Prüfung genehmigt", approvedDetail: "Der Abschluss protokolliert fehlende, unerwartete und beschädigte Anlagen, ohne Stammdaten zu ändern.", close: "Schließen und Befunde protokollieren", evidence: "Prüfnachweise", evidenceBlind: "Nur bereits gescannte Anlagen werden angezeigt; der ausstehende Snapshot bleibt verborgen.", evidenceFull: "Vollständiger Snapshot und Endergebnis jeder Anlage.", loadingEvidence: "Nachweise werden geladen…", noScans: "Noch keine Anlagen gescannt.", asset: "Anlage", result: "Ergebnis", condition: "Zustand", observation: "Beobachtung", scanned: "Gescannt", startFailed: "Prüfung konnte nicht gestartet werden.", started: "Prüfung gestartet", session: "Sitzung", snapshotOf: "hat einen Snapshot von", expectedAssets: "erwarteten Anlagen erstellt.", assetNotFound: "Anlage nicht gefunden", assetNotFoundDetail: "Gib einen exakten, in deinem Scope sichtbaren Anlagen-Code ein.", scanFailed: "Scan konnte nicht erfasst werden.", unexpectedAsset: "Unerwartete Anlage", presentAsset: "Anlage vorhanden", submitFailed: "Prüfung konnte nicht eingereicht werden.", submitted: "Prüfung eingereicht", missingAnd: "fehlende und", unexpectedReview: "unerwartete Anlagen müssen geprüft werden.", reviewFailed: "Prüfung konnte nicht geprüft werden.", approved: "Prüfung genehmigt", rejected: "Prüfung abgelehnt", approvedResult: "Die Befunde können jetzt geschlossen und in den Prüfprotokollen erfasst werden.", rejectedResult: "Die Sitzung wurde als abgelehnt geschlossen, ohne Anlagen zu verändern.", closeFailed: "Prüfung konnte nicht geschlossen werden.", closed: "Prüfung geschlossen", findingsLogged: "Befunde wurden protokolliert. Keine Anlage und kein Standort wurde automatisch geändert.", cancelFailed: "Prüfung konnte nicht storniert werden.", cancelled: "Prüfung storniert", cancelledDetail: "Keine Anlage wurde geändert." },
} as const
const STATUS_LABELS = {
  en: { in_progress: "In field", submitted: "In review", approved: "Approved", rejected: "Rejected", closed: "Closed", cancelled: "Cancelled" },
  es: { in_progress: "En terreno", submitted: "En revisión", approved: "Aprobada", rejected: "Rechazada", closed: "Cerrada", cancelled: "Cancelada" },
  de: { in_progress: "Vor Ort", submitted: "In Prüfung", approved: "Genehmigt", rejected: "Abgelehnt", closed: "Geschlossen", cancelled: "Storniert" },
} as const
const STATUS_CLASS: Record<AuditStatus, string> = { in_progress: "border-sky-300 text-sky-700", submitted: "border-amber-300 text-amber-700", approved: "border-violet-300 text-violet-700", rejected: "border-red-300 text-red-700", closed: "border-emerald-300 text-emerald-700", cancelled: "text-muted-foreground" }
const SCAN_LABELS = {
  en: { pending: "Pending", present: "Present", missing: "Missing", unexpected: "Unexpected" },
  es: { pending: "Pendiente", present: "Presente", missing: "Faltante", unexpected: "Inesperado" },
  de: { pending: "Ausstehend", present: "Vorhanden", missing: "Fehlend", unexpected: "Unerwartet" },
} as const

function firstRelation<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null }

export default function InventoryAssetAuditsPage() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const locale = LOCALES[language]
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }), [locale])
  const localize = (href: string) => `/${language}${href}`
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
    setLoading(true); setError(null)
    const [sessionsResult, locationsResult, assetsResult, custodiesResult] = await Promise.all([
      supabase.from("inventory_asset_audit_sessions").select("id,audit_code,warehouse_location_id,status,notes,review_notes,created_at,submitted_at,reviewed_at,closed_at,warehouse_location:warehouse_locations(id,code,name,warehouse_id,warehouses(id,code,name,location_id))").order("created_at", { ascending: false }).limit(100),
      supabase.from("warehouse_locations").select("id,code,name,warehouse_id,warehouses(id,code,name,location_id)").eq("is_active", true).order("name"),
      supabase.from("assets").select("id,asset_code,name,status,warehouse_location_id,assigned_to").neq("status", "deprecated").order("asset_code"),
      supabase.from("inventory_asset_custodies").select("asset_id,status").eq("status", "active"),
    ])
    const firstError = sessionsResult.error || locationsResult.error || assetsResult.error || custodiesResult.error
    if (firstError) {
      console.error("[inventory-audits] workspace load failed", firstError)
      setError(copy.loadError); setLoading(false); return
    }
    const normalizedLocations = ((locationsResult.data ?? []) as LocationRelation[]).map((row) => ({ id: row.id, code: row.code, name: row.name, warehouse_id: row.warehouse_id, warehouse: firstRelation(row.warehouses) }))
    const locationMap = new Map(normalizedLocations.map((location) => [location.id, location]))
    const normalizedSessions = ((sessionsResult.data ?? []) as unknown as RawSession[]).map((row) => { const relation = firstRelation(row.warehouse_location); return { ...row, location: locationMap.get(row.warehouse_location_id) ?? (relation ? { id: relation.id, code: relation.code, name: relation.name, warehouse_id: relation.warehouse_id, warehouse: firstRelation(relation.warehouses) } : null) } })
    setLocations(normalizedLocations); setAssets((assetsResult.data ?? []) as AssetOption[]); setActiveCustodyIds(new Set(((custodiesResult.data ?? []) as CustodyRow[]).map((row) => row.asset_id))); setSessions(normalizedSessions); setSelectedSessionId((current) => current && normalizedSessions.some((session) => session.id === current) ? current : normalizedSessions[0]?.id ?? ""); setLoading(false)
  }, [copy.loadError, supabase])

  const loadLines = useCallback(async (sessionId: string) => {
    if (!sessionId) { setLines([]); return }
    setLoadingLines(true)
    const { data, error: lineError } = await supabase.from("inventory_asset_audit_lines").select("id,session_id,asset_id,asset_code_snapshot,asset_name_snapshot,is_expected,expected_location_id,observed_location_id,scan_status,condition,notes,scanned_at").eq("session_id", sessionId).order("created_at")
    if (lineError) { console.error("[inventory-audits] evidence load failed", lineError); setError(copy.linesError); setLines([]) } else setLines((data ?? []) as AuditLine[])
    setLoadingLines(false)
  }, [copy.linesError, supabase])

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
    setSaving(true); const { data, error: rpcError } = await supabase.rpc("create_inventory_asset_audit_session", { p_warehouse_location_id: newLocationId, p_notes: newNotes.trim() || null }); setSaving(false)
    if (rpcError) { console.error("[inventory-audits] create failed", rpcError); return toast({ title: copy.startFailed, variant: "destructive" }) }
    toast({ title: copy.started, description: `${data?.audit_code ?? copy.session} ${copy.snapshotOf} ${number.format(Number(data?.expected_assets ?? 0))} ${copy.expectedAssets}` }); setNewLocationId(""); setNewNotes(""); await loadWorkspace(); if (data?.session_id) setSelectedSessionId(String(data.session_id))
  }

  async function recordScan() {
    if (!selected || selected.status !== "in_progress" || !canOperate || saving) return
    const normalized = assetCode.trim().toLowerCase(); const asset = assets.find((item) => item.asset_code.trim().toLowerCase() === normalized)
    if (!asset) return toast({ title: copy.assetNotFound, description: copy.assetNotFoundDetail, variant: "destructive" })
    setSaving(true); const { data, error: rpcError } = await supabase.rpc("record_inventory_asset_audit_scan", { p_session_id: selected.id, p_asset_id: asset.id, p_condition: condition, p_notes: scanNotes.trim() || null }); setSaving(false)
    if (rpcError) { console.error("[inventory-audits] scan failed", rpcError); return toast({ title: copy.scanFailed, variant: "destructive" }) }
    toast({ title: data?.scan_status === "unexpected" ? copy.unexpectedAsset : copy.presentAsset, description: `${asset.asset_code} · ${asset.name}` }); setAssetCode(""); setCondition("good"); setScanNotes(""); await loadLines(selected.id)
  }

  async function submitSession() {
    if (!selected || selected.status !== "in_progress" || saving) return
    setSaving(true); const { data, error: rpcError } = await supabase.rpc("submit_inventory_asset_audit_session", { p_session_id: selected.id }); setSaving(false)
    if (rpcError) { console.error("[inventory-audits] submit failed", rpcError); return toast({ title: copy.submitFailed, variant: "destructive" }) }
    toast({ title: copy.submitted, description: `${number.format(Number(data?.missing_assets ?? 0))} ${copy.missingAnd} ${number.format(Number(data?.unexpected_assets ?? 0))} ${copy.unexpectedReview}` }); await loadWorkspace(); await loadLines(selected.id)
  }

  async function reviewSession(approved: boolean) {
    if (!selected || selected.status !== "submitted" || !canApprove || saving) return
    setSaving(true); const { error: rpcError } = await supabase.rpc("review_inventory_asset_audit_session", { p_session_id: selected.id, p_approved: approved, p_notes: reviewNotes.trim() || null }); setSaving(false)
    if (rpcError) { console.error("[inventory-audits] review failed", rpcError); return toast({ title: copy.reviewFailed, variant: "destructive" }) }
    toast({ title: approved ? copy.approved : copy.rejected, description: approved ? copy.approvedResult : copy.rejectedResult }); setReviewNotes(""); await loadWorkspace()
  }

  async function closeSession() {
    if (!selected || selected.status !== "approved" || !canApprove || saving) return
    setSaving(true); const { data, error: rpcError } = await supabase.rpc("close_inventory_asset_audit_session", { p_session_id: selected.id }); setSaving(false)
    if (rpcError) { console.error("[inventory-audits] close failed", rpcError); return toast({ title: copy.closeFailed, variant: "destructive" }) }
    toast({ title: copy.closed, description: `${number.format(Number(data?.findings_logged ?? 0))} ${copy.findingsLogged}` }); await loadWorkspace()
  }

  async function cancelSession() {
    if (!selected || !cancelReason.trim() || saving) return
    setSaving(true); const { error: rpcError } = await supabase.rpc("cancel_inventory_asset_audit_session", { p_session_id: selected.id, p_reason: cancelReason.trim() }); setSaving(false)
    if (rpcError) { console.error("[inventory-audits] cancel failed", rpcError); return toast({ title: copy.cancelFailed, variant: "destructive" }) }
    toast({ title: copy.cancelled, description: copy.cancelledDetail }); setCancelReason(""); await loadWorkspace()
  }

  return <AppLayout>
    <PageHeader title={copy.title} description={copy.description} actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void loadWorkspace()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{copy.refresh}</Button><Button variant="outline" asChild><Link href={localize("/inventory")}><ArrowLeft className="mr-2 h-4 w-4" />{copy.inventory}</Link></Button></div>} />
    <div className="space-y-6 p-4 sm:p-8">
      {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      {!accessLoading && !canOperate && <Card className="border-amber-300"><CardContent className="p-4 text-sm text-amber-800">{copy.restricted}</CardContent></Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric title={copy.open} value={sessions.filter((session) => ["in_progress", "submitted", "approved"].includes(session.status)).length} locale={locale} /><Metric title={copy.expected} value={expectedCount} locale={locale} /><Metric title={copy.present} value={presentCount} locale={locale} /><Metric title={copy.locationFindings} value={missingCount + unexpectedCount} alert={missingCount + unexpectedCount > 0} locale={locale} /><Metric title={copy.conditionFindings} value={conditionFindings} alert={conditionFindings > 0} locale={locale} /></div>
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Warehouse className="h-4 w-4" />{copy.newAudit}</CardTitle><CardDescription>{copy.newDescription}</CardDescription></CardHeader><CardContent className="space-y-3"><select value={newLocationId} onChange={(event) => setNewLocationId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="">{copy.selectLocation}</option>{eligibleLocations.map((location) => <option key={location.id} value={location.id}>{location.warehouse?.name ?? copy.warehouse} · {location.name}</option>)}</select><Input value={newNotes} onChange={(event) => setNewNotes(event.target.value)} placeholder={copy.context} /><Button className="w-full" onClick={() => void createSession()} disabled={!newLocationId || saving || !canOperate}><ClipboardCheck className="mr-2 h-4 w-4" />{copy.start}</Button></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">{copy.sessions}</CardTitle></CardHeader><CardContent className="space-y-2">{sessions.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noSessions}</p> : sessions.map((session) => <button type="button" key={session.id} onClick={() => setSelectedSessionId(session.id)} className={`w-full rounded-lg border p-3 text-left ${selectedSessionId === session.id ? "border-primary bg-primary/5" : ""}`}><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{session.audit_code}</p><p className="text-xs text-muted-foreground">{session.location ? `${session.location.warehouse?.name ?? copy.warehouse} · ${session.location.name}` : copy.noLocation}</p></div><StatusBadge status={session.status} label={STATUS_LABELS[language][session.status]} /></div><p className="mt-2 text-xs text-muted-foreground">{dateTime.format(new Date(session.created_at))}</p></button>)}</CardContent></Card>
        </div>
        <div className="space-y-4">{!selected ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">{copy.selectOrStart}</CardContent></Card> : <>
          <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{selected.audit_code}</CardTitle><CardDescription>{selected.location ? `${selected.location.warehouse?.name ?? copy.warehouse} · ${selected.location.name}` : copy.location}</CardDescription></div><StatusBadge status={selected.status} label={STATUS_LABELS[language][selected.status]} /></div></CardHeader><CardContent className="space-y-4">
            {selected.status === "in_progress" && <div className="rounded-lg border bg-muted/20 p-4"><div className="mb-3 flex items-center gap-2"><EyeOff className="h-4 w-4" /><p className="font-medium">{copy.blind}</p></div><p className="mb-4 text-sm text-muted-foreground">{copy.blindDetail}</p><div className="grid gap-3 md:grid-cols-4"><Input value={assetCode} onChange={(event) => setAssetCode(event.target.value)} placeholder={copy.assetCode} /><select value={condition} onChange={(event) => setCondition(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="good">{copy.good}</option><option value="observations">{copy.observations}</option><option value="damaged">{copy.damaged}</option></select><Input value={scanNotes} onChange={(event) => setScanNotes(event.target.value)} placeholder={copy.observationOptional} /><Button onClick={() => void recordScan()} disabled={!assetCode.trim() || saving}><ScanLine className="mr-2 h-4 w-4" />{copy.register}</Button></div></div>}
            <div className="grid gap-3 sm:grid-cols-4"><MiniMetric label={copy.expectedSnapshot} value={expectedCount} locale={locale} /><MiniMetric label={copy.presentScans} value={presentCount} locale={locale} /><MiniMetric label={copy.missing} value={missingCount} alert={missingCount > 0} locale={locale} /><MiniMetric label={copy.unexpected} value={unexpectedCount} alert={unexpectedCount > 0} locale={locale} /></div>
            {selected.status === "in_progress" && <div className="flex flex-wrap items-end gap-3"><div className="min-w-[260px] flex-1"><p className="mb-1 text-xs text-muted-foreground">{copy.submitHint}</p></div><Button onClick={() => void submitSession()} disabled={saving || loadingLines}><ShieldCheck className="mr-2 h-4 w-4" />{copy.submit}</Button><Input className="max-w-xs" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder={copy.cancelReason} /><Button variant="outline" onClick={() => void cancelSession()} disabled={!cancelReason.trim() || saving}><XCircle className="mr-2 h-4 w-4" />{copy.cancel}</Button></div>}
            {selected.status === "submitted" && canApprove && <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4"><p className="font-medium">{copy.independentReview}</p><p className="mt-1 text-sm text-muted-foreground">{copy.independentDetail}</p><div className="mt-3 flex flex-wrap gap-2"><Input className="min-w-[280px] flex-1" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder={copy.reviewNote} /><Button variant="outline" onClick={() => void reviewSession(false)} disabled={saving}><XCircle className="mr-2 h-4 w-4" />{copy.reject}</Button><Button onClick={() => void reviewSession(true)} disabled={saving}><CheckCircle2 className="mr-2 h-4 w-4" />{copy.approve}</Button></div></div>}
            {selected.status === "approved" && canApprove && <div className="rounded-lg border border-violet-300 bg-violet-50/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{copy.approvedTitle}</p><p className="text-sm text-muted-foreground">{copy.approvedDetail}</p></div><Button onClick={() => void closeSession()} disabled={saving}><CheckCircle2 className="mr-2 h-4 w-4" />{copy.close}</Button></div></div>}
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">{copy.evidence}</CardTitle><CardDescription>{selected.status === "in_progress" ? copy.evidenceBlind : copy.evidenceFull}</CardDescription></CardHeader><CardContent>{loadingLines ? <p className="py-8 text-center text-sm text-muted-foreground">{copy.loadingEvidence}</p> : visibleLines.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{copy.noScans}</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>{copy.asset}</TableHead><TableHead>{copy.result}</TableHead><TableHead>{copy.condition}</TableHead><TableHead>{copy.observation}</TableHead><TableHead>{copy.scanned}</TableHead></TableRow></TableHeader><TableBody>{visibleLines.map((line) => <TableRow key={line.id}><TableCell><p className="font-medium">{line.asset_code_snapshot}</p><p className="text-xs text-muted-foreground">{line.asset_name_snapshot}</p></TableCell><TableCell><Badge variant={line.scan_status === "missing" || line.scan_status === "unexpected" ? "destructive" : "outline"}>{SCAN_LABELS[language][line.scan_status]}</Badge></TableCell><TableCell>{line.condition === "damaged" ? <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{copy.damaged}</span> : line.condition === "observations" ? copy.observations : line.condition === "good" ? copy.good : "—"}</TableCell><TableCell className="max-w-xs text-sm text-muted-foreground">{line.notes || "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{line.scanned_at ? dateTime.format(new Date(line.scanned_at)) : "—"}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
        </>}</div>
      </div>
    </div>
  </AppLayout>
}

function StatusBadge({ status, label }: { status: AuditStatus; label: string }) { return <Badge variant="outline" className={STATUS_CLASS[status]}>{label}</Badge> }
function Metric({ title, value, alert=false, locale }: { title:string; value:number; alert?:boolean; locale:string }) { return <Card className={alert?"border-amber-300":undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold tabular-nums">{new Intl.NumberFormat(locale).format(value)}</p></CardContent></Card> }
function MiniMetric({ label, value, alert=false, locale }: { label:string; value:number; alert?:boolean; locale:string }) { return <div className={`rounded-lg border p-3 ${alert?"border-amber-300 bg-amber-50/50":""}`}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{new Intl.NumberFormat(locale).format(value)}</p></div> }
