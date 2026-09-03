"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, ShoppingCart, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import directSowReference from "@/data/orchard/dietrich-direct-sow-2026-27.json"
import { ORCHARD_GERMINATION_PLANNING_REFERENCE } from "@/lib/orchard/germination-reference"
import {
  estimateDirectProcurement,
  estimateTransplantProcurement,
  estimateTuberProcurement,
  parseApproxGrams,
  parseCentimeters,
  type ProcurementBasis,
  type ProcurementDemand,
  type ProcurementUnit,
} from "@/lib/orchard/seed-procurement"

type Locale = "en" | "es" | "de"
type Plan = { id: string; season: string | null; status: string }
type Cycle = { id: string; game_plan_id: string; crop_name: string; variety: string | null; cycle_type: string }
type Succession = {
  id: string
  crop_cycle_id: string
  planned_sow_date: string
  planned_transplant_date: string | null
  planned_bed_m: number | null
  planned_plants: number | null
  germination_rate_pct: number | null
  seeds_per_plant: number | null
  crop_library_id: string | null
  status: string
}
type Allocation = { crop_succession_id: string }
type CropLibraryRow = { id: string; crop_name: string; germination_rate_pct: number | null; seeds_per_plant: number | null }
type DirectRow = { crop: string; cultivar: string; density_30m: string }
type ProcurementRequest = {
  id: string
  request_number: string | null
  title: string
  quantity: number
  unit: string
  status: string
  source_ref: string | null
  created_at: string
}
type ProcurementLocation = { id: string; name: string }
type DemandLine = {
  crop: string
  variety: string | null
  cycleType: string
  value: number
  unit: ProcurementUnit
  basis: ProcurementBasis
  firstNurserySowing: string | null
  firstPlanting: string | null
  sourceRef: string
}

const DIRECT_SOURCE_CROP_BY_CANONICAL: Record<string, string> = {
  Arugula: "Rucula",
  "Bush Beans": "Beans (bush)",
  Carrots: "Carrots",
  Peas: "Sweet peas",
}
const POTATO_SPACING: Record<string, string> = { "New Potatoes": "15 cm", "Storage Potatoes": "20 cm" }
const LOCALE: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }

