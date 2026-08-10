"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Camera, Check, ChevronLeft, Loader2, RefreshCw, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Language = "es" | "en" | "de"
type ChecklistItem = { id: string; label: string; done: boolean }
type HousekeepingTask = {
  id: string
  room_id: string | null
  reservation_id: string | null
  task_type: string
  status: string
  priority: string | null
  notes: string | null
  started_at: string | null
  checklist: unknown
  evidence_urls: string[] | null
  requires_inspection: boolean
  inspection_status: string
  room: { room_number: string; location: string | null } | null
  reservation: { guest_name: string } | null
}

const COPY = {
  es: {
    title: "Mis tareas de Housekeeping",
    subtitle: "Checklist, foto y comentario desde el celular.",
    empty: "No tienes tareas abiertas asignadas.",
    refresh: "Actualizar",
    task: "Tarea",
    room: "Habitación",
    guest: "Huésped",
    start: "Iniciar tarea",
    checklist: "Checklist",
    evidence: "Evidencia",
    photo: "Tomar foto",
    photoHelp: "Toma al menos una foto antes de finalizar.",
    comment: "Comentario final",
    commentPlaceholder: "Escribe qué quedó terminado o cualquier observación.",
    finish: "Finalizar tarea",
    finishing: "Finalizando…",
    uploading: "Subiendo foto…",
    completeChecklist: "Completa todo el checklist.",
    needPhoto: "Agrega al menos una foto.",
    needComment: "Agrega un comentario final.",
    inspection: "Quedará pendiente de inspección.",
    completed: "Tarea terminada.",
    started: "Tarea iniciada.",
    photos: "fotos",
    progress: "completados",
    back: "Volver a tareas",
  },
  en: {
    title: "My Housekeeping tasks",
    subtitle: "Checklist, photo and completion note from your phone.",
    empty: "You have no assigned open tasks.",
    refresh: "Refresh",
    task: "Task",
    room: "Room",
    guest: "Guest",
    start: "Start task",
    checklist: "Checklist",
    evidence: "Evidence",
    photo: "Take photo",
    photoHelp: "Take at least one photo before finishing.",
    comment: "Completion note",
    commentPlaceholder: "Describe what was completed or any observation.",
    finish: "Finish task",
    finishing: "Finishing…",
    uploading: "Uploading photo…",
    completeChecklist: "Complete the entire checklist.",
    needPhoto: "Add at least one photo.",
    needComment: "Add a completion note.",
    inspection: "This task will wait for inspection.",
    completed: "Task finished.",
    started: "Task started.",
    photos: "photos",
    progress: "completed",
    back: "Back to tasks",
  },
  de: {
    title: "Meine Housekeeping-Aufgaben",
    subtitle: "Checkliste, Foto und Abschlusskommentar direkt vom Handy.",
    empty: "Keine offenen Aufgaben sind dir zugewiesen.",
    refresh: "Aktualisieren",
    task: "Aufgabe",
    room: "Zimmer",
    guest: "Gast",
    start: "Aufgabe starten",
    checklist: "Checkliste",
    evidence: "Nachweis",
    photo: "Foto aufnehmen",
    photoHelp: "Vor Abschluss mindestens ein Foto aufnehmen.",
    comment: "Abschlusskommentar",
    commentPlaceholder: "Beschreibe, was erledigt wurde oder notiere eine Beobachtung.",
    finish: "Aufgabe abschließen",
    finishing: "Wird abgeschlossen…",
    uploading: "Foto wird hochgeladen…",
    completeChecklist: "Bitte die gesamte Checkliste abschließen.",
    needPhoto: "Mindestens ein Foto hinzufügen.",
    needComment: "Abschlusskommentar hinzufügen.",
    inspection: "Die Aufgabe wartet anschließend auf Inspektion.",
    completed: "Aufgabe abgeschlossen.",
    started: "Aufgabe gestartet.",
    photos: "Fotos",
    progress: "erledigt",
    back: "Zurück zu Aufgaben",
  },
} satisfies Record<Language, Record<string, string>>

