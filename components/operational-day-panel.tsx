"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, ClipboardList, ConciergeBell, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type OperationalItem = {
  id: string
  title: string
  subtitle: string
  status: string
  priority: string | null
  area: "Housekeeping" | "Hospitality" | "Operación"
}

const OPEN_STATUSES = ["pending", "assigned", "in_progress", "blocked", "open"]

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function areaIcon(area: OperationalItem["area"]) {
  if (area === "Housekeeping") return <Sparkles className="h-4 w-4" />
  if (area === "Hospitality") return <ConciergeBell className="h-4 w-4" />
  return <ClipboardList className="h-4 w-4" />
}

export function OperationalDayPanel() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<OperationalItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    const today = todayIso()

    const [housekeepingResult, hospitalityResult, tasksResult] = await Promise.all([
      supabase
        .from("housekeeping_tasks")
        .select("id, task_type, status, priority, notes, service_date, scheduled_for")
        .in("status", OPEN_STATUSES)
        .or(`service_date.eq.${today},scheduled_for.gte.${today}T00:00:00-04:00`)
        .order("priority", { ascending: false })
        .limit(20),
      supabase
        .from("hospitality_requests")
        .select("id, request_type, status, priority, description, guest_name, due_at")
        .in("status", OPEN_STATUSES)
        .or(`due_at.gte.${today}T00:00:00-04:00,due_at.is.null`)
        .order("priority", { ascending: false })
        .limit(20),
      supabase
        .from("tasks")
        .select("id, title, status, priority, operational_area, location_name, due_date")
        .in("status", OPEN_STATUSES)
        .eq("due_date", today)
        .order("priority", { ascending: false })
        .limit(20),
    ])

    const firstError = housekeepingResult.error || hospitalityResult.error || tasksResult.error
    if (firstError) {
      setError(firstError.message)
      setItems([])
      setLoading(false)
      return
    }

    const housekeepingItems: OperationalItem[] = (housekeepingResult.data ?? []).map((item) => ({
      id: `housekeeping-${item.id}`,
      title: item.task_type?.replaceAll("_", " ") || "Tarea de housekeeping",
      subtitle: item.notes || "Preparación y limpieza operacional",
      status: item.status,
      priority: item.priority,
      area: "Housekeeping",
    }))

    const hospitalityItems: OperationalItem[] = (hospitalityResult.data ?? []).map((item) => ({
      id: `hospitality-${item.id}`,
      title: item.request_type?.replaceAll("_", " ") || "Solicitud de hospitality",
      subtitle: [item.guest_name, item.description].filter(Boolean).join(" · ") || "Solicitud operacional",
      status: item.status,
      priority: item.priority,
      area: "Hospitality",
    }))

    const taskItems: OperationalItem[] = (tasksResult.data ?? []).map((item) => ({
      id: `task-${item.id}`,
      title: item.title,
      subtitle: [item.operational_area, item.location_name].filter(Boolean).join(" · ") || "Tarea operacional",
      status: item.status,
      priority: item.priority,
      area: "Operación",
    }))

    setItems([...housekeepingItems, ...hospitalityItems, ...taskItems])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const counts = useMemo(() => ({
    housekeeping: items.filter((item) => item.area === "Housekeeping").length,
    hospitality: items.filter((item) => item.area === "Hospitality").length,
    operation: items.filter((item) => item.area === "Operación").length,
  }), [items])

  return (
    <section className="sticky bottom-0 z-40 border-t border-border bg-[var(--bs-bg-secondary)] shadow-[0_-12px_30px_rgba(0,0,0,0.2)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left md:px-6"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-primary">Operación de hoy</p>
            <p className="mt-1 text-sm text-foreground">
              {loading ? "Cargando tareas…" : error ? "No fue posible cargar las tareas" : `${items.length} acciones abiertas`}
            </p>
          </div>
          {!loading && !error && (
            <div className="hidden items-center gap-2 md:flex">
              <Badge variant="secondary">Housekeeping {counts.housekeeping}</Badge>
              <Badge variant="secondary">Hospitality {counts.hospitality}</Badge>
              <Badge variant="secondary">Operación {counts.operation}</Badge>
            </div>
          )}
        </div>
        <span className="text-muted-foreground">{open ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}</span>
      </button>

      {open && (
        <div className="max-h-[36vh] overflow-y-auto border-t border-border bg-[var(--bs-surface-primary)] px-4 py-4 md:px-6">
          {error ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void loadItems()}>Reintentar</Button>
            </div>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Cargando operación diaria…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay tareas abiertas para hoy.</p>
          ) : (
            <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article key={item.id} className="bg-[var(--bs-surface-secondary)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 text-primary">{areaIcon(item.area)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium capitalize text-foreground">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.subtitle}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">{item.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{item.area}</span>
                    <span>{item.priority ? `Prioridad ${item.priority}` : "Prioridad normal"}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
