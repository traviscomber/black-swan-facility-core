"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  parseISO,
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, RefreshCw, BedDouble, TrendingUp, DollarSign, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import type { HeatmapRow } from "@/app/api/bookings/revenue/occupancy/route"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Location {
  id: string
  name: string
}

interface TooltipState {
  day: string
  locationName: string
  totalBeds: number
  occupiedBeds: number
  blockedBeds: number
  availableBeds: number
  occupancyPct: number
  revenue: number
  avgRate: number
  x: number
  y: number
}

// ─── Color scale ──────────────────────────────────────────────────────────────

function occupancyColor(pct: number): string {
  if (pct === 0) return "hsl(142 30% 12%)"     // almost empty — very dark green
  if (pct <= 20) return "hsl(142 55% 20%)"     // low — dark green
  if (pct <= 40) return "hsl(130 45% 28%)"     // moderate-low — medium green
  if (pct <= 60) return "hsl(48  80% 35%)"     // moderate — amber
  if (pct <= 80) return "hsl(25  80% 42%)"     // high — orange
  return "hsl(0 75% 45%)"                       // full — red
}

function occupancyLabel(pct: number): string {
  if (pct === 0) return "Libre"
  if (pct <= 20) return "Baja"
  if (pct <= 40) return "Media-Baja"
  if (pct <= 60) return "Media"
  if (pct <= 80) return "Alta"
  return "Llena"
}

