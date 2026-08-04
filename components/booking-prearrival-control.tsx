"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Sparkles, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Arrival = {
  id: string
  guest_name: string
  check_in: string
  estimated_arrival_time: string | null
  room: { room_number: string; operational_status: string; location: { name: string } | null } | null
  housekeeping_tasks: Array<{ id: string; task_type: string; status: string; scheduled_for: string | null; due_at: string | null }>
}

const TASK_LABELS: Record<string, string> = {
  pre_arrival_preparation: "Preparación",
  pre_arrival_inspection: "Inspección",
}

export function BookingPrearrivalControl() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [arrivals, setArrivals] = useState<Arrival[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const today = new Date()
    const end = new Date(today)
    end.setDate(end.getDate() + 7)
    const { data } = await supabase
      .from("reservations")
      .select("id, guest_name, check_in, estimated_arrival_time, room:rooms(room_number, operational_status, location:locations(name)), housekeeping_tasks(id, task_type, status, scheduled_for, due_at)")
      .eq("status", "confirmed")
      .gte("check_in", today.toISOString().slice(0, 10))
      .lte("check_in", end.toISOString().slice(0, 10))
      .order("check_in")
    setArrivals((data ?? []) as unknown as Arrival[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { if (open) void load() }, [load, open])

  const overdue = useMemo(() => arrivals.reduce((count, arrival) => count + arrival.housekeeping_tasks.filter((task) => task.due_at && new Date(task.due_at) < new Date() && !["completed", "cancelled"].includes(task.status)).length, 0), [arrivals])

  return <>
    <Button type="button" variant="outline" className="fixed bottom-5 right-48 z-40 gap-2 shadow-lg" onClick={() => setOpen(true)}>
      <Sparkles className="h-4 w-4" /> Preparación de llegadas
      {overdue > 0 && <Badge variant="destructive">{overdue}</Badge>}
    </Button>
    {open && <div className="fixed inset-0 z-[70] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Cerrar preparación de llegadas" />
      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l bg-background shadow-2xl">
        <div className="flex items-start justify-between border-b p-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Pre-arrival</p><h2 className="mt-1 text-xl font-semibold">Preparación de llegadas</h2><p className="mt-1 text-sm text-muted-foreground">La habitación debe quedar preparada e inspeccionada antes de la llegada estimada.</p></div>
          <div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button><Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {arrivals.length === 0 ? <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No hay llegadas confirmadas durante los próximos siete días.</div> : arrivals.map((arrival) => {
            const tasks = arrival.housekeeping_tasks.filter((task) => task.task_type in TASK_LABELS)
            const ready = ["ready", "inspected"].includes(arrival.room?.operational_status ?? "")
            return <div key={arrival.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{arrival.guest_name}</p><p className="mt-1 text-xs text-muted-foreground">{arrival.room?.location?.name ?? "Sin propiedad"} · {arrival.room?.room_number ?? "Sin habitación"} · {arrival.check_in} {arrival.estimated_arrival_time?.slice(0,5) ?? "15:00"}</p></div><Badge variant={ready ? "default" : "outline"}>{ready ? "Habitación lista" : "Preparación pendiente"}</Badge></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{tasks.map((task) => { const isOverdue = Boolean(task.due_at && new Date(task.due_at) < new Date() && !["completed", "cancelled"].includes(task.status)); return <div key={task.id} className="rounded-md border p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{TASK_LABELS[task.task_type] ?? task.task_type}</p>{isOverdue ? <AlertTriangle className="h-4 w-4 text-destructive" /> : task.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock3 className="h-4 w-4 text-muted-foreground" />}</div><p className="mt-1 text-xs text-muted-foreground">Estado: {task.status}</p>{task.due_at && <p className="mt-1 text-xs text-muted-foreground">Límite: {new Date(task.due_at).toLocaleString("es-CL")}</p>}</div> })}</div>
            </div>
          })}
        </div>
      </aside>
    </div>}
  </>
}
