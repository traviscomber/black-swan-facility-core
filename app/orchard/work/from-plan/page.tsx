"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, ClipboardCheck, MapPin, UserRound } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Employee = { id: string; name: string; role: string | null }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number }
type Cycle = { id: string; crop_name: string; variety: string | null }
type Allocation = { bed_id: string }
type Bed = { id: string; plot_id: string; name: string }
type Plot = { id: string; name: string; location_id: string | null }

const copy = {
  en: {
    eyebrow: "Orchard · Planning reference", title: "Confirm accountable task", description: "This is still a planning reference. Select the person responsible before creating a real operational task.",
    crop: "Crop / succession", action: "Planned work", date: "Due date", source: "Workbook evidence", location: "Canonical location", owner: "Responsible person", selectOwner: "Select responsible person", create: "Create accountable task", back: "Back to planning calendar", created: "Operational task created", open: "Open task management", error: "Could not create the task", missing: "The planning reference is incomplete or no longer belongs to the reconciled field plan.", noLocation: "The planting has no canonical Orchard location.", evidence: "Nothing is marked executed by this action. It only creates an assigned task in New status.",
  },
  es: {
    eyebrow: "Huerto · Referencia de planificación", title: "Confirmar tarea responsable", description: "Esto todavía es una referencia de planificación. Selecciona a la persona responsable antes de crear una tarea operacional real.",
    crop: "Cultivo / sucesión", action: "Labor planificada", date: "Fecha objetivo", source: "Evidencia del workbook", location: "Ubicación canónica", owner: "Persona responsable", selectOwner: "Seleccionar responsable", create: "Crear tarea responsable", back: "Volver al calendario de labores", created: "Tarea operacional creada", open: "Abrir gestión de tareas", error: "No fue posible crear la tarea", missing: "La referencia de planificación está incompleta o ya no pertenece al plan de campo reconciliado.", noLocation: "La plantación no tiene ubicación canónica de Huerto.", evidence: "Esta acción no marca trabajo como ejecutado. Sólo crea una tarea asignada en estado Nueva.",
  },
  de: {
    eyebrow: "Obstgarten · Planungsreferenz", title: "Verbindliche Aufgabe bestätigen", description: "Dies ist weiterhin eine Planungsreferenz. Wähle die verantwortliche Person, bevor eine echte operative Aufgabe erstellt wird.",
    crop: "Kultur / Folge", action: "Geplante Arbeit", date: "Fälligkeitsdatum", source: "Workbook-Nachweis", location: "Kanonischer Ort", owner: "Verantwortliche Person", selectOwner: "Verantwortliche Person wählen", create: "Verbindliche Aufgabe erstellen", back: "Zurück zum Arbeitskalender", created: "Operative Aufgabe erstellt", open: "Aufgabenverwaltung öffnen", error: "Aufgabe konnte nicht erstellt werden", missing: "Die Planungsreferenz ist unvollständig oder gehört nicht mehr zum abgeglichenen Feldplan.", noLocation: "Die Pflanzung hat keinen kanonischen Orchard-Ort.", evidence: "Diese Aktion markiert keine Arbeit als ausgeführt. Sie erstellt nur eine zugewiesene Aufgabe im Status Neu.",
  },
} as const

export default function OrchardTaskFromPlanPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang: Locale = language
  const text = copy[lang]
  const [employees, setEmployees] = useState<Employee[]>([])
  const [succession, setSuccession] = useState<Succession | null>(null)
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [location, setLocation] = useState<{ id: string; label: string } | null>(null)
  const [employeeId, setEmployeeId] = useState("none")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const gamePlanId = params.get("game_plan") ?? ""
  const successionId = params.get("succession") ?? ""
  const due = params.get("due") ?? ""
  const title = params.get("title") ?? ""
  const category = params.get("category") ?? ""
  const sourcePath = params.get("source_path") ?? ""
  const backHref = `/${language}/orchard/game-plan/tasks${gamePlanId ? `?game_plan=${encodeURIComponent(gamePlanId)}` : ""}`

  useEffect(() => {
    let live = true
    async function load() {
      setLoading(true); setError(null)
      if (!successionId || !due || !title || !category || !sourcePath || !sourcePath.startsWith("Crop Chart!")) { if (live) { setError(text.missing); setLoading(false) }; return }
      const [s, e, a] = await Promise.all([
        supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no").eq("id", successionId).maybeSingle(),
        supabase.from("employees").select("id,name,role").eq("is_active", true).order("name"),
        supabase.from("orchard_bed_allocations").select("bed_id").eq("crop_succession_id", successionId),
      ])
      if (!live) return
      const first = s.error ?? e.error ?? a.error
      if (first || !s.data) { setError(first?.message ?? text.missing); setLoading(false); return }
      const nextSuccession = s.data as Succession
      const c = await supabase.from("orchard_crop_cycles").select("id,crop_name,variety,game_plan_id").eq("id", nextSuccession.crop_cycle_id).eq("game_plan_id", gamePlanId).maybeSingle()
      if (!live) return
      if (c.error || !c.data || !(a.data ?? []).length) { setError(c.error?.message ?? text.missing); setLoading(false); return }
      const bedIds = [...new Set((a.data ?? []).map((row) => row.bed_id as string))]
      const b = await supabase.from("orchard_beds").select("id,plot_id,name").in("id", bedIds)
      if (!live) return
      if (b.error || !(b.data ?? []).length) { setError(b.error?.message ?? text.noLocation); setLoading(false); return }
      const beds = (b.data ?? []) as Bed[]
      const plotIds = [...new Set(beds.map((bed) => bed.plot_id))]
      const p = await supabase.from("orchard_plots").select("id,name,location_id").in("id", plotIds)
      if (!live) return
      const plots = (p.data ?? []) as Plot[]
      const firstPlot = plots.find((plot) => Boolean(plot.location_id))
      if (p.error || !firstPlot?.location_id) { setError(p.error?.message ?? text.noLocation); setLoading(false); return }
      const bedNames = beds.map((bed) => bed.name).join(", ")
      setSuccession(nextSuccession)
      setCycle(c.data as Cycle)
      setEmployees((e.data ?? []) as Employee[])
      setLocation({ id: firstPlot.location_id, label: `${firstPlot.name} · ${bedNames}` })
      setLoading(false)
    }
    void load()
    return () => { live = false }
  }, [supabase, successionId, due, title, category, sourcePath, gamePlanId, text.missing, text.noLocation])

  async function createTask() {
    if (!succession || !cycle || !location || employeeId === "none" || !due || !title || !sourcePath) return
    setSaving(true); setError(null)
    const existing = await supabase.from("tasks").select("id").eq("operational_area", "orchard").eq("source_type", "orchard_succession").eq("source_id", succession.id).eq("due_date", due).eq("source_path", sourcePath).maybeSingle()
    if (existing.data?.id) { setCreatedTaskId(existing.data.id as string); setSaving(false); return }
    if (existing.error) { setError(`${text.error}: ${existing.error.message}`); setSaving(false); return }
    const result = await supabase.rpc("create_operational_task_atomic", {
      p_title: title,
      p_description: `Planning reference from ${sourcePath}`,
      p_priority: "media",
      p_due_date: due,
      p_location_id: location.id,
      p_location_name: location.label,
      p_latitude: null,
      p_longitude: null,
      p_operational_area: "orchard",
      p_task_category: category,
      p_estimated_minutes: 60,
      p_animal_handling: false,
      p_safety_notes: null,
      p_employee_ids: [employeeId],
      p_volunteer_ids: [],
      p_source_type: "orchard_succession",
      p_source_id: succession.id,
      p_source_label: `${cycle.crop_name} #${succession.sequence_no}`,
      p_source_path: sourcePath,
    })
    if (result.error) { setError(`${text.error}: ${result.error.message}`); setSaving(false); return }
    const value = result.data as unknown
    const taskId = typeof value === "string" ? value : value && typeof value === "object" && "task_id" in value ? String((value as { task_id: unknown }).task_id) : null
    setCreatedTaskId(taskId)
    setSaving(false)
  }

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href={backHref} className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>{text.back}</Link>
    <header className="mb-8 max-w-3xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
    {loading ? <div className="py-12 text-sm text-muted-foreground">…</div> : error ? <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div> : createdTaskId ? <section className="border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] p-7"><CheckCircle2 className="h-6 w-6 text-[var(--orchard-green)]"/><h2 className="mt-4 text-2xl font-normal">{text.created}</h2><p className="mt-2 text-sm text-muted-foreground">{text.evidence}</p><Link href={`/${language}/tasks${createdTaskId ? `?entity=${encodeURIComponent(createdTaskId)}` : ""}`} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--orchard-green)]">{text.open}</Link></section> : <section className="border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]">
      <div className="grid gap-px bg-[var(--bs-divider-subtle)] md:grid-cols-2"><Field icon={ClipboardCheck} label={text.crop} value={cycle && succession ? `${cycle.crop_name} · #${succession.sequence_no}` : "—"}/><Field icon={ClipboardCheck} label={text.action} value={title}/><Field icon={ClipboardCheck} label={text.date} value={due}/><Field icon={ClipboardCheck} label={text.source} value={sourcePath}/><Field icon={MapPin} label={text.location} value={location?.label ?? "—"}/><div className="bg-[var(--bs-surface-primary)] p-5"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><UserRound className="h-4 w-4"/>{text.owner}</div><Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger className="mt-3"><SelectValue placeholder={text.selectOwner}/></SelectTrigger><SelectContent><SelectItem value="none">{text.selectOwner}</SelectItem>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` · ${employee.role}` : ""}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="flex flex-col gap-4 border-t border-[var(--bs-divider-subtle)] p-5 sm:flex-row sm:items-center sm:justify-between"><div><Badge variant="outline">{sourcePath}</Badge><p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">{text.evidence}</p></div><Button onClick={() => void createTask()} disabled={saving || employeeId === "none"}>{text.create}</Button></div>
    </section>}
  </main></AppLayout>
}

function Field({ icon: Icon, label, value }: { icon: typeof ClipboardCheck; label: string; value: string }) { return <div className="bg-[var(--bs-surface-primary)] p-5"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Icon className="h-4 w-4"/>{label}</div><p className="mt-3 text-sm leading-6">{value}</p></div> }
