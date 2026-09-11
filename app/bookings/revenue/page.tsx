"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, parseISO } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { Loader2, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/lib/hooks/use-language"
import { revenueTranslations } from "@/lib/translations/revenue"
import { formatClp } from "@/lib/money"

interface LocationOption { id: string; name: string }
interface OccupancyDay { day: string; location_id: string; location_name: string; total_beds: number; occupied_beds: number; blocked_beds: number; available_beds: number; occupancy_pct: number; revenue: number; avg_rate: number }

const DATE_LOCALES = { en: enUS, es, de } as const
const NUMBER_LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const

function occupancyTone(value: number) {
  if (value >= 85) return "bg-[#4a2420] text-[#f0c7bd]"
  if (value >= 65) return "bg-[#4b3c23] text-[#e8cf9c]"
  if (value >= 40) return "bg-[#263844] text-[#bfd2dd]"
  return "text-[#8f867b]"
}
function interpolate(value: string, vars: Record<string, string | number>) { return Object.entries(vars).reduce((result, [key, replacement]) => result.replaceAll(`{${key}}`, String(replacement)), value) }

export default function RevenueIntelligencePage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = revenueTranslations[language]
  const dateLocale = DATE_LOCALES[language]
  const numberLocale = NUMBER_LOCALES[language]
  const today = useMemo(() => new Date(), [])
  const [startDate, setStartDate] = useState(format(today, "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(addDays(today, 30), "yyyy-MM-dd"))
  const [locationId, setLocationId] = useState("all")
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [rows, setRows] = useState<OccupancyDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    const [locationsResult, heatmapResult] = await Promise.all([
      supabase.from("locations").select("id, name, rooms!inner(id, beds!inner(id, is_available))").eq("rooms.beds.is_available", true).order("name"),
      supabase.rpc("get_occupancy_heatmap", { p_start_date: startDate, p_end_date: endDate, p_location_id: locationId === "all" ? null : locationId }),
    ])
    const firstError = locationsResult.error || heatmapResult.error
    if (firstError) { setError(copy.loadFailed ?? copy.error ?? "Unable to load revenue intelligence"); setRows([]) }
    else {
      setLocations(Array.from(new Map((locationsResult.data ?? []).map((location) => [location.id, { id: location.id, name: location.name }])).values()))
      setRows((heatmapResult.data ?? []) as OccupancyDay[])
    }
    setLoading(false)
  }, [copy, endDate, locationId, startDate, supabase])

  useEffect(() => { void loadData() }, [loadData])

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
    rows.forEach((row) => { const bucket = map.get(row.location_name); if (bucket) bucket.push(row); else map.set(row.location_name, [row]) })
    return Array.from(map.entries())
  }, [rows])
  const money = useCallback((value: number) => formatClp(value, numberLocale), [numberLocale])

  return <div className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 bg-[#211e1a] px-4 py-2">
      <div><h1 className="text-base font-normal">{copy.title}</h1><p className="text-xs text-[#b9b0a4]">{copy.subtitle}</p></div>
      <Button size="sm" variant="outline" className="h-8 rounded-none border-0 bg-[#2b2722] text-[#e7e1d8] hover:bg-[#39342d]" onClick={() => void loadData()} disabled={loading}>{loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}{copy.refresh}</Button>
    </header>

    <div className="bg-[#211e1a] px-3 py-2">
      <div className="grid gap-2 md:grid-cols-[150px_150px_220px_auto]">
        <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-8 rounded-none border-0 bg-[#2b2722] text-[#e7e1d8]" aria-label={copy.from} />
        <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-8 rounded-none border-0 bg-[#2b2722] text-[#e7e1d8]" aria-label={copy.to} />
        <Select value={locationId} onValueChange={setLocationId}><SelectTrigger className="h-8 rounded-none border-0 bg-[#2b2722] text-[#e7e1d8]"><SelectValue placeholder={copy.allLocations} /></SelectTrigger><SelectContent><SelectItem value="all">{copy.allLocations}</SelectItem>{locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select>
        <div className="flex justify-end"><Button size="sm" className="h-8 rounded-none bg-[#d7ccb9] text-[#171512] hover:bg-[#e7e1d8]" onClick={() => void loadData()} disabled={loading}>{copy.apply}</Button></div>
      </div>
    </div>

    {error && <div className="bg-[#4a2420] px-4 py-2 text-xs text-[#f0c7bd]">{error}</div>}

    <div className="grid bg-[#211e1a] sm:grid-cols-2 lg:grid-cols-5">
      <Metric label={copy.occupancy} value={`${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(summary.occupancy)}%`} detail={interpolate(copy.occupancyDetail, { occupied: summary.occupiedNights, total: summary.bedNights })} />
      <Metric label={copy.revenue} value={money(summary.revenue)} detail={copy.revenueDetail} />
      <Metric label={copy.availability} value={String(summary.availableNights)} detail={copy.availabilityDetail} />
      <Metric label={copy.blocks} value={String(summary.blockedNights)} detail={copy.blocksDetail} />
      <Metric label={copy.avgRate} value={money(summary.averageRate)} detail={copy.avgRateDetail} />
    </div>

    <div className="p-3">
      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#b9b0a4]" /></div> : groupedRows.length === 0 ? <div className="bg-[#211e1a] px-4 py-12 text-center text-sm text-[#8f867b]">{copy.empty}</div> : <div className="space-y-3">{groupedRows.map(([locationName, locationRows]) => <section key={locationName} className="bg-[#211e1a]">
        <div className="flex items-center justify-between px-3 py-2"><h2 className="text-sm font-normal">{locationName}</h2><span className="text-[11px] text-[#8f867b]">{interpolate(copy.activeBeds, { count: locationRows[0]?.total_beds ?? 0 })}</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-xs"><thead className="bg-[#2b2722] text-left text-[#8f867b]"><tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">{copy.occupancy}</th><th className="px-3 py-2 font-medium">Occupied</th><th className="px-3 py-2 font-medium">Available</th><th className="px-3 py-2 font-medium">{copy.blocks}</th><th className="px-3 py-2 font-medium">{copy.revenue}</th><th className="px-3 py-2 font-medium">{copy.avgRate}</th></tr></thead><tbody>{locationRows.map((row) => <tr key={`${row.location_id}-${row.day}`} className="bg-[#171512] hover:bg-[#211e1a]"><td className="px-3 py-2">{format(parseISO(row.day), "dd MMM yyyy", { locale: dateLocale })}</td><td className={`px-3 py-2 font-medium ${occupancyTone(Number(row.occupancy_pct))}`}>{Number(row.occupancy_pct).toFixed(0)}%</td><td className="px-3 py-2">{row.occupied_beds}/{row.total_beds}</td><td className="px-3 py-2">{row.available_beds}</td><td className="px-3 py-2">{row.blocked_beds}</td><td className="px-3 py-2">{money(Number(row.revenue || 0))}</td><td className="px-3 py-2">{money(Number(row.avg_rate || 0))}</td></tr>)}</tbody></table></div>
      </section>)}</div>}
    </div>
  </div>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-h-[76px] px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-[#8f867b]">{label}</div><div className="mt-1 text-lg font-normal">{value}</div><div className="mt-0.5 truncate text-[10px] text-[#8f867b]">{detail}</div></div>
}