const COPY = {
  en: {
    eyebrow: "Orchard · Procurement",
    title: "Seeds & transplants",
    description: "One purchasing board from the physically reconciled crop plan. Orchard owns the agronomic requirement; the central Procurement workflow owns request, quotation, approval, order, receiving and inventory status.",
    crop: "Crop", cultivar: "Cultivar", nursery: "First nursery sowing", planting: "First planting", weight: "Weight", seeds: "Seeds / tubers", order: "Procurement status",
    notRequested: "Not requested", create: "Create request", creating: "Creating…", open: "Open request", technical: "Method & evidence", empty: "No physically allocated seed demand for this plan.",
    requestError: "The procurement request could not be created.", locationError: "Farm Area 1 is not available in your procurement location scope.", loadError: "The seed procurement board could not be loaded.",
    gross: "Gross plan requirement", grossHelp: "Inventory is not deducted here. A procurement request is created only by an explicit operator action and then follows the canonical Black Swan purchasing workflow.",
    allocation: "physical plantings", source: "Dietrich 2026/27 + canonical Crop Map", changed: "Plan demand changed", requestQty: "requested", direct: "Direct sow", transplant: "Nursery / transplant",
  },
  es: {
    eyebrow: "Huerto · Compras",
    title: "Semillas y trasplantes",
    description: "Un solo tablero de compra desde el plan de cultivos físicamente reconciliado. Orchard es dueño del requerimiento agronómico; el flujo central de Compras es dueño de solicitud, cotización, aprobación, orden, recepción e inventario.",
    crop: "Cultivo", cultivar: "Cultivar", nursery: "Primera siembra almácigo", planting: "Primera plantación", weight: "Peso", seeds: "Semillas / tubérculos", order: "Estado de compra",
    notRequested: "Sin solicitar", create: "Crear solicitud", creating: "Creando…", open: "Abrir solicitud", technical: "Método y evidencia", empty: "No hay demanda de semillas físicamente asignada para este plan.",
    requestError: "No fue posible crear la solicitud de compra.", locationError: "Farm Area 1 no está disponible dentro de tu scope de Compras.", loadError: "No fue posible cargar el tablero de compras de semillas.",
    gross: "Requerimiento bruto del plan", grossHelp: "Aquí no se descuenta inventario. Una solicitud de compra sólo se crea por acción explícita del operador y después sigue el flujo canónico de Compras de Black Swan.",
    allocation: "plantaciones físicas", source: "Dietrich 2026/27 + Crop Map canónico", changed: "Cambió la demanda del plan", requestQty: "solicitado", direct: "Siembra directa", transplant: "Almácigo / trasplante",
  },
  de: {
    eyebrow: "Orchard · Beschaffung",
    title: "Saatgut & Jungpflanzen",
    description: "Eine Beschaffungsübersicht aus dem physisch abgeglichenen Anbauplan. Orchard verantwortet den agronomischen Bedarf; der zentrale Einkauf verantwortet Anforderung, Angebot, Freigabe, Bestellung, Wareneingang und Bestand.",
    crop: "Kultur", cultivar: "Sorte", nursery: "Erste Aussaat Anzucht", planting: "Erste Pflanzung", weight: "Gewicht", seeds: "Samen / Knollen", order: "Beschaffungsstatus",
    notRequested: "Nicht angefordert", create: "Anforderung erstellen", creating: "Wird erstellt…", open: "Anforderung öffnen", technical: "Methode & Nachweise", empty: "Kein physisch zugeordneter Saatgutbedarf für diesen Plan.",
    requestError: "Die Beschaffungsanforderung konnte nicht erstellt werden.", locationError: "Farm Area 1 ist in deinem Beschaffungsbereich nicht verfügbar.", loadError: "Die Saatgut-Beschaffungsübersicht konnte nicht geladen werden.",
    gross: "Bruttobedarf des Plans", grossHelp: "Bestand wird hier nicht abgezogen. Eine Beschaffungsanforderung entsteht nur durch eine explizite Operator-Aktion und folgt danach dem kanonischen Black-Swan-Einkaufsprozess.",
    allocation: "physische Pflanzungen", source: "Dietrich 2026/27 + kanonische Crop Map", changed: "Planbedarf geändert", requestQty: "angefordert", direct: "Direktsaat", transplant: "Anzucht / Pflanzung",
  },
} as const

function earliest(current: string | null, candidate: string | null) {
  if (!candidate) return current
  if (!current || candidate < current) return candidate
  return current
}
function addDemand(map: Map<string, DemandLine>, planId: string, cycle: Cycle, succession: Succession, demand: ProcurementDemand) {
  if (demand.value == null || !demand.basis) return
  const variety = cycle.variety?.trim() || null
  const key = `${cycle.crop_name}|${variety ?? ""}|${demand.unit}`
  const existing = map.get(key)
  const firstNurserySowing = cycle.cycle_type === "transplant" ? succession.planned_sow_date : null
  const firstPlanting = cycle.cycle_type === "transplant" ? succession.planned_transplant_date : succession.planned_sow_date
  const sourceRef = [planId, cycle.crop_name, variety ?? "generic", demand.unit].join("|")
  map.set(key, {
    crop: cycle.crop_name,
    variety,
    cycleType: cycle.cycle_type,
    value: (existing?.value ?? 0) + demand.value,
    unit: demand.unit,
    basis: existing?.basis ?? demand.basis,
    firstNurserySowing: earliest(existing?.firstNurserySowing ?? null, firstNurserySowing),
    firstPlanting: earliest(existing?.firstPlanting ?? null, firstPlanting),
    sourceRef,
  })
}
function requestStatusClass(status: string) {
  if (["approved", "approved_for_quotation", "final_approved", "converted"].includes(status)) return "border-emerald-500/30 text-emerald-300"
  if (status === "rejected") return "border-red-500/30 text-red-300"
  if (["submitted", "under_review"].includes(status)) return "border-amber-500/30 text-amber-200"
  return "border-border text-muted-foreground"
}

