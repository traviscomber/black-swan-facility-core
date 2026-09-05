"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, X } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Plan = { id: string; status: string }
type Plot = { id: string; name: string }
type Bed = { id: string; plot_id: string; name: string; planning_order: number | null }
type Cycle = { id: string; game_plan_id: string; crop_name: string }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_sow_date: string | null; planned_transplant_date: string | null; planned_first_harvest_date: string | null; planned_last_harvest_date: string | null; planned_bed_m: number | string | null }
type Allocation = { bed_id: string; crop_succession_id: string }

const PHYSICAL_BLOCK = /^(Current 0[1-5]|Expansion 0[1-3])$/
const copy = {
  en: { title: "Quick assign", help: "Pick the next pending planting, choose its starting bed, then assign.", planting: "Planting", block: "Block", bed: "Starting bed", assign: "Assign & next", assigning: "Assigning…", remaining: "remaining", complete: "Crop Map setup complete", error: "Could not assign this planting." },
  es: { title: "Asignación rápida", help: "Elige la siguiente plantación pendiente, selecciona su cama inicial y asigna.", planting: "Plantación", block: "Bloque", bed: "Cama inicial", assign: "Asignar y seguir", assigning: "Asignando…", remaining: "pendientes", complete: "Mapa de cultivos completo", error: "No fue posible asignar esta plantación." },
  de: { title: "Schnell zuordnen", help: "Nächste offene Pflanzung wählen, Startbeet auswählen und zuordnen.", planting: "Pflanzung", block: "Block", bed: "Startbeet", assign: "Zuordnen & weiter", assigning: "Wird zugeordnet…", remaining: "offen", complete: "Anbaukarte vollständig", error: "Pflanzung konnte nicht zugeordnet werden." },
} as const

