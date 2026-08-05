"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, BedDouble, CheckCircle2, ClipboardCheck, PackageSearch, Play, RefreshCw, Shirt, UserCheck } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"

type Room = { id: string; room_number: string; location: string | null; operational_status: string }
type Task = {
  id: string; task_type: string; status: string; priority: string | null; assigned_to: string | null
  scheduled_for: string | null; due_at: string | null; started_at: string | null; completed_at: string | null
  requires_inspection: boolean; inspection_status: string; quality_score: number | null; notes: string | null
  room: Room | null
}
type LostFound = { id: string; item_name: string; status: string; found_at: string; custody_location: string | null; room: Room | null }
type Linen = { id: string; code: string; name: string; clean_quantity: number; in_use_quantity: number; laundry_quantity: number; damaged_quantity: number; minimum_clean_quantity: number; unit: string }

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", assigned: "Asignada", in_progress: "En limpieza", inspection: "Inspección",
  completed: "Completada", blocked: "Bloqueada", cancelled: "Cancelada",
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin hora"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value))
}

export default function HousekeepingPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [tasks, setTasks] = useState<Task[]>([])
  const [lostFound, setLostFound] = useState<LostFound[]>([])
  const [linen, setLinen] = useState<Linen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [inspectionNotes, setInspectionNotes] = useState("")
  const [qualityScore, setQualityScore] = useState("5")
  const [lostItem, setLostItem] = useState("")
  const [lostRoomId, setLostRoomId] = useState("")
  const [lostCustody, setLostCustody] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    const [taskResult, lostResult, linenResult] = await Promise.all([
      supabase.from("housekeeping_tasks").select("id,task_type,status,priority,assigned_to,scheduled_for,due_at,started_at,completed_at,requires_inspection,inspection_status,quality_score,notes,rooms(id,room_number,location,operational_status)").order("due_at", { ascending: true }),
      supabase.from("housekeeping_lost_found").select("id,item_name,status,found_at,custody_location,rooms(id,room_number,location,operational_status)").order("found_at", { ascending: false }).limit(20),
      supabase.from("linen_items").select("id,code,name,clean_quantity,in_use_quantity,laundry_quantity,damaged_quantity,minimum_clean_quantity,unit").eq("is_active", true).order("name"),
    ])
    const firstError = taskResult.error || lostResult.error || linenResult.error
    if (firstError) setError(firstError.message)
    setTasks((taskResult.data ?? []).map((row: any) => ({ ...row, room: row.rooms })) as Task[])
    setLostFound((lostResult.data ?? []).map((row: any) => ({ ...row, room: row.rooms })) as LostFound[])
    setLinen((linenResult.data ?? []) as Linen[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadData() }, [loadData])

  const runTaskAction = async (taskId: string, action: string) => {
    setBusy(taskId + action); setError(null)
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (!userId) { setError("Sesión no disponible."); setBusy(null); return }
    const { error: rpcError } = await supabase.rpc("update_housekeeping_task_operation", {
      p_task_id: taskId,
      p_action: action,
      p_assigned_to: action === "assign" ? userId : null,
      p_notes: action === "approve" || action === "reject" ? inspectionNotes || null : null,
      p_quality_score: action === "approve" ? Number(qualityScore) : null,
    })
    if (rpcError) setError(rpcError.message)
    else { setInspectionNotes(""); await loadData() }
    setBusy(null)
  }

  const createLostFound = async () => {
    if (!lostItem.trim()) { setError("Indica el objeto encontrado."); return }
    setBusy("lost-found")
    const { data: authData } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from("housekeeping_lost_found").insert({
      item_name: lostItem.trim(), room_id: lostRoomId || null, custody_location: lostCustody || null,
      found_by: authData.user?.id ?? null, status: lostCustody ? "stored" : "found",
    })
    if (insertError) setError(insertError.message)
    else { setLostItem(""); setLostRoomId(""); setLostCustody(""); await loadData() }
    setBusy(null)
  }

  const metrics = {
    pending: tasks.filter(t => ["pending", "assigned"].includes(t.status)).length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    inspection: tasks.filter(t => t.status === "inspection").length,
    overdue: tasks.filter(t => t.due_at && new Date(t.due_at) < new Date() && !["completed", "cancelled"].includes(t.status)).length,
  }
  const rooms = Array.from(new Map(tasks.filter(t => t.room).map(t => [t.room!.id, t.room!])).values())

  return (
    <AppLayout>
      <PageHeader title="Housekeeping · Fundo Corcovado" description="Limpieza, inspección, objetos encontrados y control de lencería conectados a reservas y habitaciones." actions={<Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>} />
      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Pendientes y asignadas" value={metrics.pending} icon={<BedDouble className="h-4 w-4" />} />
          <Metric title="En limpieza" value={metrics.inProgress} icon={<Play className="h-4 w-4" />} />
          <Metric title="Esperando inspección" value={metrics.inspection} icon={<ClipboardCheck className="h-4 w-4" />} />
          <Metric title="SLA vencido" value={metrics.overdue} alert={metrics.overdue > 0} icon={<AlertTriangle className="h-4 w-4" />} />
        </div>

        <Card>
          <CardHeader><CardTitle>Tablero operacional</CardTitle><CardDescription>Las tareas provenientes de reservas conservan prioridad, hora objetivo y habitación vinculada.</CardDescription></CardHeader>
          <CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Habitación</TableHead><TableHead>Tarea</TableHead><TableHead>Hora objetivo</TableHead><TableHead>Estado</TableHead><TableHead>Inspección</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader><TableBody>
            {loading ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Cargando operación…</TableCell></TableRow> : tasks.length === 0 ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No hay tareas de Housekeeping.</TableCell></TableRow> : tasks.map(task => <TableRow key={task.id}>
              <TableCell><div className="font-medium">{task.room?.room_number ?? "Sin habitación"}</div><div className="text-xs text-muted-foreground">{task.room?.location ?? ""}</div></TableCell>
              <TableCell><div>{task.task_type}</div><Badge variant="outline" className="mt-1">{task.priority ?? "normal"}</Badge></TableCell>
              <TableCell>{formatDateTime(task.due_at ?? task.scheduled_for)}</TableCell>
              <TableCell><Badge variant="outline">{STATUS_LABELS[task.status] ?? task.status}</Badge></TableCell>
              <TableCell>{task.requires_inspection ? task.inspection_status : "No requerida"}{task.quality_score ? ` · ${task.quality_score}/5` : ""}</TableCell>
              <TableCell className="text-right"><div className="flex justify-end gap-2">
                {task.status === "pending" && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void runTaskAction(task.id, "assign")}><UserCheck className="mr-1 h-4 w-4" />Tomar</Button>}
                {task.status === "assigned" && <Button size="sm" disabled={busy !== null} onClick={() => void runTaskAction(task.id, "start")}><Play className="mr-1 h-4 w-4" />Iniciar</Button>}
                {task.status === "in_progress" && <Button size="sm" disabled={busy !== null} onClick={() => void runTaskAction(task.id, "complete")}><CheckCircle2 className="mr-1 h-4 w-4" />Terminar</Button>}
                {task.status === "inspection" && <><Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void runTaskAction(task.id, "reject")}>Rechazar</Button><Button size="sm" disabled={busy !== null} onClick={() => void runTaskAction(task.id, "approve")}>Aprobar</Button></>}
              </div></TableCell>
            </TableRow>)}
          </TableBody></Table></div>
          {metrics.inspection > 0 && <div className="mt-4 grid gap-4 md:grid-cols-[120px_1fr]"><div><Label htmlFor="quality">Puntaje 1–5</Label><Input id="quality" type="number" min="1" max="5" value={qualityScore} onChange={e => setQualityScore(e.target.value)} /></div><div><Label htmlFor="inspection-notes">Observación de inspección</Label><Textarea id="inspection-notes" value={inspectionNotes} onChange={e => setInspectionNotes(e.target.value)} placeholder="Obligatoria al rechazar; opcional al aprobar." /></div></div>}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><PackageSearch className="h-5 w-5" />Lost & Found</CardTitle><CardDescription>Custodia trazable de objetos encontrados en habitaciones.</CardDescription></CardHeader><CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3"><div><Label>Objeto</Label><Input value={lostItem} onChange={e => setLostItem(e.target.value)} placeholder="Descripción breve" /></div><div><Label>Habitación</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={lostRoomId} onChange={e => setLostRoomId(e.target.value)}><option value="">Sin asociar</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.room_number}</option>)}</select></div><div><Label>Custodia</Label><Input value={lostCustody} onChange={e => setLostCustody(e.target.value)} placeholder="Armario / recepción" /></div></div>
            <Button onClick={() => void createLostFound()} disabled={busy !== null}>Registrar objeto</Button>
            <div className="space-y-2">{lostFound.length === 0 ? <p className="text-sm text-muted-foreground">No hay objetos registrados.</p> : lostFound.map(item => <div key={item.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{item.item_name}</p><p className="text-xs text-muted-foreground">{item.room?.room_number ?? "Sin habitación"} · {formatDateTime(item.found_at)} · {item.custody_location ?? "Custodia pendiente"}</p></div><Badge variant="outline">{item.status}</Badge></div>)}</div>
          </CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shirt className="h-5 w-5" />Lencería</CardTitle><CardDescription>Disponibilidad limpia, en uso, lavandería y bajas. El catálogo parte vacío hasta registrar stock real.</CardDescription></CardHeader><CardContent>
            {linen.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No hay artículos de lencería registrados. No se crearon cantidades ficticias.</div> : <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Artículo</TableHead><TableHead>Limpio</TableHead><TableHead>En uso</TableHead><TableHead>Lavandería</TableHead><TableHead>Dañado</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{linen.map(item => <TableRow key={item.id}><TableCell><div className="font-medium">{item.name}</div><div className="font-mono text-xs text-muted-foreground">{item.code}</div></TableCell><TableCell>{item.clean_quantity} {item.unit}</TableCell><TableCell>{item.in_use_quantity}</TableCell><TableCell>{item.laundry_quantity}</TableCell><TableCell>{item.damaged_quantity}</TableCell><TableCell><Badge variant={item.clean_quantity <= item.minimum_clean_quantity ? "destructive" : "outline"}>{item.clean_quantity <= item.minimum_clean_quantity ? "Reponer" : "Disponible"}</Badge></TableCell></TableRow>)}</TableBody></Table></div>}
          </CardContent></Card>
        </div>
      </div>
    </AppLayout>
  )
}

function Metric({ title, value, icon, alert = false }: { title: string; value: number; icon: React.ReactNode; alert?: boolean }) {
  return <Card className={alert ? "border-amber-400" : undefined}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-3xl font-semibold">{value.toLocaleString("es-CL")}</div></CardContent></Card>
}
