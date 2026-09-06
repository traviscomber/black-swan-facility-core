"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, MapPin, X } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Plan = { id: string; status: string }
type Plot = { id: string; name: string }
type Bed = { id: string; plot_id: string; name: string; planning_order: number | null }
type Cycle = { id: string; game_plan_id: string; crop_name: string }
type Succession = {
  id: string
  crop_cycle_id: string
  sequence_no: number
  planned_sow_date: string | null
  planned_transplant_date: string | null
  planned_first_harvest_date: string | null
  planned_last_harvest_date: string | null
  planned_bed_m: number | string | null
}
type Allocation = { bed_id: string; crop_succession_id: string }

const PHYSICAL_BLOCK = /^(Current 0[1-5]|Expansion 0[1-3])$/
const COPY = {
  en: {
    title: "Quick assign",
    help: "Choose a pending planting, its physical block and its starting bed. Nothing is placed automatically.",
    planting: "Planting",
    block: "Block",
    bed: "Starting bed",
    chooseBlock: "Choose block",
    chooseBed: "Choose bed",
    assign: "Assign & next",
    assigning: "Assigning…",
    remaining: "pending",
    complete: "All reconciled plantings have a physical allocation.",
    loadError: "Could not load physical allocation data.",
    assignError: "Could not assign this planting.",
    close: "Close quick assign",
  },
  es: {
    title: "Asignación rápida",
    help: "Elige una plantación pendiente, su bloque físico y su cama inicial. Nada se asigna automáticamente.",
    planting: "Plantación",
    block: "Bloque",
    bed: "Cama inicial",
    chooseBlock: "Elegir bloque",
    chooseBed: "Elegir cama",
    assign: "Asignar y seguir",
    assigning: "Asignando…",
    remaining: "pendientes",
    complete: "Todas las plantaciones reconciliadas tienen asignación física.",
    loadError: "No fue posible cargar las asignaciones físicas.",
    assignError: "No fue posible asignar esta plantación.",
    close: "Cerrar asignación rápida",
  },
  de: {
    title: "Schnell zuordnen",
    help: "Offene Pflanzung, physischen Block und Startbeet wählen. Nichts wird automatisch zugeordnet.",
    planting: "Pflanzung",
    block: "Block",
    bed: "Startbeet",
    chooseBlock: "Block wählen",
    chooseBed: "Beet wählen",
    assign: "Zuordnen & weiter",
    assigning: "Wird zugeordnet…",
    remaining: "offen",
    complete: "Alle abgeglichenen Pflanzungen sind physisch zugeordnet.",
    loadError: "Physische Zuordnungen konnten nicht geladen werden.",
    assignError: "Pflanzung konnte nicht zugeordnet werden.",
    close: "Schnellzuordnung schließen",
  },
} as const

