"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Ban, CheckCircle2, CirclePlay, ExternalLink, PauseCircle, RefreshCw, RotateCcw, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { createBrowserClient } from "@/lib/supabase/client"

type MaintenanceState = "scheduled" | "assigned" | "in_progress" | "blocked" | "completed" | "cancelled" | string
type MaintenanceAction = "start" | "block" | "resume" | "complete" | "cancel"

type AssetRelation = { id: string; asset_code: string; name: string; status: string | null }
type EmployeeRelation = { id: string; name: string }
type RawTask = {
  id: string
  title: string
  description: string | null
  status: string | null
  estado_extendido: string | null
  prioridad: string | null
  fecha_objetivo: string | null
  duracion_estimada_minutos: number | null
  duracion_real_minutos: number | null
  evidencia_url: string | null
  bloqueado: boolean | null
  asset_id: string
  assigned_to: string | null
  assets: AssetRelation | AssetRelation[] | null
  employees: EmployeeRelation | EmployeeRelation[] | null
}

type Task = Omit<RawTask, "assets" | "employees"> & {
  asset: AssetRelation | null
  employee: EmployeeRelation | null
  state: MaintenanceState
}

const STATE_LABELS: Record<string, string> = {
  scheduled: "Programada",
  assigned: "Asignada",
  in_progress: "En ejecución",
  blocked: "Bloqueada",
  completed: "Completada",
  cancelled: "Cancelada",
}

