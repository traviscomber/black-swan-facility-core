"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, FileText, Plus, RefreshCw, ShieldCheck, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useToast } from "@/hooks/use-toast"

type MaintenanceTask = { id: string; title: string; description: string | null; frequency: string | null; next_run: string | null; last_completed: string | null; status: string | null; prioridad: string | null }
type AssetDocument = { id: string; document_name: string; document_type: string; document_url: string; issued_at: string | null; expires_at: string | null; notes: string | null }
type RetirementRequest = { id: string; reason: string; status: string; requested_at: string; review_notes: string | null }

const RETIREMENT_STATUS: Record<string, string> = {
  pending: "Pendiente de aprobación",
  approved: "Aprobada",
  rejected: "Rechazada",
  executed: "Ejecutada",
  cancelled: "Cancelada",
}

export function AssetLifecycleConsole({ assetId, assetName, assetStatus }: { assetId: string; assetName: string; assetStatus?: string | null }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { access, can, canAccessDepartment, loading: accessLoading } = useEffectiveAccess()
  const canOperate = can("inventory.process") && canAccessDepartment("inventory")
  const canApprove = canOperate && (access.is_admin || access.role === "approver")

  const [tasks, setTasks] = useState<MaintenanceTask[]>([])
  const [documents, setDocuments] = useState<AssetDocument[]>([])
  const [retirements, setRetirements] = useState<RetirementRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [savingRetirement, setSavingRetirement] = useState(false)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDate, setTaskDate] = useState("")
  const [documentName, setDocumentName] = useState("")
  const [documentUrl, setDocumentUrl] = useState("")
  const [documentType, setDocumentType] = useState("manual")
  const [documentExpiry, setDocumentExpiry] = useState("")
  const [retirementReason, setRetirementReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const [taskResult, documentResult, retirementResult] = await Promise.all([
      supabase.from("maintenance_tasks").select("id,title,description,frequency,next_run,last_completed,status,prioridad").eq("asset_id", assetId).order("next_run", { ascending: true }),
      supabase.from("asset_documents").select("id,document_name,document_type,document_url,issued_at,expires_at,notes").eq("asset_id", assetId).order("created_at", { ascending: false }),
      supabase.from("asset_retirement_requests").select("id,reason,status,requested_at,review_notes").eq("asset_id", assetId).order("requested_at", { ascending: false }),
    ])
    if (!taskResult.error) setTasks((taskResult.data ?? []) as MaintenanceTask[])
    if (!documentResult.error) setDocuments((documentResult.data ?? []) as AssetDocument[])
    if (!retirementResult.error) setRetirements((retirementResult.data ?? []) as RetirementRequest[])
    setLoading(false)
  }, [assetId, supabase])

  useEffect(() => { void load() }, [load])

  async function addTask() {
    if (!taskTitle.trim()) return
    const { error } = await supabase.from("maintenance_tasks").insert({ asset_id: assetId, title: taskTitle.trim(), next_run: taskDate || null, status: "pending", prioridad: "normal", tipo_trabajo: "asset_maintenance" })
    if (error) return toast({ title: "No se pudo crear", description: error.message, variant: "destructive" })
    await supabase.from("asset_logs").insert({ asset_id: assetId, log_type: "maintenance_created", description: `Mantenimiento creado: ${taskTitle.trim()}` })
    setTaskTitle("")
    setTaskDate("")
    await load()
  }

  async function completeTask(task: MaintenanceTask) {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from("maintenance_tasks").update({ status: "completed", last_completed: today, fecha_completado: new Date().toISOString() }).eq("id", task.id)
    if (error) return toast({ title: "No se pudo completar", description: error.message, variant: "destructive" })
    await supabase.from("asset_logs").insert({ asset_id: assetId, log_type: "maintenance_completed", description: `Mantenimiento completado: ${task.title}` })
    await load()
  }

  async function addDocument() {
    if (!documentName.trim() || !documentUrl.trim()) return
    const { error } = await supabase.from("asset_documents").insert({ asset_id: assetId, document_name: documentName.trim(), document_type: documentType, document_url: documentUrl.trim(), expires_at: documentExpiry || null })
    if (error) return toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" })
    setDocumentName("")
    setDocumentUrl("")
    setDocumentExpiry("")
    await load()
  }

  async function requestRetirement() {
    if (!retirementReason.trim() || !canOperate || savingRetirement) return
    setSavingRetirement(true)
    const { error } = await supabase.rpc("request_inventory_asset_retirement", {
      p_asset_id: assetId,
      p_reason: retirementReason.trim(),
    })
    setSavingRetirement(false)
    if (error) return toast({ title: "No se pudo solicitar", description: error.message, variant: "destructive" })
    toast({ title: "Solicitud de baja creada", description: `${assetName} mantiene su estado actual hasta que la baja sea aprobada y ejecutada.` })
    setRetirementReason("")
    await load()
  }

  async function reviewRetirement(request: RetirementRequest, approved: boolean) {
    if (!canApprove || savingRetirement) return
    setSavingRetirement(true)
    const { error } = await supabase.rpc("review_inventory_asset_retirement", {
      p_request_id: request.id,
      p_approved: approved,
      p_notes: approved ? "Aprobada desde ficha de activo" : "Rechazada desde ficha de activo",
    })
    setSavingRetirement(false)
    if (error) return toast({ title: "No se pudo revisar", description: error.message, variant: "destructive" })
    toast({ title: approved ? "Baja aprobada" : "Baja rechazada", description: approved ? "La solicitud está lista para ejecución controlada." : "El activo permanece operativo." })
    await load()
  }

  async function executeRetirement(request: RetirementRequest) {
    if (!canApprove || savingRetirement) return
    setSavingRetirement(true)
    const { error } = await supabase.rpc("execute_inventory_asset_retirement", { p_request_id: request.id })
    setSavingRetirement(false)
    if (error) return toast({ title: "No se pudo ejecutar", description: error.message, variant: "destructive" })
    toast({ title: "Baja ejecutada", description: `${assetName} quedó retirado con movimiento y bitácora registrados en la misma transacción.` })
    await load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const hasOpenRetirement = retirements.some((request) => request.status === "pending" || request.status === "approved")

  if (loading) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Cargando ciclo de vida…</CardContent></Card>

  return <div className="space-y-4">
    <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" />Mantenimiento del activo</CardTitle><CardDescription>Planificación y cierre con registro en bitácora.</CardDescription></div><Button variant="ghost" size="icon" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]"><Input placeholder="Trabajo de mantenimiento" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} /><Input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} /><Button onClick={() => void addTask()}><Plus className="mr-2 h-4 w-4" />Crear</Button></div>{tasks.length === 0 ? <p className="text-sm text-muted-foreground">Sin mantenimientos asociados.</p> : tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{task.title}</p><p className={`text-xs ${task.next_run && task.next_run < today && task.status !== "completed" ? "text-destructive" : "text-muted-foreground"}`}>{task.next_run ? `Fecha objetivo: ${new Date(`${task.next_run}T12:00:00`).toLocaleDateString("es-CL")}` : "Sin fecha objetivo"} · {task.status ?? "pending"}</p></div>{task.status !== "completed" && <Button size="sm" variant="outline" onClick={() => void completeTask(task)}><CheckCircle2 className="mr-2 h-4 w-4" />Completar</Button>}</div>)}</CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Documentos y garantías</CardTitle><CardDescription>Manuales, facturas, certificados, garantías y vencimientos.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 md:grid-cols-2"><Input placeholder="Nombre del documento" value={documentName} onChange={(e) => setDocumentName(e.target.value)} /><Input placeholder="URL del archivo" value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} /><select className="rounded-md border bg-background px-3 py-2 text-sm" value={documentType} onChange={(e) => setDocumentType(e.target.value)}><option value="manual">Manual</option><option value="warranty">Garantía</option><option value="invoice">Factura</option><option value="certificate">Certificado</option><option value="other">Otro</option></select><Input type="date" value={documentExpiry} onChange={(e) => setDocumentExpiry(e.target.value)} /></div><Button size="sm" onClick={() => void addDocument()}>Guardar documento</Button>{documents.length === 0 ? <p className="text-sm text-muted-foreground">Sin documentos asociados.</p> : documents.map((doc) => <a key={doc.id} href={doc.document_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40"><div><p className="font-medium">{doc.document_name}</p><p className="text-xs text-muted-foreground">{doc.document_type}{doc.expires_at ? ` · vence ${new Date(`${doc.expires_at}T12:00:00`).toLocaleDateString("es-CL")}` : ""}</p></div>{doc.expires_at && doc.expires_at < today && <AlertTriangle className="h-4 w-4 text-destructive" />}</a>)}</CardContent></Card>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Baja con aprobación</CardTitle><CardDescription>Solicitud, aprobación y ejecución son pasos separados. La ejecución actualiza activo, movimiento y bitácora de forma atómica.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {!accessLoading && !canOperate && <div className="rounded-md border border-amber-300 bg-amber-50/40 p-3 text-xs text-amber-800">No tienes permiso de proceso de inventario para esta operación.</div>}
        {assetStatus !== "deprecated" && !hasOpenRetirement && <div className="flex flex-col gap-2 sm:flex-row"><Input placeholder="Motivo obligatorio de baja" value={retirementReason} onChange={(e) => setRetirementReason(e.target.value)} /><Button variant="outline" disabled={!canOperate || savingRetirement || !retirementReason.trim()} onClick={() => void requestRetirement()}>{savingRetirement ? "Registrando…" : "Solicitar baja"}</Button></div>}
        {hasOpenRetirement && <div className="rounded-md border border-amber-300 bg-amber-50/40 p-3 text-xs text-amber-800">Este activo ya tiene una solicitud de baja abierta. No se crearán solicitudes duplicadas.</div>}
        {retirements.length === 0 ? <p className="text-sm text-muted-foreground">Sin solicitudes de baja.</p> : retirements.map((request) => <div key={request.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{RETIREMENT_STATUS[request.status] ?? request.status}</p><span className="text-xs text-muted-foreground">{new Date(request.requested_at).toLocaleString("es-CL")}</span></div><p className="mt-1 text-sm text-muted-foreground">{request.reason}</p>{request.review_notes && <p className="mt-1 text-xs text-muted-foreground">Revisión: {request.review_notes}</p>}{canApprove && request.status === "pending" && <div className="mt-3 flex gap-2"><Button size="sm" disabled={savingRetirement} onClick={() => void reviewRetirement(request, true)}>Aprobar</Button><Button size="sm" variant="outline" disabled={savingRetirement} onClick={() => void reviewRetirement(request, false)}>Rechazar</Button></div>}{canApprove && request.status === "approved" && <Button className="mt-3" size="sm" variant="destructive" disabled={savingRetirement} onClick={() => void executeRetirement(request)}>Ejecutar baja</Button>}</div>)}
      </CardContent>
    </Card>
  </div>
}
