"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarClock, CircleDollarSign, ConciergeBell, History, RefreshCw, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type ReservationOption = {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  room: { room_number: string; location: { name: string } | null } | null
}

type TimelineEvent = {
  id: string
  occurredAt: string
  category: "reservation" | "arrival" | "housekeeping" | "hospitality" | "service" | "finance" | "issue"
  title: string
  description: string | null
  status: string | null
  source: string
}

type TimelinePayload = { reservation: ReservationOption; events: TimelineEvent[]; count: number }

const CATEGORY_LABELS: Record<TimelineEvent["category"], string> = {
  reservation: "Reserva",
  arrival: "Llegada y salida",
  housekeeping: "Housekeeping",
  hospitality: "Hospitality",
  service: "Servicio",
  finance: "Finanzas",
  issue: "Incidencia",
}

function CategoryIcon({ category }: { category: TimelineEvent["category"] }) {
  if (category === "housekeeping") return <Sparkles className="h-4 w-4" />
  if (category === "hospitality") return <ConciergeBell className="h-4 w-4" />
  if (category === "finance") return <CircleDollarSign className="h-4 w-4" />
  if (category === "issue") return <AlertTriangle className="h-4 w-4" />
  return <CalendarClock className="h-4 w-4" />
}

export function BookingStayTimeline() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [reservations, setReservations] = useState<ReservationOption[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [payload, setPayload] = useState<TimelinePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  const loadReservations = useCallback(async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select("id, guest_name, check_in, check_out, status, room:rooms(room_number, location:locations(name))")
      .order("check_in", { ascending: false })
      .limit(100)
    if (error) toast.error(error.message)
    else setReservations((data ?? []) as unknown as ReservationOption[])
  }, [supabase])

  const loadTimeline = useCallback(async (reservationId: string) => {
    if (!reservationId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/bookings/${reservationId}/timeline`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "No fue posible cargar el historial")
      setPayload(data as TimelinePayload)
    } catch (error) {
      setPayload(null)
      toast.error(error instanceof Error ? error.message : "No fue posible cargar el historial")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (open) void loadReservations() }, [loadReservations, open])
  useEffect(() => { if (selectedId) void loadTimeline(selectedId) }, [loadTimeline, selectedId])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return reservations
    return reservations.filter((reservation) => `${reservation.guest_name} ${reservation.room?.room_number ?? ""} ${reservation.room?.location?.name ?? ""}`.toLowerCase().includes(term))
  }, [reservations, search])

  return (
    <>
      <Button type="button" variant="outline" className="fixed bottom-5 left-5 z-40 gap-2 shadow-lg" onClick={() => setOpen(true)}>
        <History className="h-4 w-4" />Historial de estadía
      </Button>
      {open && (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Cerrar historial" />
          <aside className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-5">
              <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">A4 · Pipeline canónico</p><h2 className="mt-1 text-xl font-semibold">Historial cronológico de la estadía</h2><p className="mt-1 text-sm text-muted-foreground">Reserva, llegada, Housekeeping, Hospitality, servicios, finanzas e incidencias en una sola secuencia.</p></div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_1fr_auto]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar huésped, propiedad o habitación" />
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
                <option value="">Seleccionar reserva</option>
                {filtered.map((reservation) => <option key={reservation.id} value={reservation.id}>{reservation.guest_name} · {reservation.room?.room_number ?? "Sin habitación"} · {reservation.check_in}</option>)}
              </select>
              <Button variant="outline" size="icon" onClick={() => selectedId && void loadTimeline(selectedId)} disabled={!selectedId || loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {!selectedId ? <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Selecciona una reserva para revisar su historia completa.</div> : loading && !payload ? <div className="p-8 text-center text-sm text-muted-foreground">Cargando historial…</div> : payload ? (
                <div className="space-y-5">
                  <div className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{payload.reservation.guest_name}</p><p className="mt-1 text-sm text-muted-foreground">{payload.reservation.check_in} → {payload.reservation.check_out}</p></div><div className="flex gap-2"><Badge variant="outline">{payload.reservation.status}</Badge><Badge variant="secondary">{payload.count} eventos</Badge></div></div></div>
                  {payload.events.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Esta reserva todavía no tiene eventos registrados.</div> : <div className="relative ml-3 border-l pl-6">{payload.events.map((item) => <div key={item.id} className="relative pb-6"><span className="absolute -left-[33px] top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-primary"><CategoryIcon category={item.category} /></span><div className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleString("es-CL")} · {CATEGORY_LABELS[item.category]}</p></div>{item.status && <Badge variant="outline">{item.status}</Badge>}</div>{item.description && <p className="mt-3 text-sm leading-6">{item.description}</p>}<p className="mt-2 text-[11px] text-muted-foreground">Fuente: {item.source}</p></div></div>)}</div>}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