const CHECK_LABELS: Record<Language, Record<string, string>> = {
  es: {
    bed: "Hacer y presentar cama",
    towels: "Cambiar y presentar toallas",
    bathroom: "Limpiar baño completo",
    mirrors: "Limpiar espejos",
    windows_inside: "Limpiar vidrios interiores",
    windows_outside: "Revisar / limpiar vidrios exteriores",
    spiderwebs: "Quitar telarañas",
    floors: "Aspirar o barrer pisos",
    mop: "Trapear pisos",
    baseboards: "Limpiar zócalos",
    high_dust: "Quitar polvo en altura y luminarias",
    trash: "Retirar basura",
    amenities: "Revisar y reponer amenities",
    terrace: "Revisar terraza / exterior",
    final_visual: "Revisión visual final",
    collect_linen: "Retirar ropa de cama y toallas usadas",
    sort_linen: "Separar ropa para lavandería",
    send_laundry: "Enviar lavandería",
    restock_linen: "Reponer ropa limpia",
  },
  en: {
    bed: "Make and present the bed",
    towels: "Replace and present towels",
    bathroom: "Clean the complete bathroom",
    mirrors: "Clean mirrors",
    windows_inside: "Clean interior windows",
    windows_outside: "Check / clean exterior windows",
    spiderwebs: "Remove spider webs",
    floors: "Vacuum or sweep floors",
    mop: "Mop floors",
    baseboards: "Clean baseboards",
    high_dust: "Remove high dust and clean light fixtures",
    trash: "Remove trash",
    amenities: "Check and restock amenities",
    terrace: "Check terrace / exterior",
    final_visual: "Final visual inspection",
    collect_linen: "Collect used linen and towels",
    sort_linen: "Sort laundry",
    send_laundry: "Send laundry",
    restock_linen: "Restock clean linen",
  },
  de: {
    bed: "Bett machen und präsentieren",
    towels: "Handtücher wechseln und präsentieren",
    bathroom: "Bad vollständig reinigen",
    mirrors: "Spiegel reinigen",
    windows_inside: "Innenfenster reinigen",
    windows_outside: "Außenfenster prüfen / reinigen",
    spiderwebs: "Spinnweben entfernen",
    floors: "Böden saugen oder kehren",
    mop: "Böden wischen",
    baseboards: "Fußleisten reinigen",
    high_dust: "Staub in Höhe und Leuchten reinigen",
    trash: "Müll entfernen",
    amenities: "Amenities prüfen und auffüllen",
    terrace: "Terrasse / Außenbereich prüfen",
    final_visual: "Abschließende Sichtkontrolle",
    collect_linen: "Benutzte Bettwäsche und Handtücher sammeln",
    sort_linen: "Wäsche sortieren",
    send_laundry: "Wäsche zur Reinigung geben",
    restock_linen: "Saubere Wäsche auffüllen",
  },
}

const CLEANING_KEYS = [
  "bed", "towels", "bathroom", "mirrors", "windows_inside", "windows_outside", "spiderwebs",
  "floors", "mop", "baseboards", "high_dust", "trash", "amenities", "terrace", "final_visual",
]
const LAUNDRY_KEYS = ["collect_linen", "sort_linen", "send_laundry", "restock_linen"]

function defaultChecklist(taskType: string, locale: Language): ChecklistItem[] {
  const keys = taskType.includes("laundry") ? LAUNDRY_KEYS : CLEANING_KEYS
  return keys.map((id) => ({ id, label: CHECK_LABELS[locale][id] ?? id, done: false }))
}

function normalizeChecklist(value: unknown, taskType: string, locale: Language): ChecklistItem[] {
  if (!Array.isArray(value) || value.length === 0) return defaultChecklist(taskType, locale)
  return value
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const source = item as Record<string, unknown>
      const id = typeof source.id === "string" ? source.id : `item_${index + 1}`
      const fallback = typeof source.label === "string" ? source.label : id
      return { id, label: CHECK_LABELS[locale][id] ?? fallback, done: source.done === true }
    })
}

