"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, parseISO } from "date-fns"
import { ArrowLeft, BedDouble, CalendarDays, CircleDollarSign, Loader2, RefreshCw, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface LocationOption {
  id: string
  name: string
}

interface OccupancyDay {
  day: string
  location_id: string
  location_name: string
  total_beds: number
  occupied_beds: number
  blocked_beds: number
  available_beds: number
  occupancy_pct: number
  revenue: number
  avg_rate: number
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value)
}

function occupancyTone(value: number) {
  if (value >= 85) return "border-red-500/40 bg-red-500/15 text-red-200"
  if (value >= 65) return "border-amber-500/40 bg-amber-500/15 text-amber-200"
  if (value >= 40) return "border-sky-500/40 bg-sky-500/15 text-sky-200"
  return "border-slate-500/30 bg-slate-500/10 text-slate-300"
}

export default function RevenueIntelligencePage() {
  const supabase = useMemo(() => createClient(), [])
  const today = useMemo(() => new Date(), [])
  const [startDate, setStartDate] = useState(format(today, "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(addDays(today, 30), "yyyy-MM-dd"))
  const [locationId, setLocationId] = useState("all")
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [rows, setRows] = useState<OccupancyDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [locationsResult, heatmapResult] = await Promise.all([
      supabase
        .from("locations")
        .select("id, name, rooms!inner(id, beds!inner(id, is_available))")
        .eq("rooms.beds.is_available", true)
        .order("name"),
      supabase.rpc("get_occupancy_heatmap", {
        p_start_date: startDate,
        p_end_date: endDate,
        p_location_id: locationId === "all" ? null : locationId,
      }),
    ])

    const firstError = locationsResult.error || heatmapResult.error
    if (firstError) {
      setError(firstError.message)
      setRows([])
      setLoading(false)
      return
    }

    const uniqueLocations = Array.from(
      new Map(
        (locationsResult.data ?? []).map((location) => [
          location.id,
          { id: location.id, name: location.name },
        ]),
      ).values(),
    )

    setLocations(uniqueLocations)
    setRows((heatmapResult.data ?? []) as OccupancyDay[])
    setLoading(false)
  }, [endDate, locationId, startDate, supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const summary = useMemo(() => {
    const bedNights = rows.reduce((sum, row) => sum + row.total_beds, 0)
    const occupiedNights = rows.reduce((sum, row) => sum + row.occupied_beds, 0)
    const blockedNights = rows.reduce((sum, row) => sum + row.blocked_beds, 0)
    const availableNights = rows.reduce((sum, row) => sum + row.available_beds, 0)
    const revenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0)
    const occupancy = bedNights > 0 ? Math.round((occupiedNights / bedNights) * 1000) / 10 : 0
    const averageRate = occupiedNights > 0 ? Math.round(revenue / occupiedNights) : 0
    return { bedNights, occupiedNights, blockedNights, availableNights, revenue, occupancy, averageRate }
  }, [rows])

  const groupedRows = useMemo(() => {
    const map = new Map<string, OccupancyDay[]>()
    rows.forEach((row) => map.set(row.location_name, [...(map.get(row.location_name) ?? []), row]))
    return Array.from(map.entries())
  }, [rows])

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Hospitalidad · Fundo Corcovado</p>
            <h1 className="text-3xl font-semibold tracking-tight">Revenue Intelligence</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Ocupación, disponibilidad e ingresos diarios calculados por el Availability Engine. Las reservas prevalecen sobre bloqueos superpuestos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/bookings/calendar"><ArrowLeft className="mr-2 h-4 w-4" />Volver al calendario</Link>
            </Button>
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1.2fr_auto]">
            <div className="space-y-1">
              <label htmlFor="revenue-start" className="text-xs font-medium text-muted-foreground">Desde</label>
              <Input id="revenue-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="revenue-end" className="text-xs font-medium text-muted-foreground">Hasta</label>
              <Input id="revenue-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Ubicación</label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Todas las ubicaciones" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ubicaciones</SelectItem>
                  {locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => void loadData()} disabled={loading}>Aplicar</Button>
            </div>
          </CardContent>
        </Card>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" />Ocupación confirmada</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{summary.occupancy}%</div><p className="mt-1 text-xs text-muted-foreground">{summary.occupiedNights} de {summary.bedNights} noches-cama</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><CircleDollarSign className="h-4 w-4" />Ingresos registrados</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{formatClp(summary.revenue)}</div><p className="mt-1 text-xs text-muted-foreground">Monto distribuido por noches reservadas</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><BedDouble className="h-4 w-4" />Disponibilidad</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{summary.availableNights}</div><p className="mt-1 text-xs text-muted-foreground">noches-cama disponibles</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />Bloqueos</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{summary.blockedNights}</div><p className="mt-1 text-xs text-muted-foreground">noches-cama no vendibles</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Tarifa media registrada</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{formatClp(summary.averageRate)}</div><p className="mt-1 text-xs text-muted-foreground">por noche-cama ocupada</p></CardContent></Card>
        </div>

        {loading ? (
          <Card><CardContent className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>
        ) : groupedRows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No hay inventario de alojamiento para el período seleccionado.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {groupedRows.map(([locationName, locationRows]) => (
              <Card key={locationName}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-col gap-1 text-base sm:flex-row sm:items-center sm:justify-between">
                    <span>{locationName}</span>
                    <span className="text-xs font-normal text-muted-foreground">{locationRows[0]?.total_beds ?? 0} camas activas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-10">
                    {locationRows.map((row) => (
                      <div key={`${row.location_id}-${row.day}`} className={`rounded-md border p-2 ${occupancyTone(Number(row.occupancy_pct))}`} title={`${row.occupied_beds} ocupadas · ${row.blocked_beds} bloqueadas · ${row.available_beds} disponibles`}>
                        <div className="text-xs font-medium">{format(parseISO(row.day), "dd MMM")}</div>
                        <div className="mt-2 text-xl font-semibold">{Number(row.occupancy_pct).toFixed(0)}%</div>
                        <div className="mt-1 text-[11px] opacity-80">{row.occupied_beds}/{row.total_beds} ocupadas</div>
                        <div className="mt-2 text-[11px] opacity-80">{formatClp(Number(row.revenue || 0))}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