function formatCLP(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function KpiCards({ rows, totalBeds }: { rows: HeatmapRow[]; totalBeds: number }) {
  const kpis = useMemo(() => {
    if (!rows.length) return { occupancy: 0, revenue: 0, avgRate: 0, peakDay: "" }

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
    const totalOccupied = rows.reduce((s, r) => s + r.occupied_beds, 0)
    const totalSlots = rows.reduce((s, r) => s + r.total_beds, 0)
    const occupancy = totalSlots > 0 ? (totalOccupied / totalSlots) * 100 : 0

    // avg rate: revenue / occupied-bed-days
    const avgRate = totalOccupied > 0 ? totalRevenue / totalOccupied : 0

    // find peak day (highest total occupancy across locations)
    const byDay: Record<string, number> = {}
    rows.forEach((r) => {
      byDay[r.day] = (byDay[r.day] ?? 0) + r.occupied_beds
    })
    const peakDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""

    return { occupancy, revenue: totalRevenue, avgRate, peakDay }
  }, [rows])

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card className="border-border/50 bg-card">
        <CardContent className="flex items-start justify-between p-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Ocupacion promedio</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{kpis.occupancy.toFixed(1)}%</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{occupancyLabel(kpis.occupancy)}</p>
          </div>
          <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardContent className="flex items-start justify-between p-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Revenue del periodo</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatCLP(kpis.revenue)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">CLP</p>
          </div>
          <DollarSign className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardContent className="flex items-start justify-between p-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Tarifa promedio/noche</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatCLP(kpis.avgRate)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">por cama ocupada</p>
          </div>
          <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardContent className="flex items-start justify-between p-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Camas totales</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{totalBeds}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {kpis.peakDay ? `Pico: ${format(parseISO(kpis.peakDay), "d MMM", { locale: es })}` : "disponibles"}
            </p>
          </div>
          <BedDouble className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Heatmap cell ─────────────────────────────────────────────────────────────

function HeatmapCell({
  row,
  onHover,
  onLeave,
}: {
  row: HeatmapRow
  onHover: (state: TooltipState) => void
  onLeave: () => void
}) {
  const bg = occupancyColor(row.occupancy_pct)

  function handleMouseEnter(e: React.MouseEvent) {
    onHover({
      day: row.day,
      locationName: row.location_name,
      totalBeds: row.total_beds,
      occupiedBeds: row.occupied_beds,
      blockedBeds: row.blocked_beds,
      availableBeds: row.available_beds,
      occupancyPct: row.occupancy_pct,
      revenue: row.revenue,
      avgRate: row.avg_rate,
      x: e.clientX,
      y: e.clientY,
    })
  }

  return (
    <div
      className="relative flex cursor-default items-center justify-center rounded-sm text-[10px] font-medium text-white/90 transition-all duration-75 hover:scale-110 hover:z-10 hover:ring-1 hover:ring-white/30"
      style={{ backgroundColor: bg, minHeight: 28 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onLeave}
      aria-label={`${row.location_name} ${row.day}: ${row.occupancy_pct}% ocupacion`}
    >
      {row.occupancy_pct > 0 ? `${Math.round(row.occupancy_pct)}%` : ""}
    </div>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function HeatmapTooltip({ tip }: { tip: TooltipState }) {
  return (
    <div
      className="pointer-events-none fixed z-50 w-52 rounded-lg border border-border bg-popover p-3 text-xs shadow-xl"
      style={{ left: tip.x + 14, top: tip.y - 10 }}
    >
      <p className="mb-1.5 font-semibold text-foreground">{tip.locationName}</p>
      <p className="text-muted-foreground">{format(parseISO(tip.day), "EEEE d MMMM yyyy", { locale: es })}</p>
      <div className="mt-2 space-y-1 border-t border-border pt-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ocupacion</span>
          <span className="font-medium text-foreground">{tip.occupancyPct.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Camas</span>
          <span className="font-medium text-foreground">
            {tip.occupiedBeds} de {tip.totalBeds}
          </span>
        </div>
        {tip.blockedBeds > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bloqueadas</span>
            <span className="font-medium text-amber-400">{tip.blockedBeds}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Revenue</span>
          <span className="font-medium text-foreground">{formatCLP(tip.revenue)}</span>
        </div>
        {tip.avgRate > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tarifa avg</span>
            <span className="font-medium text-foreground">{formatCLP(tip.avgRate)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function HeatmapLegend() {
  const steps = [
    { pct: 0, label: "0%" },
    { pct: 20, label: "20%" },
    { pct: 40, label: "40%" },
    { pct: 60, label: "60%" },
    { pct: 80, label: "80%" },
    { pct: 100, label: "100%" },
  ]
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Ocupacion:</span>
      <div className="flex items-center gap-1">
        {steps.map((s) => (
          <div key={s.pct} className="flex flex-col items-center gap-0.5">
            <div
              className="h-3 w-6 rounded-sm"
              style={{ backgroundColor: occupancyColor(s.pct) }}
              aria-label={`${s.label}`}
            />
            <span className="text-[9px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface OccupancyHeatmapProps {
  locations: Location[]
}

export function OccupancyHeatmap({ locations }: OccupancyHeatmapProps) {
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [rows, setRows] = useState<HeatmapRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const startDate = viewMonth
  const endDate = endOfMonth(viewMonth)
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  // Fetch from API
  const fetchHeatmap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        start: format(startDate, "yyyy-MM-dd"),
        end: format(endDate, "yyyy-MM-dd"),
      })
      if (selectedLocation !== "all") params.set("location_id", selectedLocation)

      const res = await fetch(`/api/bookings/revenue/occupancy?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      setRows(json.rows ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [viewMonth, selectedLocation]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchHeatmap()
  }, [fetchHeatmap])

  // Build lookup: rowMap[locationId][dateString] = HeatmapRow
  const rowMap = useMemo(() => {
    const map: Record<string, Record<string, HeatmapRow>> = {}
    rows.forEach((r) => {
      if (!map[r.location_id]) map[r.location_id] = {}
      map[r.location_id][r.day] = r
    })
    return map
  }, [rows])

  // Locations that have any data (rows) — filter out locations with 0 beds
  const activeLocations = useMemo(() => {
    const seen = new Set(rows.map((r) => r.location_id))
    return locations.filter((l) => seen.has(l.id))
  }, [rows, locations])

  // Total beds (max across any day, per location sum)
  const totalBeds = useMemo(() => {
    const byLoc: Record<string, number> = {}
    rows.forEach((r) => {
      byLoc[r.location_id] = Math.max(byLoc[r.location_id] ?? 0, r.total_beds)
    })
    return Object.values(byLoc).reduce((s, n) => s + n, 0)
  }, [rows])

  // Revenue totals per day for totals row
  const revByDay = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach((r) => {
      map[r.day] = (map[r.day] ?? 0) + r.revenue
    })
    return map
  }, [rows])

  function handleCellHover(state: TooltipState) {
    setTooltip(state)
  }
  function handleCellLeave() {
    setTooltip(null)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium capitalize">
            {format(viewMonth, "MMMM yyyy", { locale: es })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchHeatmap}
            disabled={loading}
            aria-label="Actualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <HeatmapLegend />
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ubicaciones</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <KpiCards rows={rows} totalBeds={totalBeds} />

      {/* Grid */}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Error cargando datos: {error}
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : activeLocations.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No hay camas configuradas para este periodo
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <div className="min-w-max">
            {/* Header row — dates */}
            <div
              className="grid border-b border-border bg-muted/30"
              style={{ gridTemplateColumns: `140px repeat(${days.length}, minmax(32px, 1fr))` }}
            >
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Ubicacion</div>
              {days.map((d) => (
                <div
                  key={d.toISOString()}
                  className={`px-0.5 py-2 text-center text-[10px] font-medium ${
                    isToday(d) ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <div>{format(d, "d")}</div>
                  <div className="text-[9px] opacity-60">{format(d, "EEE", { locale: es }).substring(0, 2)}</div>
                </div>
              ))}
            </div>

            {/* Location rows */}
            {activeLocations.map((loc) => (
              <div
                key={loc.id}
                className="grid border-b border-border/50 last:border-b-0 hover:bg-muted/10"
                style={{ gridTemplateColumns: `140px repeat(${days.length}, minmax(32px, 1fr))` }}
              >
                <div className="flex items-center px-3 py-1.5">
                  <span className="truncate text-xs font-medium text-foreground">{loc.name}</span>
                </div>
                {days.map((d) => {
                  const dayStr = format(d, "yyyy-MM-dd")
                  const cell = rowMap[loc.id]?.[dayStr]
                  if (!cell) {
                    return (
                      <div
                        key={dayStr}
                        className="m-0.5 rounded-sm bg-muted/20"
                        style={{ minHeight: 28 }}
                      />
                    )
                  }
                  return (
                    <div key={dayStr} className="m-0.5">
                      <HeatmapCell
                        row={cell}
                        onHover={handleCellHover}
                        onLeave={handleCellLeave}
                      />
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Totals row — revenue per day */}
            <div
              className="grid border-t border-border bg-muted/20"
              style={{ gridTemplateColumns: `140px repeat(${days.length}, minmax(32px, 1fr))` }}
            >
              <div className="flex items-center px-3 py-2 text-xs font-medium text-muted-foreground">
                Revenue/dia
              </div>
              {days.map((d) => {
                const dayStr = format(d, "yyyy-MM-dd")
                const rev = revByDay[dayStr] ?? 0
                return (
                  <div
                    key={dayStr}
                    className="flex items-center justify-center px-0.5 py-2 text-center text-[9px] font-medium text-muted-foreground"
                  >
                    {rev > 0 ? formatCLP(rev) : ""}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && <HeatmapTooltip tip={tooltip} />}
    </div>
  )
}
