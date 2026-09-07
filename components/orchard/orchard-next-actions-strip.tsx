"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarDays, PackageSearch } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type TaskRow = {
  id: string
  title: string
  status: string | null
  due_date: string | null
  location_name: string | null
  estimated_minutes: number | null
}
type PendingStock = { id: string; crop_name: string }

const copy = {
  en: {
    eyebrow: "Today · next actions",
    title: "What needs attention next",
    help: "Only real open work and unresolved physical evidence are shown here.",
    tasks: "Next 7 days",
    stock: "Physical counts pending",
    openTasks: "Open work board",
    openStock: "Count stock",
    noTasks: "No open Orchard tasks in the next 7 days.",
    noStock: "No physical stock counts are pending.",
    min: "min",
  },
  es: {
    eyebrow: "Hoy · próximas acciones",
    title: "Lo que requiere atención ahora",
    help: "Aquí sólo aparece trabajo real abierto y evidencia física pendiente.",
    tasks: "Próximos 7 días",
    stock: "Conteos físicos pendientes",
    openTasks: "Abrir tablero de trabajo",
    openStock: "Contar stock",
    noTasks: "No hay tareas abiertas de Orchard en los próximos 7 días.",
    noStock: "No hay conteos físicos pendientes.",
    min: "min",
  },
  de: {
    eyebrow: "Heute · nächste Aktionen",
    title: "Was jetzt Aufmerksamkeit braucht",
    help: "Hier erscheinen nur reale offene Arbeit und noch fehlende physische Nachweise.",
    tasks: "Nächste 7 Tage",
    stock: "Ausstehende Bestandszählungen",
    openTasks: "Arbeitsboard öffnen",
    openStock: "Bestand zählen",
    noTasks: "Keine offenen Orchard-Aufgaben in den nächsten 7 Tagen.",
    noStock: "Keine physischen Bestandszählungen offen.",
    min: "Min.",
  },
} as const

const closedStatuses = new Set(["completed", "complete", "done", "closed", "cancelled", "canceled", "completada", "completado", "cerrada", "cerrado", "cancelada", "cancelado"])
function chileDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}
function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
function dateLabel(value: string, locale: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short" })
}

export function OrchardNextActionsStrip() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : lang === "de" ? "de-DE" : "en-US"
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [pendingStock, setPendingStock] = useState<PendingStock[]>([])
  const [planning, setPlanning] = useState(false)

  useEffect(() => {
    let live = true
    const today = chileDate()
    const through = addDays(today, 7)
    void Promise.all([
      supabase.from("tasks").select("id,title,status,due_date,location_name,estimated_minutes").in("operational_area", ["orchard", "huerto_vinedo"]).gte("due_date", today).lte("due_date", through).order("due_date", { ascending: true }).limit(20),
      supabase.from("orchard_seed_lots").select("id,crop_name").eq("count_status", "pending").order("crop_name"),
      supabase.auth.getUser(),
    ]).then(async ([taskResult, stockResult, auth]) => {
      if (!live) return
      const nextTasks = ((taskResult.data ?? []) as TaskRow[]).filter((task) => !closedStatuses.has((task.status ?? "").trim().toLowerCase())).slice(0, 3)
      setTasks(nextTasks)
      setPendingStock((stockResult.data ?? []) as PendingStock[])
      const uid = auth.data.user?.id
      if (!uid) return
      const pref = await supabase.from("orchard_dashboard_preferences").select("active_view").eq("user_id", uid).maybeSingle()
      if (live) setPlanning(pref.data?.active_view === "planning")
    })
    return () => { live = false }
  }, [supabase])

  if (planning) return null

  const query = typeof window !== "undefined" ? window.location.search : ""
  return <section data-orchard-next-actions className="mx-auto w-full max-w-[1500px] px-4 pt-5 sm:px-6 lg:px-8">
    <div className="border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)]">
      <div className="border-b border-[var(--orchard-line)] px-4 py-4 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--orchard-green)]">{text.eyebrow}</p>
        <div className="mt-1 flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="text-xl font-medium tracking-[-.02em]">{text.title}</h2>
          <p className="text-xs text-muted-foreground">{text.help}</p>
        </div>
      </div>
      <div className="grid lg:grid-cols-[1.5fr_.8fr]">
        <div className="border-b border-[var(--orchard-line)] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-xs font-medium"><CalendarDays className="h-4 w-4 text-[var(--orchard-green)]"/>{text.tasks}</div>
            <Link href={`/${language}/orchard/work/week-board${query}`} className="inline-flex items-center gap-1 text-xs text-[var(--orchard-green)]">{text.openTasks}<ArrowRight className="h-3.5 w-3.5"/></Link>
          </div>
          {tasks.length ? <div className="grid md:grid-cols-3">{tasks.map((task) => <div key={task.id} className="border-t border-[var(--orchard-line)] px-4 py-3 md:border-r md:last:border-r-0 sm:px-5">
            <p className="text-sm font-medium">{task.title}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{task.due_date ? dateLabel(task.due_date, locale) : "—"}{task.location_name ? ` · ${task.location_name}` : ""}</p>
            {task.estimated_minutes != null ? <p className="mt-2 text-[10px] tabular-nums text-muted-foreground">{task.estimated_minutes} {text.min}</p> : null}
          </div>)}</div> : <p className="border-t border-[var(--orchard-line)] px-4 py-4 text-xs text-muted-foreground sm:px-5">{text.noTasks}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-xs font-medium"><PackageSearch className="h-4 w-4 text-[var(--orchard-green)]"/>{text.stock}</div>
            <Link href={`/${language}/orchard/nursery/quick-stock${query}`} className="inline-flex items-center gap-1 text-xs text-[var(--orchard-green)]">{text.openStock}<ArrowRight className="h-3.5 w-3.5"/></Link>
          </div>
          {pendingStock.length ? <div className="flex flex-wrap gap-2 border-t border-[var(--orchard-line)] px-4 py-4 sm:px-5">{pendingStock.map((lot) => <span key={lot.id} className="border border-[var(--orchard-line)] bg-[var(--bs-surface-secondary)] px-2.5 py-1.5 text-xs">{lot.crop_name}</span>)}</div> : <p className="border-t border-[var(--orchard-line)] px-4 py-4 text-xs text-muted-foreground sm:px-5">{text.noStock}</p>}
        </div>
      </div>
    </div>
  </section>
}
