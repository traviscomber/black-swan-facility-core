"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { ArrowLeft, CalendarCheck, Clock3, LogIn, LogOut, RefreshCw, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Reservation {
  id: string
  guest_name: string
  guest_email?: string | null
  guest_phone?: string | null
  check_in: string
  check_out: string
  status: string
  total_amount?: number | null
  num_guests?: number | null
  bed?: {
    bed_number: string
    room?: {
      room_number: string
      location?: { name: string }
    }
  }
}

type ActivityType = "arrivals" | "departures" | "active" | "pending"

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  checked_in: "Check-in",
  "checked-in": "Check-in",
  checked_out: "Check-out",
  "checked-out": "Check-out",
  cancelled: "Cancelada",
}

export default function BookingActivitiesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [type, setType] = useState<ActivityType>("arrivals")
  const today = startOfDay(new Date())

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const from = format(addDays(today, -1), "yyyy-MM-dd")
    const to = format(addDays(today, 7), "yyyy-MM-dd")
    const { data, error: loadError } = await supabase
      .from("reservations")
      .select(`
        id, guest_name, guest_email, guest_phone, check_in, check_out, status,
        total_amount, num_guests,
        bed:beds(bed_number, room:rooms(room_number, location:locations(name)))
      `)
      .lte("check_in", to)
      .gte("check_out", from)
      .order("check_in")

    if (loadError) {
      setError(loadError.message)
      setReservations([])
    } else {
      setReservations((data ?? []) as unknown as Reservation[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel("booking-activities")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const buckets = useMemo(() => {
    const activeStatuses = new Set(["confirmed", "checked_in", "checked-in"])
    return {
      arrivals: reservations.filter((r) => isSameDay(parseISO(r.check_in), today) && r.status !== "cancelled"),
      departures: reservations.filter((r) => isSameDay(parseISO(r.check_out), today) && r.status !== "cancelled"),
      active: reservations.filter((r) => parseISO(r.check_in) <= today && parseISO(r.check_out) > today && activeStatuses.has(r.status)),
      pending: reservations.filter((r) => r.status === "pending"),
    }
  }, [reservations, today])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return buckets[type].filter((r) => {
      if (!term) return true
      const room = r.bed?.room?.room_number ?? ""
      const property = r.bed?.room?.location?.name ?? ""
      return [r.guest_name, r.guest_email ?? "", r.guest_phone ?? "", room, property]
        .some((value) => value.toLowerCase().includes(term))
    })
  }, [buckets, search, type])

  async function updateStatus(id: string, status: string) {
    const { error: updateError } = await supabase.from("reservations").update({ status }).eq("id", id)
    if (updateError) setError(updateError.message)
    else await loadData()
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Centro de actividades</h1>
            <p className="text-sm text-muted-foreground">Llegadas, salidas, estancias y reservas pendientes.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/bookings"><ArrowLeft className="mr-2 h-4 w-4" />Calendario</Link></Button>
            <Button variant="outline" onClick={loadData}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Llegadas hoy" value={buckets.arrivals.length} icon={<LogIn className="h-4 w-4" />} onClick={() => setType("arrivals")} active={type === "arrivals"} />
          <Metric title="Salidas hoy" value={buckets.departures.length} icon={<LogOut className="h-4 w-4" />} onClick={() => setType("departures")} active={type === "departures"} />
          <Metric title="Estancias activas" value={buckets.active.length} icon={<CalendarCheck className="h-4 w-4" />} onClick={() => setType("active")} active={type === "active"} />
          <Metric title="Pendientes" value={buckets.pending.length} icon={<Clock3 className="h-4 w-4" />} onClick={() => setType("pending")} active={type === "pending"} />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar huésped, habitación o propiedad" />
            </div>
            <Select value={type} onValueChange={(value) => setType(value as ActivityType)}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="arrivals">Llegadas de hoy</SelectItem>
                <SelectItem value="departures">Salidas de hoy</SelectItem>
                <SelectItem value="active">Estancias activas</SelectItem>
                <SelectItem value="pending">Reservas pendientes</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}

        <Card>
          <CardHeader><CardTitle className="text-base">{visible.length} actividades</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="py-10 text-center text-muted-foreground">Cargando...</p> : visible.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No hay actividades para esta vista.</p>
            ) : visible.map((reservation) => (
              <div key={reservation.id} className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{reservation.guest_name}</p>
                    <Badge variant="outline">{STATUS_LABELS[reservation.status] ?? reservation.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {reservation.bed?.room?.location?.name ?? "Sin propiedad"} · Hab. {reservation.bed?.room?.room_number ?? "—"} · {reservation.bed?.bed_number ?? "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">{reservation.check_in} → {reservation.check_out} · {reservation.num_guests ?? 1} huésped(es)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(reservation.status === "confirmed" || reservation.status === "pending") && (
                    <Button size="sm" onClick={() => updateStatus(reservation.id, "checked_in")}><LogIn className="mr-2 h-4 w-4" />Check-in</Button>
                  )}
                  {(reservation.status === "checked_in" || reservation.status === "checked-in") && (
                    <Button size="sm" onClick={() => updateStatus(reservation.id, "checked_out")}><LogOut className="mr-2 h-4 w-4" />Check-out</Button>
                  )}
                  {reservation.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(reservation.id, "confirmed")}>Confirmar</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({ title, value, icon, active, onClick }: { title: string; value: number; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className={active ? "border-primary ring-1 ring-primary" : ""}>
        <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader>
        <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
      </Card>
    </button>
  )
}