export function CropMapQuickAssign() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const locale = language as Locale
  const text = COPY[locale] ?? COPY.en
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
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const results = await Promise.all([
      supabase.from("orchard_game_plans").select("id,status").order("start_date", { ascending: false }),
      supabase.from("orchard_plots").select("id,name").order("name"),
      supabase.from("orchard_beds").select("id,plot_id,name,planning_order").eq("status", "active").order("planning_order"),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_bed_m").neq("status", "cancelled"),
      supabase.from("orchard_bed_allocations").select("bed_id,crop_succession_id"),
    ])
    const firstError = results.find(result => result.error)?.error
    if (firstError) {
      console.error("crop map quick assign load failed", firstError)
      setError(text.loadError)
      return
    }
    setPlans((results[0].data ?? []) as Plan[])
    setPlots((results[1].data ?? []) as Plot[])
    setBeds((results[2].data ?? []) as Bed[])
    setCycles((results[3].data ?? []) as Cycle[])
    setSuccessions((results[4].data ?? []) as Succession[])
    setAllocations((results[5].data ?? []) as Allocation[])
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const requested = searchParams.get("game_plan")
  const plan = plans.find(item => item.id === requested)
    ?? plans.find(item => item.status === "active")
    ?? plans.find(item => item.status === "draft")
    ?? plans[0]
    ?? null
  const planCycles = cycles.filter(cycle => cycle.game_plan_id === plan?.id)
  const planCycleIds = new Set(planCycles.map(cycle => cycle.id))
  const cycleById = new Map(cycles.map(cycle => [cycle.id, cycle]))
  const physicalPlots = plots.filter(plot => PHYSICAL_BLOCK.test(plot.name))
  const physicalPlotIds = new Set(physicalPlots.map(plot => plot.id))
  const physicalBeds = beds.filter(bed => physicalPlotIds.has(bed.plot_id))
  const physicalBedIds = new Set(physicalBeds.map(bed => bed.id))
  const assignedIds = new Set(
    allocations
      .filter(allocation => physicalBedIds.has(allocation.bed_id))
      .map(allocation => allocation.crop_succession_id),
  )
  const pending = successions
    .filter(item => planCycleIds.has(item.crop_cycle_id) && Number(item.planned_bed_m) > 0 && !assignedIds.has(item.id))
    .sort((a, b) => {
      const aDate = a.planned_transplant_date ?? a.planned_sow_date ?? "9999-12-31"
      const bDate = b.planned_transplant_date ?? b.planned_sow_date ?? "9999-12-31"
      return aDate.localeCompare(bDate)
        || (cycleById.get(a.crop_cycle_id)?.crop_name ?? "").localeCompare(cycleById.get(b.crop_cycle_id)?.crop_name ?? "")
        || a.sequence_no - b.sequence_no
    })

  useEffect(() => {
    if (!pending.length) {
      setSelectedSuccessionId("")
      return
    }
    if (!pending.some(item => item.id === selectedSuccessionId)) setSelectedSuccessionId(pending[0].id)
  }, [pending, selectedSuccessionId])

  const plotBeds = physicalBeds
    .filter(bed => bed.plot_id === selectedPlotId)
    .sort((a, b) => (a.planning_order ?? 999) - (b.planning_order ?? 999) || a.name.localeCompare(b.name))
  const selected = pending.find(item => item.id === selectedSuccessionId) ?? null
  const selectedCycle = selected ? cycleById.get(selected.crop_cycle_id) : null

  const assign = async () => {
    if (!selected || !selectedPlotId || !selectedBedId || placing) return
    const startDate = selected.planned_transplant_date ?? selected.planned_sow_date
    const endDate = selected.planned_last_harvest_date ?? selected.planned_first_harvest_date
    const requiredBedM = Number(selected.planned_bed_m ?? 0)
    if (!startDate || !endDate || requiredBedM <= 0) {
      setError(text.assignError)
      return
    }

    setPlacing(true)
    setError(null)
    const result = await supabase.rpc("orchard_place_succession_bed_meters", {
      p_succession_id: selected.id,
      p_plot_id: selectedPlotId,
      p_start_bed_id: selectedBedId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_required_bed_m: requiredBedM,
    })
    setPlacing(false)
    if (result.error) {
      console.error("crop map quick assign failed", result.error)
      setError(`${text.assignError} ${result.error.message}`)
      return
    }
    setSelectedBedId("")
    await load()
  }

  if (!pending.length && !error) return null

  if (!open) {
    return <button
      type="button"
      data-testid="crop-map-quick-assign-trigger"
      onClick={() => setOpen(true)}
      className="fixed bottom-4 right-[284px] z-[75] inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#45413a] bg-[#171715]/95 px-3 text-xs font-medium text-[#bde1cf] shadow-lg backdrop-blur-md hover:bg-[#211f1b] max-lg:right-4"
    >
      <MapPin className="h-4 w-4" />
      {text.title} · {pending.length}
    </button>
  }

  return <aside
    data-testid="crop-map-quick-assign"
    className="fixed bottom-4 right-[284px] z-[75] w-[min(720px,calc(100vw-2rem))] rounded-xl border border-[#45413a] bg-[#171715]/95 p-3 text-[#e8e5dc] shadow-2xl backdrop-blur-md max-lg:right-4"
  >
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <strong className="text-sm font-semibold">{text.title}</strong>
          <span className="text-[10px] uppercase tracking-[.1em] text-[#79c5aa]">{pending.length} {text.remaining}</span>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[#aaa69c]">{pending.length ? text.help : text.complete}</p>
      </div>
      <button type="button" onClick={() => setOpen(false)} aria-label={text.close} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[#8f8a81] hover:bg-white/5">
        <X className="h-4 w-4" />
      </button>
    </div>

    {pending.length ? <div className="grid gap-2 sm:grid-cols-[minmax(190px,1.7fr)_minmax(130px,1fr)_minmax(130px,1fr)_auto]">
      <label className="text-[10px] uppercase tracking-[.1em] text-[#8f8a81]">
        {text.planting}
        <select value={selectedSuccessionId} onChange={event => setSelectedSuccessionId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#20201d] px-2 text-xs normal-case tracking-normal text-white outline-none focus:border-[#79c5aa]">
          {pending.map(item => {
            const cycle = cycleById.get(item.crop_cycle_id)
            const date = item.planned_transplant_date ?? item.planned_sow_date ?? "—"
            return <option key={item.id} value={item.id}>{cycle?.crop_name ?? "Crop"} #{item.sequence_no} · {date}</option>
          })}
        </select>
      </label>
      <label className="text-[10px] uppercase tracking-[.1em] text-[#8f8a81]">
        {text.block}
        <select value={selectedPlotId} onChange={event => { setSelectedPlotId(event.target.value); setSelectedBedId("") }} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#20201d] px-2 text-xs normal-case tracking-normal text-white outline-none focus:border-[#79c5aa]">
          <option value="">{text.chooseBlock}</option>
          {physicalPlots.map(plot => <option key={plot.id} value={plot.id}>{plot.name}</option>)}
        </select>
      </label>
      <label className="text-[10px] uppercase tracking-[.1em] text-[#8f8a81]">
        {text.bed}
        <select value={selectedBedId} onChange={event => setSelectedBedId(event.target.value)} disabled={!selectedPlotId} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#20201d] px-2 text-xs normal-case tracking-normal text-white outline-none focus:border-[#79c5aa] disabled:opacity-50">
          <option value="">{text.chooseBed}</option>
          {plotBeds.map((bed, index) => <option key={bed.id} value={bed.id}>{bed.name || `Bed ${index + 1}`}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => void assign()} disabled={!selected || !selectedPlotId || !selectedBedId || placing} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#79c5aa] px-4 text-xs font-semibold text-[#13241d] disabled:cursor-not-allowed disabled:opacity-40">
        {placing ? text.assigning : text.assign}<ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div> : <div className="flex items-center gap-2 py-1 text-sm text-[#79c5aa]"><CheckCircle2 className="h-4 w-4" />{text.complete}</div>}

    {error ? <p className="mt-2 text-[11px] leading-4 text-red-300" role="alert">{error}</p> : null}
    {selected && selectedCycle ? <p className="mt-2 text-[10px] text-[#77726a]">{selectedCycle.crop_name} #{selected.sequence_no} · {Number(selected.planned_bed_m)} bed-m</p> : null}
  </aside>
}