export default function HousekeepingMobilePage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const locale: Language = language === "en" || language === "de" ? language : "es"
  const copy = COPY[locale]
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [tasks, setTasks] = useState<HousekeepingTask[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [comment, setComment] = useState("")

  const loadTasks = useCallback(async () => {
    setLoading(true)
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (!userId) {
      setTasks([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("housekeeping_tasks")
      .select("id,room_id,reservation_id,task_type,status,priority,notes,started_at,checklist,evidence_urls,requires_inspection,inspection_status,room:rooms(room_number,location),reservation:reservations(guest_name)")
      .eq("assigned_to", userId)
      .not("status", "in", "(completed,cancelled)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })

    if (error) toast.error(error.message)
    setTasks((data ?? []) as unknown as HousekeepingTask[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadTasks() }, [loadTasks])

  const selected = tasks.find((task) => task.id === selectedId) ?? null
  const checklist = selected ? normalizeChecklist(selected.checklist, selected.task_type, locale) : []
  const completedCount = checklist.filter((item) => item.done).length
  const photos = selected?.evidence_urls ?? []

  async function persistChecklist(task: HousekeepingTask, next: ChecklistItem[]) {
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, checklist: next } : item))
    const { error } = await supabase.from("housekeeping_tasks").update({ checklist: next }).eq("id", task.id)
    if (error) {
      toast.error(error.message)
      await loadTasks()
    }
  }

  async function startTask(task: HousekeepingTask) {
    setSaving(true)
    const seeded = normalizeChecklist(task.checklist, task.task_type, locale)
    const { error } = await supabase
      .from("housekeeping_tasks")
      .update({ status: "in_progress", started_at: task.started_at ?? new Date().toISOString(), checklist: seeded })
      .eq("id", task.id)
    if (error) toast.error(error.message)
    else {
      toast.success(copy.started)
      await loadTasks()
    }
    setSaving(false)
  }

  async function uploadPhoto(task: HousekeepingTask, file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes")
      return
    }
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-")
    const path = `housekeeping/${task.id}/${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from("task-evidence").upload(path, file, { upsert: false })
    if (uploadError) {
      toast.error(uploadError.message)
      setUploading(false)
      return
    }
    const nextEvidence = [...(task.evidence_urls ?? []), path]
    const { error: taskError } = await supabase.from("housekeeping_tasks").update({ evidence_urls: nextEvidence }).eq("id", task.id)
    if (taskError) toast.error(taskError.message)
    else await loadTasks()
    setUploading(false)
  }

  async function finishTask(task: HousekeepingTask) {
    const currentChecklist = normalizeChecklist(task.checklist, task.task_type, locale)
    if (currentChecklist.some((item) => !item.done)) return toast.error(copy.completeChecklist)
    if ((task.evidence_urls ?? []).length === 0) return toast.error(copy.needPhoto)
    if (!comment.trim()) return toast.error(copy.needComment)

    setSaving(true)
    const nextStatus = task.requires_inspection ? "inspection" : "completed"
    const { error } = await supabase
      .from("housekeeping_tasks")
      .update({
        status: nextStatus,
        resolution_notes: comment.trim(),
        completed_at: new Date().toISOString(),
        inspection_status: task.requires_inspection ? "pending" : "not_required",
        checklist: currentChecklist,
      })
      .eq("id", task.id)

    if (error) toast.error(error.message)
    else {
      toast.success(task.requires_inspection ? copy.inspection : copy.completed)
      setComment("")
      setSelectedId(null)
      await loadTasks()
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="flex min-h-[70dvh] items-center justify-center bg-[var(--bs-bg-primary)]"><Loader2 className="h-7 w-7 animate-spin" /></div>
  }

  if (!selected) {
    return (
      <main className="min-h-dvh bg-[var(--bs-bg-primary)] px-4 pb-10 pt-6 text-[var(--bs-text-primary)]">
        <div className="mx-auto max-w-xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--bs-cool-sage)]">HOUSEKEEPING</p>
              <h1 className="mt-2 text-2xl font-normal">{copy.title}</h1>
              <p className="mt-2 text-sm text-[var(--bs-text-secondary)]">{copy.subtitle}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="rounded-none" onClick={() => void loadTasks()} aria-label={copy.refresh}>
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>

          {tasks.length === 0 ? (
            <div className="bg-[var(--bs-surface-primary)] p-5 text-sm text-[var(--bs-text-secondary)]">{copy.empty}</div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const items = normalizeChecklist(task.checklist, task.task_type, locale)
                const done = items.filter((item) => item.done).length
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => { setSelectedId(task.id); setComment("") }}
                    className="w-full bg-[var(--bs-surface-primary)] p-5 text-left transition-colors hover:bg-[var(--bs-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bs-cool-sky)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-[var(--bs-text-muted)]">{task.room?.location ?? "Black Swan"}</p>
                        <p className="mt-1 text-lg">{task.room?.room_number ?? copy.task}</p>
                        <p className="mt-1 text-sm text-[var(--bs-text-secondary)]">{task.task_type.replaceAll("_", " ")}</p>
                      </div>
                      <span className="bg-[var(--bs-surface-elevated)] px-2 py-1 text-xs">{task.status}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-[var(--bs-text-muted)]">
                      <span>{task.reservation?.guest_name ?? "—"}</span>
                      <span>{done}/{items.length} {copy.progress}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[var(--bs-bg-primary)] pb-28 text-[var(--bs-text-primary)]">
      <div className="mx-auto max-w-xl px-4 pt-4">
        <button type="button" onClick={() => { setSelectedId(null); setComment("") }} className="mb-4 flex min-h-11 items-center gap-2 text-sm text-[var(--bs-text-secondary)]">
          <ChevronLeft className="h-4 w-4" /> {copy.back}
        </button>

        <section className="bg-[var(--bs-surface-primary)] p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--bs-cool-sage)]">{selected.room?.location ?? "Black Swan"}</p>
          <h1 className="mt-2 text-2xl font-normal">{selected.room?.room_number ?? copy.task}</h1>
          <p className="mt-1 text-sm text-[var(--bs-text-secondary)]">{selected.task_type.replaceAll("_", " ")}</p>
          {selected.reservation?.guest_name && <p className="mt-3 text-sm">{copy.guest}: {selected.reservation.guest_name}</p>}
          {selected.notes && <p className="mt-3 text-sm text-[var(--bs-text-secondary)]">{selected.notes}</p>}
        </section>

        {selected.status !== "in_progress" && selected.status !== "inspection" ? (
          <Button type="button" className="mt-4 min-h-12 w-full rounded-none" disabled={saving} onClick={() => void startTask(selected)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{copy.start}
          </Button>
        ) : (
          <>
            <section className="mt-4 bg-[var(--bs-surface-primary)] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-normal">{copy.checklist}</h2>
                <span className="text-xs text-[var(--bs-text-secondary)]">{completedCount}/{checklist.length}</span>
              </div>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={selected.status === "inspection" || saving}
                    onClick={() => void persistChecklist(selected, checklist.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry))}
                    className="flex min-h-14 w-full items-center gap-3 bg-[var(--bs-surface-secondary)] px-4 py-3 text-left disabled:opacity-60"
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${item.done ? "bg-[var(--bs-cool-sage)] text-[#171512]" : "bg-[var(--bs-surface-elevated)]"}`}>
                      {item.done && <Check className="h-4 w-4" />}
                    </span>
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-4 bg-[var(--bs-surface-primary)] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-normal">{copy.evidence}</h2>
                <span className="text-xs text-[var(--bs-text-secondary)]">{photos.length} {copy.photos}</span>
              </div>
              <p className="mt-2 text-xs text-[var(--bs-text-muted)]">{copy.photoHelp}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadPhoto(selected, file)
                  event.currentTarget.value = ""
                }}
              />
              <Button type="button" variant="secondary" className="mt-4 min-h-12 w-full rounded-none" disabled={uploading || selected.status === "inspection"} onClick={() => fileInputRef.current?.click()}>
                {uploading ? <Upload className="mr-2 h-4 w-4 animate-pulse" /> : <Camera className="mr-2 h-4 w-4" />}
                {uploading ? copy.uploading : copy.photo}
              </Button>
            </section>

            <section className="mt-4 bg-[var(--bs-surface-primary)] p-5">
              <label htmlFor="housekeeping-comment" className="text-sm">{copy.comment}</label>
              <textarea
                id="housekeeping-comment"
                value={comment}
                disabled={selected.status === "inspection"}
                onChange={(event) => setComment(event.target.value)}
                placeholder={copy.commentPlaceholder}
                className="mt-3 min-h-28 w-full resize-none bg-[var(--bs-surface-secondary)] p-4 text-sm text-[var(--bs-text-primary)] outline-none placeholder:text-[var(--bs-text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bs-cool-sky)]"
              />
            </section>
          </>
        )}
      </div>

      {selected.status === "in_progress" && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-[var(--bs-bg-secondary)] p-4">
          <div className="mx-auto max-w-xl">
            <Button type="button" className="min-h-12 w-full rounded-none bg-[var(--bs-cool-sage)] text-[#171512] hover:bg-[var(--bs-cool-sage)]" disabled={saving || uploading} onClick={() => void finishTask(selected)}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {saving ? copy.finishing : copy.finish}
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
