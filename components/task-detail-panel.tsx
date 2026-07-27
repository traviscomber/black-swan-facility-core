"use client"

import Link from "next/link"
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calendar, Camera, Clock, ExternalLink, FileText, Loader2, MapPin, MessageCircle, Pencil, Send, Upload, Users, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { operationalAreaLabels, type OperationalArea } from "@/lib/operational-task-templates"

type TaskStatus = "nueva" | "en_progreso" | "completada" | "cancelada"
type Task = {
  id: string
  title: string
  description?: string | null
  priority: "baja" | "media" | "alta" | "urgente"
  status: TaskStatus
  due_date?: string | null
  location_name?: string | null
  location_id?: string | null
  latitude?: number | null
  longitude?: number | null
  created_at: string
  operational_area?: OperationalArea | null
  task_category?: string | null
  estimated_minutes?: number | null
  animal_handling?: boolean
  safety_notes?: string | null
  source_label?: string | null
  source_path?: string | null
  task_assignments: Array<{
    employee_id?: string | null
    volunteer_id?: string | null
    employees?: { id: string; name: string; email?: string | null; phone?: string | null } | null
    volunteers?: { id: string; name: string; email?: string | null; phone?: string | null; volunteer_role?: string | null } | null
  }>
}

type TaskComment = {
  id: string
  comment: string
  author_email: string | null
  created_at: string | null
}

type TaskEvidence = {
  id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  file_size: number | null
  caption: string | null
  uploader_email: string | null
  created_at: string
  signed_url?: string | null
}

const statusLabels: Record<TaskStatus, string> = { nueva: "Pendiente", en_progreso: "En curso", completada: "Completada", cancelada: "Cancelada" }
const priorityLabels = { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" }

function formatTimestamp(value: string | null) {
  if (!value) return "Fecha no disponible"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value))
}

function whatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "")
  if (digits.startsWith("56")) return digits
  return digits.length >= 8 ? `56${digits}` : digits
}

function safeFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-")
}