const ACTION_COPY: Record<MaintenanceAction, { label: string; description: string }> = {
  start: { label: "Iniciar trabajo", description: "El activo pasará a estado En mantenimiento." },
  block: { label: "Bloquear trabajo", description: "Registra el impedimento y mantiene el activo En mantenimiento." },
  resume: { label: "Reanudar trabajo", description: "Devuelve la orden a ejecución." },
  complete: { label: "Completar trabajo", description: "Cierra la orden y libera el activo si no existen otros trabajos activos." },
  cancel: { label: "Cancelar trabajo", description: "Cierra la orden sin completarla y deja la razón en la bitácora." },
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function stateOf(task: RawTask) {
  return task.estado_extendido ?? task.status ?? "scheduled"
}

function allowedActions(state: MaintenanceState): MaintenanceAction[] {
  if (state === "scheduled" || state === "assigned") return ["start", "cancel"]
  if (state === "in_progress") return ["block", "complete", "cancel"]
  if (state === "blocked") return ["resume", "complete", "cancel"]
  return []
}

export function InventoryAssetMaintenancePanel() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const { loading: accessLoading, can, canAccessDepartment } = useEffectiveAccess()
  const canOperate = can("inventory.process") && can("maintenance.operate") && canAccessDepartment("inventory") && canAccessDepartment("maintenance")
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingTask, setPendingTask] = useState<Task | null>(null)
  const [pendingAction, setPendingAction] = useState<MaintenanceAction | null>(null)
  const [notes, setNotes] = useState("")
  const [evidenceUrl, setEvidenceUrl] = useState("")
  const [actualMinutes, setActualMinutes] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (accessLoading) return
    if (!canOperate) {
      setTasks([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("maintenance_tasks")
      .select("id,title,description,status,estado_extendido,prioridad,fecha_objetivo,duracion_estimada_minutos,duracion_real_minutos,evidencia_url,bloqueado,asset_id,assigned_to,assets(id,asset_code,name,status),employees(id,name)")
      .not("asset_id", "is", null)
      .order("fecha_objetivo", { ascending: true, nullsFirst: false })
      .limit(40)

    if (loadError) {
      setError(loadError.message)
      setTasks([])
    } else {
      setTasks(((data ?? []) as unknown as RawTask[]).map((task) => ({
        ...task,
        asset: firstRelation(task.assets),
        employee: firstRelation(task.employees),
        state: stateOf(task),
      })))
    }
    setLoading(false)
  }, [accessLoading, canOperate, supabase])

  useEffect(() => { void load() }, [load])

  const openTasks = tasks.filter((task) => !["completed", "cancelled"].includes(task.state))
  const blocked = openTasks.filter((task) => task.state === "blocked").length
  const overdue = openTasks.filter((task) => task.fecha_objetivo && new Date(`${task.fecha_objetivo}T23:59:59`).getTime() < Date.now()).length
  const recentClosed = tasks.filter((task) => ["completed", "cancelled"].includes(task.state)).slice(-6).reverse()

  function openAction(task: Task, action: MaintenanceAction) {
    setPendingTask(task)
    setPendingAction(action)
    setNotes("")
    setEvidenceUrl(task.evidencia_url ?? "")
    setActualMinutes(task.duracion_real_minutos == null ? "" : String(task.duracion_real_minutos))
  }

  function closeAction() {
    if (saving) return
    setPendingTask(null)
    setPendingAction(null)
    setNotes("")
    setEvidenceUrl("")
    setActualMinutes("")
  }

  async function executeTransition() {
    if (!pendingTask || !pendingAction || !notes.trim() || saving) return
    const parsedMinutes = actualMinutes.trim() ? Number.parseInt(actualMinutes, 10) : null
    if (pendingAction === "complete" && parsedMinutes !== null && (!Number.isFinite(parsedMinutes) || parsedMinutes < 0)) {
      setError("La duración real debe ser cero o mayor.")
      return
    }

    setSaving(true)
    const { error: transitionError } = await supabase.rpc("transition_inventory_asset_maintenance_task", {
      p_task_id: pendingTask.id,
      p_action: pendingAction,
      p_notes: notes.trim(),
      p_evidence_url: pendingAction === "complete" ? evidenceUrl.trim() || null : null,
      p_actual_minutes: pendingAction === "complete" ? parsedMinutes : null,
    })
    setSaving(false)

    if (transitionError) {
      setError(transitionError.message)
      return
    }

    toast({ title: "Mantenimiento actualizado", description: `${pendingTask.asset?.asset_code ?? "Activo"} · ${ACTION_COPY[pendingAction].label}` })
    closeAction()
    await load()
  }

  if (accessLoading || !canOperate) return null

  return (
    <div className="px-4 pt-4 md:px-6 md:pt-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" /> Mantenimiento de activos</CardTitle>
              <CardDescription>Órdenes ligadas a inventario con transición controlada, scope físico y sincronización automática del estado del activo.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={blocked > 0 ? "destructive" : "outline"}>{blocked} bloqueadas</Badge>
              <Badge variant={overdue > 0 ? "destructive" : "outline"}>{overdue} vencidas</Badge>
              <Button variant="outline" size="sm" asChild><Link href="/maintenance"><ExternalLink className="mr-2 h-4 w-4" />Mantenimiento</Link></Button>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

          {loading ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Cargando mantenimiento de activos…</div> : openTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 font-medium">Sin mantenimiento de activos abierto</p>
              <p className="mt-1 text-sm text-muted-foreground">Las nuevas órdenes asociadas a activos se crean desde Mantenimiento y aparecen aquí para ejecución.</p>
              <Button className="mt-4" variant="outline" asChild><Link href="/maintenance">Registrar orden</Link></Button>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {openTasks.map((task) => {
                const isOverdue = Boolean(task.fecha_objetivo && new Date(`${task.fecha_objetivo}T23:59:59`).getTime() < Date.now())
                return <div key={task.id} className="grid gap-3 p-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr_auto] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{task.asset?.asset_code ?? "Activo"} · {task.asset?.name ?? "Sin nombre"}</p><Badge variant={task.state === "blocked" ? "destructive" : "secondary"}>{STATE_LABELS[task.state] ?? task.state}</Badge>{isOverdue && <Badge variant="destructive">Vencida</Badge>}</div>
                    <p className="mt-1 text-sm">{task.title}</p>
                    {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
                  </div>
                  <div><p className="text-xs text-muted-foreground">Responsable</p><p className="text-sm font-medium">{task.employee?.name ?? "Sin asignar"}</p><p className="mt-1 text-xs text-muted-foreground">Prioridad {task.prioridad ?? "medium"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Fecha objetivo</p><p className="text-sm font-medium">{task.fecha_objetivo ? formatDate(task.fecha_objetivo) : "Sin fecha"}</p><p className="mt-1 text-xs text-muted-foreground">{task.duracion_estimada_minutos ?? 0} min estimados</p></div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">{allowedActions(task.state).map((action) => <Button key={action} size="sm" variant={action === "cancel" || action === "block" ? "outline" : "default"} onClick={() => openAction(task, action)}>{actionIcon(action)}{ACTION_COPY[action].label}</Button>)}</div>
                </div>
              })}
            </div>
          )}

          {recentClosed.length > 0 && <div>
            <div className="mb-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /><h3 className="text-sm font-semibold">Cierres recientes</h3></div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{recentClosed.map((task) => <div key={task.id} className="rounded-lg border p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{task.asset?.asset_code ?? "Activo"} · {task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.employee?.name ?? "Sin responsable"}</p></div><Badge variant="outline">{STATE_LABELS[task.state] ?? task.state}</Badge></div></div>)}</div>
          </div>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(pendingTask && pendingAction)} onOpenChange={(open) => { if (!open) closeAction() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction ? ACTION_COPY[pendingAction].label : "Actualizar mantenimiento"}</DialogTitle>
            <DialogDescription>{pendingAction ? ACTION_COPY[pendingAction].description : ""}</DialogDescription>
          </DialogHeader>
          {pendingTask && <div className="rounded-lg border bg-muted/20 p-3 text-sm"><p className="font-medium">{pendingTask.asset?.asset_code ?? "Activo"} · {pendingTask.asset?.name ?? "Sin nombre"}</p><p className="mt-1 text-muted-foreground">{pendingTask.title}</p></div>}
          <div className="space-y-1.5"><label className="text-sm font-medium">Nota operativa *</label><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Qué ocurrió, resultado, bloqueo o razón de la transición" /></div>
          {pendingAction === "complete" && <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><label className="text-sm font-medium">Evidencia URL</label><Input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://…" /></div><div className="space-y-1.5"><label className="text-sm font-medium">Duración real (min)</label><Input type="number" min="0" value={actualMinutes} onChange={(event) => setActualMinutes(event.target.value)} /></div></div>}
          <DialogFooter><Button variant="outline" onClick={closeAction} disabled={saving}>Cancelar</Button><Button onClick={() => void executeTransition()} disabled={saving || !notes.trim()}>{saving ? "Registrando…" : "Confirmar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function actionIcon(action: MaintenanceAction) {
  const className = "mr-1.5 h-3.5 w-3.5"
  if (action === "start") return <CirclePlay className={className} />
  if (action === "block") return <PauseCircle className={className} />
  if (action === "resume") return <RotateCcw className={className} />
  if (action === "complete") return <CheckCircle2 className={className} />
  if (action === "cancel") return <Ban className={className} />
  return <AlertTriangle className={className} />
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`))
}
