"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle, ArrowRight, BedDouble, CalendarDays, CheckCircle2, ClipboardCheck, ConciergeBell, PackageCheck, RefreshCw, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type CalendarItem = {
  type: string
  id: string
  startsAt: string
  endsAt: string | null
  title: string
  subtitle: string | null
  department: string
  locationId: string | null
  reservationId: string | null
  status: string | null
  readiness: string
  href: string
  metadata: Record<string, unknown>
}

type OperationalCalendarProps = {
  days?: number
  compact?: boolean
  title?: string
}

const typeLabels: Record<string, string> = {
  arrival: "Llegada",
  departure: "Salida",
  housekeeping: "Housekeeping",
  hospitality: "Hospitalidad",
  maintenance: "Mantenimiento",
  procurement: "Compras",
  activity: "Actividad",
  service: "Servicio",
}

const typeIcons: Record<string, typeof CalendarDays> = {
  arrival: BedDouble,
  departure: BedDouble,
  housekeeping: ClipboardCheck,
  hospitality: ConciergeBell,
  maintenance: Wrench,
  procurement: PackageCheck,
  activity: CalendarDays,
  service: CheckCircle2,
}

const readinessLabels: Record<string, string> = {
  ready: "Lista para ejecutar",
  needs_owner: "Falta responsable",
  pending_confirmation: "Pendiente de confirmar",
  estimated: "Fecha estimada",
  blocking: "Bloquea operación",
  needs_review: "Requiere revisión",
  draft: "Borrador",
}

function readinessVariant(readiness: string): "default" | "secondary" | "outline" | "destructive" {
  if (readiness === "blocking") return "destructive"
  if (readiness === "ready") return "default"
  if (["needs_owner", "needs_review", "pending_confirmation"].includes(readiness)) return "secondary"
  return "outline"
}

export function OperationalCalendar({ days = 14, compact = false, title = "Próximas acciones" }: OperationalCalendarProps) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const startDate = useMemo(() => startOfDay(new Date()), [])
  const endDate = useMemo(() => addDays(startDate, days), [days, startDate])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc("get_operational_calendar", {
      p_start_date: format(startDate, "yyyy-MM-dd"),
      p_end_date: format(endDate, "yyyy-MM-dd"),
    })
    if (rpcError) {
      setError(rpcError.message)
      setItems([])
    } else {
      setError(null)
      setItems(Array.isArray(data) ? (data as CalendarItem[]) : [])
    }
    setLoading(false)
  }, [endDate, startDate, supabase])

  useEffect(() => { void load() }, [load])

  const grouped = useMemo(() => {
    const groups = new Map<string, CalendarItem[]>()
    items.forEach((item) => {
      const key = format(parseISO(item.startsAt), "yyyy-MM-dd")
      groups.set(key, [...(groups.get(key) ?? []), item])
    })
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  const readyCount = items.filter((item) => item.readiness === "ready").length
  const attentionCount = items.length - readyCount
  const visibleGroups = compact ? grouped.slice(0, 5) : grouped

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Calendario operacional</p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Desde hoy hasta {format(endDate, "d 'de' MMMM", { locale: es })}. Reservas y trabajo asociado en una sola secuencia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && <><Badge variant="outline">{readyCount} listas</Badge><Badge variant={attentionCount > 0 ? "secondary" : "outline"}>{attentionCount} requieren atención</Badge></>}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar
          </Button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />No se pudo cargar el calendario operacional: {error}</div>}

      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando próximas acciones…</p> : visibleGroups.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No hay acciones programadas dentro de este período.</p>
      ) : (
        <div className="divide-y border-y">
          {visibleGroups.map(([date, dateItems]) => {
            const parsedDate = parseISO(date)
            const today = isSameDay(parsedDate, new Date())
            return (
              <div key={date} className="grid gap-3 py-4 lg:grid-cols-[150px_1fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{today ? "Hoy" : format(parsedDate, "EEEE", { locale: es })}</p>
                  <p className="mt-1 text-sm font-medium">{format(parsedDate, "d MMM yyyy", { locale: es })}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{dateItems.length} acciones</p>
                </div>
                <div className="space-y-2">
                  {dateItems.map((item) => {
                    const Icon = typeIcons[item.type] ?? CalendarDays
                    return (
                      <Link key={`${item.type}-${item.id}-${item.startsAt}`} href={item.href} className="group grid gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-muted/40 sm:grid-cols-[34px_1fr_auto] sm:items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted"><Icon className="h-4 w-4 text-primary" /></div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{typeLabels[item.type] ?? item.type}</Badge>
                            <p className="truncate text-sm font-medium">{item.title}</p>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {format(parseISO(item.startsAt), "HH:mm")}{item.subtitle ? ` · ${item.subtitle}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={readinessVariant(item.readiness)}>{readinessLabels[item.readiness] ?? item.readiness}</Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {compact && grouped.length > visibleGroups.length && (
        <Button asChild variant="outline" className="w-full"><Link href="/bookings">Ver calendario operacional completo <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      )}
    </section>
  )
}
