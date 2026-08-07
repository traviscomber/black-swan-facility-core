"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, ClipboardList, ConciergeBell, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type DailyItem = {
  id: string
  category: "housekeeping" | "hospitality" | "operations"
  title: string
  status: string
  priority: string | null
  context: string | null
}

const CATEGORY_LABELS: Record<DailyItem["category"], string> = {
  housekeeping: "Housekeeping",
  hospitality: "Hospitality",
  operations: "Operación",
}

function chileOperatingDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

export function DailyOperationsPanel() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<DailyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)

    const today = chileOperatingDate()
    const [year, month, day] = today.split("-").map(Number)
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1))
    const nextDay = nextDate.toISOString().slice(0, 10)
    const chileOffset = "-04:00"
    const hospitalityStart = `${today}T00:00:00${chileOffset}`
    const hospitalityEnd = `${nextDay}T00:00:00${chileOffset}`

    const [housekeepingResult, hospitalityResult, tasksResult] = await Promise.all([
      supabase
        .from("housekeeping_tasks")
        .select("id, task_type, status, priority, notes, service_date")
        .not("status", "in", "(completed,cancelled)")
        .eq("service_date", today)
        .limit(20),
      supabase
        .from("hospitality_requests")
        .select("id, request_type, status, priority, description, guest_name, due_at")
        .not("status", "in", "(completed,resolved,cancelled)")
        .gte("due_at", hospitalityStart)
        .lt("due_at", hospitalityEnd)
        .limit(20),
      supabase
        .from("tasks")
        .select("id, title, status, priority, location_name, due_date")
        .not("status", "in", "(completed,cancelled)")
        .eq("due_date", today)
        .limit(20),
    ])

    const firstError = housekeepingResult.error || hospitalityResult.error || tasksResult.error
    if (firstError) {
      setError(firstError.message)
      setItems([])
      setLoading(false)
      return
    }

    const nextItems: DailyItem[] = [
      ...(housekeepingResult.data ?? []).map((item) => ({
        id: item.id,
        category: "housekeeping" as const,
        title: item.task_type || "Tarea de housekeeping",
        status: item.status,
        priority: item.priority,
        context: item.notes,
      })),
      ...(hospitalityResult.data ?? []).map((item) => ({
        id: item.id,
        category: "hospitality" as const,
        title: item.request_type || "Solicitud de hospitality",
        status: item.status,
        priority: item.priority,
        context: item.guest_name || item.description,
      })),
      ...(tasksResult.data ?? []).map((item) => ({
        id: item.id,
        category: "operations" as const,
        title: item.title || "Tarea operacional",
        status: item.status,
        priority: item.priority,
        context: item.location_name,
      })),
    ]

    setItems(nextItems)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const counts = useMemo(
    () => ({
      housekeeping: items.filter((item) => item.category === "housekeeping").length,
      hospitality: items.filter((item) => item.category === "hospitality").length,
      operations: items.filter((item) => item.category === "operations").length,
    }),
    [items],
  )

  return (
    <section className="sticky bottom-0 z-40 border-t border-border/40 bg-[var(--bs-bg-secondary)]">
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Operación del día</p>
            <p className="text-xs text-muted-foreground">{items.length} acciones programadas para hoy</p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />{counts.housekeeping}</Badge>
            <Badge variant="secondary" className="gap-1"><ConciergeBell className="h-3 w-3" />{counts.hospitality}</Badge>
            <Badge variant="secondary">{counts.operations} operación</Badge>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          {open ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronUp className="mr-2 h-4 w-4" />}
          {open ? "Ocultar" : "Ver tareas"}
        </Button>
      </div>

      {open && (
        <div className="max-h-72 overflow-y-auto border-t border-border/30 px-4 py-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando operación diaria…</p>
          ) : error ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-destructive">No fue posible cargar las tareas: {error}</p>
              <Button size="sm" variant="outline" onClick={() => void loadItems()}>Reintentar</Button>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay acciones programadas para hoy.</p>
          ) : (
            <div className="grid gap-1 lg:grid-cols-3">
              {items.map((item) => (
                <article key={`${item.category}-${item.id}`} className="bg-[var(--bs-surface-primary)] px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{CATEGORY_LABELS[item.category]}{item.context ? ` · ${item.context}` : ""}</p>
                    </div>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  {item.priority && <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Prioridad {item.priority}</p>}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