export function TaskDetailPanel({ task, onUpdate, onClose, onEdit }: { task: Task; onUpdate: () => void; onClose: () => void; onEdit: (task: Task) => void }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [saving, setSaving] = useState(false)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [comment, setComment] = useState("")
  const [savingComment, setSavingComment] = useState(false)
  const [evidence, setEvidence] = useState<TaskEvidence[]>([])
  const [caption, setCaption] = useState("")
  const [uploading, setUploading] = useState(false)
  const [loadingActivity, setLoadingActivity] = useState(true)

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true)
    const [commentsResult, evidenceResult] = await Promise.all([
      supabase.from("task_comments").select("id, comment, author_email, created_at").eq("task_id", task.id).order("created_at", { ascending: false }),
      supabase.from("task_evidence").select("id, storage_path, file_name, mime_type, file_size, caption, uploader_email, created_at").eq("task_id", task.id).order("created_at", { ascending: false }),
    ])

    if (commentsResult.error) toast({ title: "No fue posible cargar comentarios", description: commentsResult.error.message, variant: "destructive" })
    else setComments((commentsResult.data ?? []) as TaskComment[])

    if (evidenceResult.error) {
      toast({ title: "No fue posible cargar evidencia", description: evidenceResult.error.message, variant: "destructive" })
      setEvidence([])
    } else {
      const records = (evidenceResult.data ?? []) as TaskEvidence[]
      const signed = await Promise.all(records.map(async (item) => {
        const { data } = await supabase.storage.from("task-evidence").createSignedUrl(item.storage_path, 3600)
        return { ...item, signed_url: data?.signedUrl ?? null }
      }))
      setEvidence(signed)
    }
    setLoadingActivity(false)
  }, [supabase, task.id, toast])

  useEffect(() => setStatus(task.status), [task.status])
  useEffect(() => { void loadActivity() }, [loadActivity])

  async function saveStatus() {
    if (status === task.status) return
    setSaving(true)
    const employeeIds = task.task_assignments.map((item) => item.employee_id).filter(Boolean) as string[]
    const volunteerIds = task.task_assignments.map((item) => item.volunteer_id).filter(Boolean) as string[]
    const { error } = await supabase.rpc("update_operational_task_atomic", {
      p_task_id: task.id,
      p_title: task.title,
      p_description: task.description ?? null,
      p_priority: task.priority,
      p_status: status,
      p_due_date: task.due_date ?? null,
      p_location_id: task.location_id ?? null,
      p_location_name: task.location_name ?? null,
      p_latitude: task.latitude ?? null,
      p_longitude: task.longitude ?? null,
      p_operational_area: task.operational_area ?? null,
      p_task_category: task.task_category ?? null,
      p_estimated_minutes: task.estimated_minutes ?? null,
      p_animal_handling: Boolean(task.animal_handling),
      p_safety_notes: task.safety_notes ?? null,
      p_employee_ids: employeeIds,
      p_volunteer_ids: volunteerIds,
    })
    if (error) {
      toast({ title: "No fue posible actualizar el estado", description: error.message, variant: "destructive" })
      setSaving(false)
      return
    }
    toast({ title: "Estado actualizado", description: `${task.title}: ${statusLabels[status]}` })
    setSaving(false)
    onUpdate()
  }

  async function addComment() {
    const cleanComment = comment.trim()
    if (!cleanComment) return
    setSavingComment(true)
    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user) {
      toast({ title: "Sesión requerida", description: "Inicia sesión nuevamente para comentar.", variant: "destructive" })
      setSavingComment(false)
      return
    }
    const { error } = await supabase.from("task_comments").insert({ task_id: task.id, comment: cleanComment, created_by: user.id, author_email: user.email ?? null })
    if (error) toast({ title: "No fue posible guardar el comentario", description: error.message, variant: "destructive" })
    else {
      setComment("")
      toast({ title: "Comentario registrado" })
      await loadActivity()
    }
    setSavingComment(false)
  }

  async function uploadEvidence(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return toast({ title: "Archivo demasiado grande", description: "El máximo permitido es 10 MB.", variant: "destructive" })
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") return toast({ title: "Formato no admitido", description: "Adjunta una imagen o un PDF.", variant: "destructive" })

    setUploading(true)
    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user) {
      toast({ title: "Sesión requerida", description: "Inicia sesión nuevamente para adjuntar evidencia.", variant: "destructive" })
      setUploading(false)
      return
    }

    const path = `${task.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from("task-evidence").upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      toast({ title: "No fue posible subir la evidencia", description: uploadError.message, variant: "destructive" })
      setUploading(false)
      return
    }

    const { error: recordError } = await supabase.from("task_evidence").insert({ task_id: task.id, storage_path: path, file_name: file.name, mime_type: file.type, file_size: file.size, caption: caption.trim() || null, uploaded_by: user.id, uploader_email: user.email ?? null })
    if (recordError) {
      await supabase.storage.from("task-evidence").remove([path])
      toast({ title: "No fue posible registrar la evidencia", description: recordError.message, variant: "destructive" })
    } else {
      setCaption("")
      toast({ title: "Evidencia registrada", description: file.name })
      await loadActivity()
    }
    setUploading(false)
  }

  function whatsappHref(phone: string) {
    const number = whatsappNumber(phone)
    const due = task.due_date ? format(parseISO(task.due_date), "d 'de' MMMM", { locale: es }) : "sin fecha definida"
    const message = [`Black Swan · Nueva tarea operativa`, `*${task.title}*`, `Estado: ${statusLabels[task.status]}`, `Prioridad: ${priorityLabels[task.priority]}`, `Fecha objetivo: ${due}`, task.location_name ? `Lugar: ${task.location_name}` : null, task.description ? `Indicaciones: ${task.description}` : null, `${window.location.origin}/tasks`].filter(Boolean).join("\n")
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
  }

  return <div className="space-y-5 p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">Detalle de tarea</p><h2 className="mt-1 text-xl font-semibold">{task.title}</h2></div><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => onEdit(task)} aria-label="Editar tarea"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar detalle"><X className="h-4 w-4" /></Button></div></div>
    <div className="flex flex-wrap gap-2"><Badge variant="outline">{statusLabels[task.status]}</Badge><Badge variant="outline">Prioridad {priorityLabels[task.priority]}</Badge>{task.operational_area && <Badge variant="secondary">{operationalAreaLabels[task.operational_area]}</Badge>}{task.task_category && <Badge variant="outline">{task.task_category}</Badge>}{task.animal_handling && <Badge variant="outline" className="border-amber-400 text-amber-700">Manejo animal</Badge>}</div>

    {task.source_path && <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Registro de origen</p><p className="mt-1 text-sm font-medium">{task.source_label || "Abrir registro relacionado"}</p></div><Button asChild variant="outline" size="sm"><Link href={task.source_path}><ExternalLink className="mr-2 h-4 w-4" />Abrir origen</Link></Button></CardContent></Card>}

    <Card><CardHeader><CardTitle className="text-base">Información</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{task.description && <p className="text-muted-foreground">{task.description}</p>}{task.due_date && <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{format(parseISO(task.due_date), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>}{task.location_name && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{task.location_name}</p>}{task.estimated_minutes && <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Duración estimada: {task.estimated_minutes} minutos</p>}</CardContent></Card>
    {(task.animal_handling || task.safety_notes) && <Card className="border-amber-400/50"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" />Seguridad</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{task.safety_notes || "Esta tarea requiere manejo o cercanía con animales y debe realizarse bajo instrucciones del responsable del área."}</CardContent></Card>}

    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Responsables y WhatsApp</CardTitle></CardHeader><CardContent>{task.task_assignments.length === 0 ? <p className="text-sm text-muted-foreground">Sin responsables asignados.</p> : <ul className="space-y-3">{task.task_assignments.map((assignment, index) => { const person = assignment.employees ?? assignment.volunteers; const kind = assignment.volunteer_id ? "Voluntario" : "Trabajador"; return <li key={assignment.employee_id ?? assignment.volunteer_id ?? index} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 text-sm"><p className="font-medium">{person?.name ?? "Persona no disponible"}</p><p className="truncate text-xs text-muted-foreground">{kind}{person?.phone ? ` · ${person.phone}` : " · Sin teléfono registrado"}</p></div>{person?.phone && <Button asChild variant="outline" size="sm"><a href={whatsappHref(person.phone)} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Enviar por WhatsApp</a></Button>}</li> })}</ul>}<p className="mt-3 text-xs text-muted-foreground">El envío actual abre WhatsApp Web con el mensaje preparado. GreenAPI queda reservado para automatización posterior.</p></CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Camera className="h-4 w-4" />Evidencia de ejecución</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Descripción opcional de la evidencia" /><label className="inline-flex cursor-pointer items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"><input type="file" accept="image/*,application/pdf" className="sr-only" onChange={uploadEvidence} disabled={uploading} />{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Adjuntar</label></div><p className="text-xs text-muted-foreground">Imágenes o PDF, máximo 10 MB. Los archivos se guardan en un contenedor privado.</p>{loadingActivity ? <Loader2 className="h-5 w-5 animate-spin" /> : evidence.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay evidencia adjunta.</p> : <div className="grid gap-3 sm:grid-cols-2">{evidence.map((item) => <a key={item.id} href={item.signed_url || "#"} target="_blank" rel="noreferrer" className="rounded-md border p-3 hover:bg-muted/40"><div className="flex items-start gap-3">{item.mime_type?.startsWith("image/") ? <Camera className="mt-0.5 h-4 w-4" /> : <FileText className="mt-0.5 h-4 w-4" />}<div className="min-w-0"><p className="truncate text-sm font-medium">{item.file_name}</p>{item.caption && <p className="mt-1 text-xs text-muted-foreground">{item.caption}</p>}<p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(item.created_at)}{item.uploader_email ? ` · ${item.uploader_email}` : ""}</p></div></div></a>)}</div>}</CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4" />Comentarios y novedades</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={2000} placeholder="Registrar avance, novedad, bloqueo o resultado" /><Button onClick={addComment} disabled={savingComment || !comment.trim()}>{savingComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Guardar comentario</Button></div>{loadingActivity ? <Loader2 className="h-5 w-5 animate-spin" /> : comments.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay comentarios.</p> : <div className="space-y-3">{comments.map((item) => <div key={item.id} className="rounded-md border p-3"><p className="whitespace-pre-wrap text-sm">{item.comment}</p><p className="mt-2 text-xs text-muted-foreground">{formatTimestamp(item.created_at)}{item.author_email ? ` · ${item.author_email}` : ""}</p></div>)}</div>}</CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Actualizar estado</CardTitle></CardHeader><CardContent className="space-y-3"><Select value={status} onValueChange={(value: TaskStatus) => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nueva">Pendiente</SelectItem><SelectItem value="en_progreso">En curso</SelectItem><SelectItem value="completada">Completada</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select><Button className="w-full" onClick={saveStatus} disabled={saving || status === task.status}>{saving ? "Guardando…" : "Guardar estado"}</Button><p className="text-xs text-muted-foreground">Las tareas se completan o cancelan para conservar trazabilidad. No se eliminan desde esta vista.</p></CardContent></Card>
  </div>
}