export default function OrchardSeedOrdersPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = COPY[lang]
  const locale = LOCALE[lang]
  const [plans, setPlans] = useState<Plan[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [library, setLibrary] = useState<CropLibraryRow[]>([])
  const [requests, setRequests] = useState<ProcurementRequest[]>([])
  const [farmLocation, setFarmLocation] = useState<ProcurementLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingRef, setCreatingRef] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [p, c, s, a, l, r, locations] = await Promise.all([
      supabase.from("orchard_game_plans").select("id,season,status").order("start_date", { ascending: false }),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety,cycle_type"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,planned_sow_date,planned_transplant_date,planned_bed_m,planned_plants,germination_rate_pct,seeds_per_plant,crop_library_id,status").neq("status", "cancelled").order("planned_sow_date"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id"),
      supabase.from("orchard_crop_library").select("id,crop_name,germination_rate_pct,seeds_per_plant").eq("is_active", true).eq("classification_scheme", "black_swan_canonical").eq("classification_code", "fundo_corcovado"),
      supabase.from("procurement_requests").select("id,request_number,title,quantity,unit,status,source_ref,created_at").eq("source_type", "orchard_seed_plan").order("created_at", { ascending: false }),
      supabase.rpc("get_procurement_location_directory"),
    ])
    const first = p.error ?? c.error ?? s.error ?? a.error ?? l.error ?? r.error ?? locations.error
    if (first) {
      console.error("orchard seed procurement load failed", first)
      setError(text.loadError)
      setLoading(false)
      return
    }
    setPlans((p.data ?? []) as Plan[])
    setCycles((c.data ?? []) as Cycle[])
    setSuccessions((s.data ?? []) as Succession[])
    setAllocations((a.data ?? []) as Allocation[])
    setLibrary((l.data ?? []) as CropLibraryRow[])
    setRequests((r.data ?? []) as ProcurementRequest[])
    const directory = (locations.data ?? []) as ProcurementLocation[]
    setFarmLocation(directory.find((row) => row.name === "Farm Area 1") ?? null)
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const requested = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("game_plan") : null
  const plan = plans.find((row) => row.id === requested) ?? plans.find((row) => row.status === "active") ?? plans.find((row) => row.status === "draft") ?? plans[0] ?? null
  const scopedCycles = plan ? cycles.filter((row) => row.game_plan_id === plan.id) : []
  const cycleById = new Map(scopedCycles.map((row) => [row.id, row]))
  const allocatedIds = new Set(allocations.map((row) => row.crop_succession_id))
  const scopedSuccessions = successions.filter((row) => cycleById.has(row.crop_cycle_id) && allocatedIds.has(row.id))
  const libraryById = new Map(library.map((row) => [row.id, row]))

  const lines = useMemo(() => {
    if (!plan) return [] as DemandLine[]
    const map = new Map<string, DemandLine>()
    for (const succession of scopedSuccessions) {
      const cycle = cycleById.get(succession.crop_cycle_id)
      if (!cycle) continue
      if (cycle.cycle_type === "transplant") {
        const crop = succession.crop_library_id ? libraryById.get(succession.crop_library_id) : null
        addDemand(map, plan.id, cycle, succession, estimateTransplantProcurement({
          plannedPlants: succession.planned_plants,
          seedsPerPlant: succession.seeds_per_plant ?? crop?.seeds_per_plant ?? null,
          germinationRatePct: succession.germination_rate_pct ?? crop?.germination_rate_pct ?? null,
          fallbackGerminationRatePct: ORCHARD_GERMINATION_PLANNING_REFERENCE.planningFallbackPct,
        }))
        continue
      }
      const potatoSpacing = POTATO_SPACING[cycle.crop_name]
      if (potatoSpacing) {
        addDemand(map, plan.id, cycle, succession, estimateTuberProcurement({ plannedBedM: succession.planned_bed_m, spacingCm: parseCentimeters(potatoSpacing) }))
        continue
      }
      const sourceCrop = DIRECT_SOURCE_CROP_BY_CANONICAL[cycle.crop_name]
      const rows = sourceCrop ? (directSowReference as DirectRow[]).filter((row) => row.crop === sourceCrop && (row.cultivar === "All" || cycle.crop_name === "Arugula")) : []
      const profile = rows.find((row) => row.cultivar === "All") ?? rows[0]
      addDemand(map, plan.id, cycle, succession, estimateDirectProcurement({ plannedBedM: succession.planned_bed_m, densityG: parseApproxGrams(profile?.density_30m), referenceBedM: 30 }))
    }
    return Array.from(map.values()).sort((a, b) => a.crop.localeCompare(b.crop) || (a.variety ?? "").localeCompare(b.variety ?? ""))
  }, [plan, scopedSuccessions, cycleById, libraryById])

  const requestByRef = useMemo(() => {
    const map = new Map<string, ProcurementRequest>()
    for (const request of requests) if (request.source_ref && !map.has(request.source_ref)) map.set(request.source_ref, request)
    return map
  }, [requests])

  const dateLabel = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "—"
  const valueLabel = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 })
  const unitLabel = (unit: ProcurementUnit) => unit === "seed_count" ? (lang === "es" ? "semillas" : lang === "de" ? "Samen" : "seeds") : unit === "tuber_count" ? (lang === "es" ? "tubérculos" : lang === "de" ? "Knollen" : "tubers") : "g"
  const statusLabel = (status: string) => ({
    draft: lang === "es" ? "Borrador" : lang === "de" ? "Entwurf" : "Draft",
    submitted: lang === "es" ? "Enviada" : lang === "de" ? "Eingereicht" : "Submitted",
    under_review: lang === "es" ? "En revisión" : lang === "de" ? "In Prüfung" : "Under review",
    approved: lang === "es" ? "Aprobada" : lang === "de" ? "Freigegeben" : "Approved",
    approved_for_quotation: lang === "es" ? "Lista para cotizar" : lang === "de" ? "Für Angebot freigegeben" : "Ready for quotation",
    final_approved: lang === "es" ? "Aprobación final" : lang === "de" ? "Final freigegeben" : "Final approved",
    rejected: lang === "es" ? "Rechazada" : lang === "de" ? "Abgelehnt" : "Rejected",
    converted: lang === "es" ? "Convertida" : lang === "de" ? "Umgewandelt" : "Converted",
  } as Record<string, string>)[status] ?? status

  const createRequest = async (line: DemandLine) => {
    if (!plan || creatingRef) return
    if (!farmLocation) { setError(text.locationError); return }
    setCreatingRef(line.sourceRef)
    setError(null)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) { setError(text.requestError); setCreatingRef(null); return }
    const unit = unitLabel(line.unit)
    const cropLabel = line.variety ? `${line.crop} · ${line.variety}` : line.crop
    const { error: insertError } = await supabase.from("procurement_requests").insert({
      title: `Orchard ${plan.season ?? ""} · ${cropLabel}`.trim(),
      description: `${text.gross}: ${valueLabel(line.value)} ${unit}. ${text.source}.`,
      business_justification: `${text.gross}: ${cropLabel} · ${plan.season ?? ""}`.trim(),
      category: "Supplies",
      quantity: line.value,
      unit,
      priority: "normal",
      status: "submitted",
      required_date: null,
      region: "Los Ríos",
      commune: "Valdivia",
      location_id: farmLocation.id,
      delivery_location: "Farm Area 1",
      requested_by: authData.user.id,
      source_type: "orchard_seed_plan",
      source_ref: line.sourceRef,
      source_path: `/orchard/seed-orders?game_plan=${plan.id}`,
    })
    if (insertError) {
      console.error("orchard procurement request creation failed", insertError)
      setError(text.requestError)
      setCreatingRef(null)
      return
    }
    await load()
    setCreatingRef(null)
  }

  const technicalHref = `/${language}/orchard/game-plan/propagation${plan ? `?game_plan=${encodeURIComponent(plan.id)}` : ""}`

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-7 sm:px-6 lg:px-8">
    <header className="mb-6 flex flex-col gap-4 border-b border-[var(--orchard-line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--orchard-green)]">{text.eyebrow}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season ? <Badge variant="secondary">{plan.season}</Badge> : null}</div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{text.description}</p>
      </div>
      <Button variant="outline" asChild><Link href={technicalHref}>{text.technical}<ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
    </header>

    {error ? <div className="mb-5 flex gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><span>{error}</span></div> : null}

    <section className="mb-5 grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-3">
      <Metric label={text.gross} value={String(lines.length)} detail={`${scopedSuccessions.length} ${text.allocation}`} />
      <Metric label={text.order} value={String(lines.filter((line) => requestByRef.has(line.sourceRef)).length)} detail={`${lines.length} ${text.crop.toLowerCase()}`} />
      <Metric label={text.source} value={plan?.season ?? "—"} detail="Farm Area 1" />
    </section>

    <div className="mb-5 flex gap-3 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground"><ShoppingCart className="mt-1 h-4 w-4 shrink-0"/><span>{text.grossHelp}</span></div>

    {loading ? <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>…</div> : lines.length === 0 ? <div className="border border-[var(--bs-divider-subtle)] p-10 text-center text-sm text-muted-foreground">{text.empty}</div> : <div className="overflow-x-auto border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]">
      <table className="w-full min-w-[1120px] border-collapse text-sm">
        <thead className="bg-[var(--bs-surface-secondary)] text-left text-[10px] uppercase tracking-[.12em] text-muted-foreground"><tr><th className="px-4 py-3">{text.crop}</th><th className="px-4 py-3">{text.cultivar}</th><th className="px-4 py-3">{text.nursery}</th><th className="px-4 py-3">{text.planting}</th><th className="px-4 py-3 text-right">{text.weight}</th><th className="px-4 py-3 text-right">{text.seeds}</th><th className="px-4 py-3">{text.order}</th></tr></thead>
        <tbody>{lines.map((line) => {
          const request = requestByRef.get(line.sourceRef) ?? null
          const demandChanged = Boolean(request && (Math.abs(Number(request.quantity) - line.value) > 0.01 || request.unit !== unitLabel(line.unit)))
          return <tr key={line.sourceRef} className="border-t border-[var(--bs-divider-subtle)] align-middle">
            <td className="px-4 py-3"><div className="flex items-center gap-2"><Sprout className="h-4 w-4 text-[var(--orchard-green)]"/><div><p className="font-medium">{line.crop}</p><p className="mt-0.5 text-[10px] uppercase tracking-[.1em] text-muted-foreground">{line.cycleType === "transplant" ? text.transplant : text.direct}</p></div></div></td>
            <td className="px-4 py-3 text-muted-foreground">{line.variety ?? "—"}</td>
            <td className="px-4 py-3 tabular-nums">{dateLabel(line.firstNurserySowing)}</td>
            <td className="px-4 py-3 tabular-nums">{dateLabel(line.firstPlanting)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{line.unit === "g" ? `${valueLabel(line.value)} g` : "—"}</td>
            <td className="px-4 py-3 text-right tabular-nums">{line.unit === "g" ? "—" : `${valueLabel(line.value)} ${unitLabel(line.unit)}`}</td>
            <td className="px-4 py-3">{request ? <div className="flex min-w-[220px] items-center justify-between gap-3"><div><Badge variant="outline" className={requestStatusClass(request.status)}>{statusLabel(request.status)}</Badge>{demandChanged ? <p className="mt-1 text-[10px] text-amber-300">{text.changed} · {text.requestQty} {valueLabel(Number(request.quantity))} {request.unit}</p> : <p className="mt-1 text-[10px] text-muted-foreground">{request.request_number ?? request.id.slice(0, 8)}</p>}</div><Button size="sm" variant="ghost" asChild><Link href={`/${language}/procurement/requests/${request.id}`}>{text.open}<ArrowRight className="ml-1 h-3.5 w-3.5"/></Link></Button></div> : <div className="flex min-w-[220px] items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{text.notRequested}</span><Button size="sm" onClick={() => void createRequest(line)} disabled={creatingRef !== null || !farmLocation}>{creatingRef === line.sourceRef ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>{text.creating}</> : text.create}</Button></div>}</td>
          </tr>
        })}</tbody>
      </table>
    </div>}

    <footer className="mt-5 flex flex-col gap-2 border-t border-[var(--bs-divider-subtle)] pt-4 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}. {lines.length} {text.crop.toLowerCase()} · {scopedSuccessions.length} {text.allocation}.</span><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5"/>Procurement status is canonical; no purchase order is created automatically.</span></footer>
  </main></AppLayout>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 text-3xl tabular-nums">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>
}