export default function CropMapOverviewLayout({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang: Locale = language
  const text = copy[lang]
  const [plans, setPlans] = useState<Plan[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [selectedSuccessionId, setSelectedSuccessionId] = useState("")
  const [selectedPlotId, setSelectedPlotId] = useState("")
  const [selectedBedId, setSelectedBedId] = useState("")
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  const load = async () => {
    const results = await Promise.all([
      supabase.from("orchard_game_plans").select("id,status").order("start_date", { ascending: false }),
      supabase.from("orchard_plots").select("id,name").order("name"),
      supabase.from("orchard_beds").select("id,plot_id,name,planning_order").eq("status", "active").order("planning_order"),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_bed_m").neq("status", "cancelled"),
      supabase.from("orchard_bed_allocations").select("bed_id,crop_succession_id"),
    ])
    if (results.some(result => result.error)) return
    setPlans((results[0].data ?? []) as Plan[])
    setPlots((results[1].data ?? []) as Plot[])
    setBeds((results[2].data ?? []) as Bed[])
    setCycles((results[3].data ?? []) as Cycle[])
    setSuccessions((results[4].data ?? []) as Succession[])
    setAllocations((results[5].data ?? []) as Allocation[])
  }

  useEffect(() => { void load() }, [])

  const requested = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("game_plan") : null
  const plan = plans.find(item => item.id === requested) ?? plans.find(item => item.status === "active") ?? plans.find(item => item.status === "draft") ?? plans[0] ?? null
  const planCycles = cycles.filter(cycle => cycle.game_plan_id === plan?.id)
  const planCycleIds = new Set(planCycles.map(cycle => cycle.id))
  const cycleById = new Map(cycles.map(cycle => [cycle.id, cycle]))
  const physicalPlots = plots.filter(plot => PHYSICAL_BLOCK.test(plot.name))
  const physicalPlotIds = new Set(physicalPlots.map(plot => plot.id))
  const physicalBeds = beds.filter(bed => physicalPlotIds.has(bed.plot_id))
  const physicalBedIds = new Set(physicalBeds.map(bed => bed.id))
  const assignedIds = new Set(allocations.filter(allocation => physicalBedIds.has(allocation.bed_id)).map(allocation => allocation.crop_succession_id))
  const pending = successions
    .filter(item => planCycleIds.has(item.crop_cycle_id) && Number(item.planned_bed_m) > 0 && !assignedIds.has(item.id))
    .sort((a, b) => {
      const ad = a.planned_transplant_date ?? a.planned_sow_date ?? "9999-12-31"
      const bd = b.planned_transplant_date ?? b.planned_sow_date ?? "9999-12-31"
      return ad.localeCompare(bd) || (cycleById.get(a.crop_cycle_id)?.crop_name ?? "").localeCompare(cycleById.get(b.crop_cycle_id)?.crop_name ?? "") || a.sequence_no - b.sequence_no
    })

  useEffect(() => {
    if (!pending.length) { setSelectedSuccessionId(""); return }
    if (!pending.some(item => item.id === selectedSuccessionId)) setSelectedSuccessionId(pending[0].id)
  }, [pending.length, selectedSuccessionId])

  useEffect(() => {
    const firstPlot = physicalPlots[0]
    if (!selectedPlotId && firstPlot) setSelectedPlotId(firstPlot.id)
  }, [physicalPlots.length, selectedPlotId])

  const plotBeds = physicalBeds.filter(bed => bed.plot_id === selectedPlotId).sort((a, b) => (a.planning_order ?? 999) - (b.planning_order ?? 999))
  useEffect(() => {
    if (!plotBeds.some(bed => bed.id === selectedBedId)) setSelectedBedId(plotBeds[0]?.id ?? "")
  }, [selectedPlotId, plotBeds.length, selectedBedId])

  const selected = pending.find(item => item.id === selectedSuccessionId) ?? null
  const selectedCycle = selected ? cycleById.get(selected.crop_cycle_id) : null

  const assign = async () => {
    if (!selected || !selectedPlotId || !selectedBedId || placing) return
    const start = selected.planned_transplant_date ?? selected.planned_sow_date
    const end = selected.planned_last_harvest_date ?? selected.planned_first_harvest_date
    const required = Number(selected.planned_bed_m ?? 0)
    if (!start || !end || required <= 0) { setError(text.error); return }
    setPlacing(true)
    setError(null)
    const result = await supabase.rpc("orchard_place_succession_bed_meters", {
      p_succession_id: selected.id,
      p_plot_id: selectedPlotId,
      p_start_bed_id: selectedBedId,
      p_start_date: start,
      p_end_date: end,
      p_required_bed_m: required,
    })
    setPlacing(false)
    if (result.error) { setError(`${text.error} ${result.error.message}`); return }
    await load()
  }

  return <div className="relative">
    {children}
    {open ? <aside className="fixed bottom-4 left-4 right-4 z-[70] border border-white/15 bg-[#171715]/95 p-3 text-[#e8e5dc] shadow-2xl backdrop-blur-md lg:left-auto lg:right-5 lg:w-[760px]">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><strong className="text-sm font-semibold">{text.title}</strong><span className="text-[10px] uppercase tracking-[.1em] text-[#79c5aa]">{pending.length} {text.remaining}</span></div><p className="mt-1 text-[11px] text-[#aaa69c]">{pending.length ? text.help : text.complete}</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close quick assign" className="grid h-7 w-7 place-items-center text-[#8f8a81] hover:bg-white/5"><X className="h-4 w-4"/></button>
      </div>
      {pending.length ? <div className="grid gap-2 sm:grid-cols-[minmax(180px,1.7fr)_minmax(130px,1fr)_minmax(130px,1fr)_auto]">
        <label className="text-[10px] uppercase tracking-[.1em] text-[#8f8a81]">{text.planting}<select value={selectedSuccessionId} onChange={event => setSelectedSuccessionId(event.target.value)} className="mt-1 h-9 w-full border border-white/10 bg-[#20201d] px-2 text-xs text-white outline-none">{pending.map(item => { const cycle = cycleById.get(item.crop_cycle_id); const date = item.planned_transplant_date ?? item.planned_sow_date ?? "—"; return <option key={item.id} value={item.id}>{cycle?.crop_name ?? "Crop"} #{item.sequence_no} · {date}</option> })}</select></label>
        <label className="text-[10px] uppercase tracking-[.1em] text-[#8f8a81]">{text.block}<select value={selectedPlotId} onChange={event => setSelectedPlotId(event.target.value)} className="mt-1 h-9 w-full border border-white/10 bg-[#20201d] px-2 text-xs text-white outline-none">{physicalPlots.map(plot => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></label>
        <label className="text-[10px] uppercase tracking-[.1em] text-[#8f8a81]">{text.bed}<select value={selectedBedId} onChange={event => setSelectedBedId(event.target.value)} className="mt-1 h-9 w-full border border-white/10 bg-[#20201d] px-2 text-xs text-white outline-none">{plotBeds.map((bed, index) => <option key={bed.id} value={bed.id}>{bed.name || `Bed ${index + 1}`}</option>)}</select></label>
        <button type="button" onClick={() => void assign()} disabled={!selected || !selectedBedId || placing} className="mt-auto flex h-9 items-center justify-center gap-2 bg-[#79c5aa] px-4 text-xs font-semibold text-[#13241d] disabled:cursor-not-allowed disabled:opacity-40">{placing ? text.assigning : text.assign}<ArrowRight className="h-3.5 w-3.5"/></button>
      </div> : <div className="flex items-center gap-2 py-1 text-sm text-[#79c5aa]"><CheckCircle2 className="h-4 w-4"/>{text.complete}</div>}
      {error ? <p className="mt-2 text-[11px] text-red-300">{error}</p> : null}
      {selected && selectedCycle ? <p className="mt-2 text-[10px] text-[#77726a]">{selectedCycle.crop_name} #{selected.sequence_no} · {Number(selected.planned_bed_m)} bed-m</p> : null}
    </aside> : <button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 right-5 z-[70] border border-white/15 bg-[#171715]/95 px-3 py-2 text-xs text-[#79c5aa] shadow-lg backdrop-blur-md">{text.title} · {pending.length}</button>}
  </div>
}
