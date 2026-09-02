"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, CircleAlert, Database, ShoppingBasket } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import directSowReference from "@/data/orchard/dietrich-direct-sow-2026-27.json"
import nurseryReference from "@/data/orchard/dietrich-nursery-2026-27.json"
import { ORCHARD_GERMINATION_PLANNING_REFERENCE } from "@/lib/orchard/germination-reference"
import { estimateDirectProcurement, estimateTransplantProcurement, estimateTuberProcurement, parseApproxGrams, parseCentimeters, type ProcurementBasis, type ProcurementDemand, type ProcurementUnit } from "@/lib/orchard/seed-procurement"

type Locale = "en" | "es" | "de"
type Plan = { id: string; season: string | null; status: string }
type Cycle = { id: string; game_plan_id: string; crop_name: string; cycle_type: string }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_sow_date: string; planned_transplant_date: string | null; planned_bed_m: number | null; planned_plants: number | null; germination_rate_pct: number | null; seeds_per_plant: number | null; crop_library_id: string | null; status: string }
type Allocation = { crop_succession_id: string }
type CropLibraryRow = { id: string; germination_rate_pct: number | null; seeds_per_plant: number | null }
type DirectRow = { crop: string; cultivar: string; seeder: string; rows_per_bed: number; spacing_cm: string; calibration: string; brush: string; density_30m: string; notes: string }
type NurseryRow = { cycle_name: string; reference_crop: string; rows_per_bed: number; spacing_cm: string | number | null; row_spacing_cm: string | number | null; tray_cells: string | number; germination_temp: string; days_to_germinate: string | number; days_in_nursery: string | number; seeding_technique: string | null; nursery_notes: string | null; row_marker: string | null; transplant_notes: string | null }
type DirectProfile = { label: "standard" | "alternate" | "manual"; seeder: string; rows: string; spacing: string; calibration: string; density: string; notes: string; source: string; applicableCalibration: boolean }
type ProcurementLine = { crop: string; value: number; unit: ProcurementUnit; basis: ProcurementBasis }

const DIRECT_SOURCE_CROP_BY_CANONICAL: Record<string, string> = {
  Arugula: "Rucula",
  "Bush Beans": "Beans (bush)",
  Carrots: "Carrots",
  Peas: "Sweet peas",
}

const POTATO_PROFILES: Record<string, DirectProfile> = {
  "New Potatoes": { label: "manual", seeder: "By hand", rows: "1", spacing: "15 cm", calibration: "N/A", density: "N/A", notes: "Manual direct planting; machine calibration is not applicable.", source: "Crop Chart!A49:O49", applicableCalibration: false },
  "Storage Potatoes": { label: "manual", seeder: "By hand", rows: "1", spacing: "20 cm", calibration: "N/A", density: "N/A", notes: "Manual direct planting; machine calibration is not applicable.", source: "Crop Chart!A48:O48", applicableCalibration: false },
}

const copy = {
  en: {
    eyebrow: "Dietrich · Sowing & Nursery", title: "Propagation on the reconciled field plan", description: "One operational view for seed purchasing, direct sowing, nursery propagation and germination evidence. Source settings stay separate from observed field data.",
    direct: "Direct sow", transplant: "Nursery & transplant", plantings: "plantings", methodCoverage: "method coverage", calibrationCoverage: "equipment / calibration", nurseryCoverage: "nursery reference", standard: "Standard", alternate: "Alternative", manual: "Manual / N/A equipment",
    crop: "Crop", date: "Sow", transplantDate: "Transplant", seeder: "Method / seeder", rows: "Rows", calibration: "Calibration", density: "Source density / 30 m", spacing: "Spacing", notes: "Notes", sourceCell: "Source",
    trays: "Container", temp: "Germination temp", germDays: "Days to germinate", nurseryDays: "Days in nursery", technique: "Seeding technique", advanced: "Open seed & nursery management",
    source: "Workbook references: Ds Chart, Nursery & Transplant Chart, Crop Chart and Seeds · 2026/27", scopeWarning: "Only the 32 physically reconciled Crop Map plantings are included.", directWarning: "Direct-sowing density is preserved in the workbook's native 30 m unit. Potatoes are manual, so seeder calibration is N/A rather than missing.",
    germTitle: "Germination evidence", planningFallback: "Procurement fallback", expected: "Crop / cultivar expected", seedLots: "Seed lots recorded", batches: "Nursery batches observed", unresolved: "Unresolved", noObserved: "No observed batches yet", fallbackHelp: "90% is the workbook-global seed-purchase planning factor. It is not observed germination and is not treated as crop-specific evidence.",
    procurementTitle: "Required by the plan", procurementDescription: "Gross purchasing requirement from the reconciled planting plan. Current inventory is not deducted yet.", inventoryLater: "Next step: consolidate current stock and calculate the real purchase deficit.", seedRequired: "Transplant seeds", gramsRequired: "Direct-sow seed", tubersRequired: "Seed tubers", requirement: "Required", basis: "Calculation basis", seedUnit: "seeds", gramUnit: "g", tuberUnit: "tubers", explicitBasis: "Specific germination", fallbackBasis: "90% purchase factor", densityBasis: "Workbook density / 30 m", spacingBasis: "Manual spacing",
    noRows: "No reconciled plantings.", noSource: "No exact reference", sourceBadge: "Source", sequence: "Succession",
  },
  es: {
    eyebrow: "Dietrich · Siembra y Almácigo", title: "Propagación sobre el plan de campo reconciliado", description: "Una sola vista operacional para compra de semillas, siembra directa, propagación en almácigo y evidencia de germinación. Los parámetros fuente se mantienen separados de los datos observados.",
    direct: "Siembra directa", transplant: "Almácigo y trasplante", plantings: "plantaciones", methodCoverage: "cobertura método", calibrationCoverage: "equipo / calibración", nurseryCoverage: "referencia almácigo", standard: "Estándar", alternate: "Alternativa", manual: "Manual / equipo N/A",
    crop: "Cultivo", date: "Siembra", transplantDate: "Trasplante", seeder: "Método / sembradora", rows: "Filas", calibration: "Calibración", density: "Densidad fuente / 30 m", spacing: "Distancia", notes: "Notas", sourceCell: "Fuente",
    trays: "Contenedor", temp: "Temp. germinación", germDays: "Días a germinar", nurseryDays: "Días en almácigo", technique: "Técnica siembra", advanced: "Abrir gestión de semillas y almácigos",
    source: "Referencias workbook: Ds Chart, Nursery & Transplant Chart, Crop Chart y Seeds · 2026/27", scopeWarning: "Sólo se incluyen las 32 plantaciones físicamente reconciliadas en Crop Map.", directWarning: "La densidad de siembra directa se conserva en la unidad nativa del workbook: 30 m. Las papas son manuales; la calibración de sembradora es N/A, no un dato faltante.",
    germTitle: "Evidencia de germinación", planningFallback: "Fallback de compra", expected: "Esperada cultivo / cultivar", seedLots: "Lotes de semilla registrados", batches: "Batches de almácigo observados", unresolved: "Sin resolver", noObserved: "Aún sin batches observados", fallbackHelp: "90% es el factor global del workbook para planificar compra de semillas. No es germinación observada ni se trata como evidencia específica por cultivo.",
    procurementTitle: "Requerido por el plan", procurementDescription: "Requerimiento bruto de compra calculado desde el plan reconciliado. Todavía no se descuenta el inventario disponible.", inventoryLater: "Siguiente paso: consolidar el stock actual y calcular el déficit real de compra.", seedRequired: "Semillas de trasplante", gramsRequired: "Semilla siembra directa", tubersRequired: "Tubérculos semilla", requirement: "Requerido", basis: "Base de cálculo", seedUnit: "semillas", gramUnit: "g", tuberUnit: "tubérculos", explicitBasis: "Germinación específica", fallbackBasis: "Factor de compra 90%", densityBasis: "Densidad workbook / 30 m", spacingBasis: "Espaciado manual",
    noRows: "No hay plantaciones reconciliadas.", noSource: "Sin referencia exacta", sourceBadge: "Fuente", sequence: "Sucesión",
  },
  de: {
    eyebrow: "Dietrich · Aussaat & Anzucht", title: "Vermehrung auf dem abgeglichenen Feldplan", description: "Eine operative Ansicht für Saatgutbeschaffung, Direktsaat, Anzucht und Keimungsnachweise. Quellparameter bleiben von beobachteten Daten getrennt.",
    direct: "Direktsaat", transplant: "Anzucht & Verpflanzung", plantings: "Pflanzungen", methodCoverage: "Methodenabdeckung", calibrationCoverage: "Gerät / Kalibrierung", nurseryCoverage: "Anzuchtreferenz", standard: "Standard", alternate: "Alternative", manual: "Manuell / Gerät N/A",
    crop: "Kultur", date: "Aussaat", transplantDate: "Pflanzung", seeder: "Methode / Sämaschine", rows: "Reihen", calibration: "Kalibrierung", density: "Quelldichte / 30 m", spacing: "Abstand", notes: "Hinweise", sourceCell: "Quelle",
    trays: "Behälter", temp: "Keimtemperatur", germDays: "Keimtage", nurseryDays: "Tage Anzucht", technique: "Aussaattechnik", advanced: "Saatgut- & Anzuchtverwaltung öffnen",
    source: "Workbook-Referenzen: Ds Chart, Nursery & Transplant Chart, Crop Chart und Seeds · 2026/27", scopeWarning: "Nur die 32 physisch abgeglichenen Crop-Map-Pflanzungen werden einbezogen.", directWarning: "Die Direktsaatdichte bleibt in der nativen 30-m-Workbook-Einheit. Kartoffeln werden manuell gepflanzt; Maschinenkalibrierung ist N/A und kein fehlender Wert.",
    germTitle: "Keimungsnachweise", planningFallback: "Beschaffungs-Fallback", expected: "Erwartet Kultur / Sorte", seedLots: "Erfasste Saatgutlose", batches: "Beobachtete Anzucht-Chargen", unresolved: "Ungeklärt", noObserved: "Noch keine beobachteten Chargen", fallbackHelp: "90% ist der globale Workbook-Planungsfaktor für Saatgutbeschaffung. Er ist keine beobachtete Keimung und keine kulturspezifische Evidenz.",
    procurementTitle: "Vom Plan benötigt", procurementDescription: "Brutto-Beschaffungsbedarf aus dem abgeglichenen Pflanzplan. Vorhandener Bestand wird noch nicht abgezogen.", inventoryLater: "Nächster Schritt: Bestand konsolidieren und den tatsächlichen Einkaufsfehlbestand berechnen.", seedRequired: "Saatgut für Verpflanzung", gramsRequired: "Direktsaat-Saatgut", tubersRequired: "Pflanzkartoffeln", requirement: "Benötigt", basis: "Berechnungsbasis", seedUnit: "Samen", gramUnit: "g", tuberUnit: "Knollen", explicitBasis: "Spezifische Keimrate", fallbackBasis: "90% Einkaufsfaktor", densityBasis: "Workbook-Dichte / 30 m", spacingBasis: "Manueller Abstand",
    noRows: "Keine abgeglichenen Pflanzungen.", noSource: "Keine exakte Referenz", sourceBadge: "Quelle", sequence: "Folge",
  },
} as const

const localeMap: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const dateLabel = (value: string | null, locale: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "—"

function directProfilesFor(crop: string): DirectProfile[] {
  if (POTATO_PROFILES[crop]) return [POTATO_PROFILES[crop]]
  const sourceCrop = DIRECT_SOURCE_CROP_BY_CANONICAL[crop]
  if (!sourceCrop) return []
  let rows = (directSowReference as DirectRow[]).filter((row) => row.crop === sourceCrop)
  if (crop === "Carrots") rows = rows.filter((row) => row.cultivar === "All")
  if (crop === "Peas" || crop === "Bush Beans") rows = rows.filter((row) => row.cultivar === "All")
  return rows.map((row, index) => ({
    label: crop === "Arugula" && index > 0 ? "alternate" : "standard",
    seeder: row.seeder,
    rows: String(row.rows_per_bed),
    spacing: row.spacing_cm,
    calibration: row.calibration,
    density: row.density_30m,
    notes: `${row.cultivar}${row.notes ? ` · ${row.notes}` : ""}`,
    source: `Ds Chart · ${row.crop} / ${row.cultivar}`,
    applicableCalibration: true,
  }))
}

function addProcurementLine(map: Map<string, ProcurementLine>, crop: string, demand: ProcurementDemand) {
  if (demand.value == null || !demand.basis) return
  const key = `${crop}|${demand.unit}|${demand.basis}`
  const current = map.get(key)
  map.set(key, { crop, value: (current?.value ?? 0) + demand.value, unit: demand.unit, basis: demand.basis })
}

export default function DietrichPropagationPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage(); const lang: Locale = language; const text = copy[lang]; const locale = localeMap[lang]
  const [plans, setPlans] = useState<Plan[]>([]), [cycles, setCycles] = useState<Cycle[]>([]), [successions, setSuccessions] = useState<Succession[]>([]), [allocations, setAllocations] = useState<Allocation[]>([]), [cropLibrary, setCropLibrary] = useState<CropLibraryRow[]>([])
  const [seedLots, setSeedLots] = useState<number | null>(null), [nurseryBatches, setNurseryBatches] = useState<number | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)

  useEffect(() => { let live = true; setLoading(true); setError(null); void Promise.all([
    supabase.from("orchard_game_plans").select("id,season,status").order("start_date", { ascending: false }),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,cycle_type"),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_bed_m,planned_plants,germination_rate_pct,seeds_per_plant,crop_library_id,status").neq("status", "cancelled").order("planned_sow_date"),
    supabase.from("orchard_bed_allocations").select("crop_succession_id"),
    supabase.from("orchard_crop_library").select("id,germination_rate_pct,seeds_per_plant"),
    supabase.from("orchard_seed_lots").select("id", { count: "exact", head: true }),
    supabase.from("orchard_nursery_batches").select("id", { count: "exact", head: true }),
  ]).then(([p, c, s, a, library, lots, batches]) => { if (!live) return; const first = p.error ?? c.error ?? s.error ?? a.error ?? library.error ?? lots.error ?? batches.error; if (first) { setError(first.message); setLoading(false); return } setPlans((p.data ?? []) as Plan[]); setCycles((c.data ?? []) as Cycle[]); setSuccessions((s.data ?? []) as Succession[]); setAllocations((a.data ?? []) as Allocation[]); setCropLibrary((library.data ?? []) as CropLibraryRow[]); setSeedLots(lots.count ?? 0); setNurseryBatches(batches.count ?? 0); setLoading(false) }); return () => { live = false } }, [supabase])

  const requested = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("game_plan") : null
  const plan = plans.find((p) => p.id === requested) ?? plans.find((p) => p.status === "active") ?? plans.find((p) => p.status === "draft") ?? plans[0] ?? null
  const scopedCycles = plan ? cycles.filter((c) => c.game_plan_id === plan.id) : []
  const cycleById = new Map(scopedCycles.map((c) => [c.id, c]))
  const allocatedSuccessionIds = new Set(allocations.map((item) => item.crop_succession_id))
  const scopedSuccessions = successions.filter((s) => cycleById.has(s.crop_cycle_id) && allocatedSuccessionIds.has(s.id))
  const directPlans = scopedSuccessions.filter((s) => cycleById.get(s.crop_cycle_id)?.cycle_type === "direct_sow")
  const transplantPlans = scopedSuccessions.filter((s) => cycleById.get(s.crop_cycle_id)?.cycle_type === "transplant")
  const libraryById = new Map(cropLibrary.map((row) => [row.id, row]))
  const nurseryByCycle = new Map((nurseryReference as NurseryRow[]).map((row) => [row.cycle_name, row]))
  const directMethodCovered = directPlans.filter((s) => directProfilesFor(cycleById.get(s.crop_cycle_id)?.crop_name ?? "").length > 0).length
  const calibrationApplicable = directPlans.filter((s) => directProfilesFor(cycleById.get(s.crop_cycle_id)?.crop_name ?? "").some((profile) => profile.applicableCalibration)).length
  const calibrationCovered = directPlans.filter((s) => directProfilesFor(cycleById.get(s.crop_cycle_id)?.crop_name ?? "").some((profile) => profile.applicableCalibration && profile.calibration !== "N/A")).length
  const transplantCovered = transplantPlans.filter((s) => nurseryByCycle.has(cycleById.get(s.crop_cycle_id)?.crop_name ?? "")).length
  const advancedHref = `/${language}/orchard/nursery${plan ? `?game_plan=${encodeURIComponent(plan.id)}` : ""}`
  const profileLabel = (label: DirectProfile["label"]) => label === "standard" ? text.standard : label === "alternate" ? text.alternate : text.manual

  const procurementMap = new Map<string, ProcurementLine>()
  for (const succession of transplantPlans) {
    const cycle = cycleById.get(succession.crop_cycle_id)
    if (!cycle) continue
    const library = succession.crop_library_id ? libraryById.get(succession.crop_library_id) : null
    const demand = estimateTransplantProcurement({
      plannedPlants: succession.planned_plants,
      seedsPerPlant: succession.seeds_per_plant ?? library?.seeds_per_plant ?? null,
      germinationRatePct: succession.germination_rate_pct ?? library?.germination_rate_pct ?? null,
      fallbackGerminationRatePct: ORCHARD_GERMINATION_PLANNING_REFERENCE.planningFallbackPct,
    })
    addProcurementLine(procurementMap, cycle.crop_name, demand)
  }
  for (const succession of directPlans) {
    const cycle = cycleById.get(succession.crop_cycle_id)
    if (!cycle) continue
    const potato = POTATO_PROFILES[cycle.crop_name]
    if (potato) {
      addProcurementLine(procurementMap, cycle.crop_name, estimateTuberProcurement({ plannedBedM: succession.planned_bed_m, spacingCm: parseCentimeters(potato.spacing) }))
      continue
    }
    const profiles = directProfilesFor(cycle.crop_name)
    const profile = profiles.find((item) => item.label === "standard") ?? profiles[0]
    addProcurementLine(procurementMap, cycle.crop_name, estimateDirectProcurement({ plannedBedM: succession.planned_bed_m, densityG: parseApproxGrams(profile?.density), referenceBedM: 30 }))
  }
  const procurementLines = Array.from(procurementMap.values()).sort((a, b) => a.unit.localeCompare(b.unit) || a.crop.localeCompare(b.crop))
  const procurementTotals = procurementLines.reduce((totals, row) => ({ ...totals, [row.unit]: (totals[row.unit] ?? 0) + row.value }), {} as Partial<Record<ProcurementUnit, number>>)
  const basisLabel = (basis: ProcurementBasis) => basis === "explicit_germination" ? text.explicitBasis : basis === "workbook_global_fallback" ? text.fallbackBasis : basis === "direct_sow_density" ? text.densityBasis : text.spacingBasis
  const unitLabel = (unit: ProcurementUnit) => unit === "seed_count" ? text.seedUnit : unit === "g" ? text.gramUnit : text.tuberUnit
  const formatValue = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 })

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-8 max-w-4xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{text.eyebrow}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season ? <Badge variant="secondary">{plan.season}</Badge> : null}</div><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{text.description}</p></header>
    {loading ? <div className="py-12 text-sm text-muted-foreground">…</div> : error ? <div className="border border-[rgba(236,43,2,.42)] bg-[rgba(236,43,2,.12)] p-4 text-sm text-[#ffb19f]">{error}</div> : <div className="space-y-9">
      <section className="grid gap-px bg-[var(--bs-divider-subtle)] sm:grid-cols-2 xl:grid-cols-4"><Metric label={text.methodCoverage} value={`${directMethodCovered}/${directPlans.length}`}/><Metric label={text.calibrationCoverage} value={`${calibrationCovered}/${calibrationApplicable}`}/><Metric label={text.nurseryCoverage} value={`${transplantCovered}/${transplantPlans.length}`}/><Metric label={text.plantings} value={String(scopedSuccessions.length)}/></section>
      <div className="flex gap-3 border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] p-4 text-sm text-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-cool-sage)]"/><span>{text.scopeWarning}</span></div>

      <section data-testid="orchard-plan-procurement"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><ShoppingBasket className="h-5 w-5 text-[var(--bs-cool-sage)]"/><h2 className="text-2xl font-normal">{text.procurementTitle}</h2></div><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{text.procurementDescription}</p></div><Badge variant="outline">{scopedSuccessions.length} {text.plantings}</Badge></div>
        <div className="grid gap-px bg-[var(--bs-divider-subtle)] md:grid-cols-3"><ProcurementMetric label={text.seedRequired} value={formatValue(procurementTotals.seed_count ?? 0)} unit={text.seedUnit}/><ProcurementMetric label={text.gramsRequired} value={formatValue(procurementTotals.g ?? 0)} unit={text.gramUnit}/><ProcurementMetric label={text.tubersRequired} value={formatValue(procurementTotals.tuber_count ?? 0)} unit={text.tuberUnit}/></div>
        <div className="mt-px overflow-x-auto bg-[var(--bs-divider-subtle)]"><table className="w-full min-w-[720px] border-collapse text-left"><thead className="bg-[var(--bs-bg-secondary)] text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">{text.crop}</th><th className="px-4 py-3 font-medium">{text.requirement}</th><th className="px-4 py-3 font-medium">{text.basis}</th></tr></thead><tbody>{procurementLines.map((row) => <tr key={`${row.crop}-${row.unit}-${row.basis}`} className="border-t border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]"><td className="px-4 py-3 text-sm font-medium">{row.crop}</td><td className="px-4 py-3 text-sm tabular-nums">{formatValue(row.value)} <span className="text-muted-foreground">{unitLabel(row.unit)}</span></td><td className="px-4 py-3 text-xs text-muted-foreground">{basisLabel(row.basis)}</td></tr>)}</tbody></table></div>
        <div className="mt-4 border-l-2 border-[var(--bs-cool-sage)] pl-4 text-sm leading-6 text-muted-foreground">{text.inventoryLater}</div>
      </section>

      <section><div className="mb-4"><h2 className="text-2xl font-normal">{text.direct}</h2><p className="mt-1 text-sm text-muted-foreground">{directPlans.length} {text.plantings} · {directMethodCovered}/{directPlans.length} {text.methodCoverage} · {calibrationCovered}/{calibrationApplicable} {text.calibrationCoverage}</p></div><div className="mb-4 flex gap-3 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground"><CircleAlert className="mt-1 h-4 w-4 shrink-0"/><span>{text.directWarning}</span></div>{directPlans.length === 0 ? <p className="text-sm text-muted-foreground">{text.noRows}</p> : <div className="space-y-2">{directPlans.map((s) => { const cycle = cycleById.get(s.crop_cycle_id)!; const profiles = directProfilesFor(cycle.crop_name); return <article key={s.id} className="bg-[var(--bs-surface-primary)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="font-medium">{cycle.crop_name}</strong><p className="mt-1 text-xs text-muted-foreground">{text.sequence} {s.sequence_no} · {dateLabel(s.planned_sow_date, locale)}</p></div>{profiles.length ? <Badge variant="secondary">{profiles.length > 1 ? `${profiles.length} profiles` : profileLabel(profiles[0].label)}</Badge> : <Badge variant="outline">{text.noSource}</Badge>}</div><div className="mt-4 space-y-2">{profiles.map((profile, index) => <div key={`${s.id}-${profile.seeder}-${index}`} className="border border-[var(--bs-divider-subtle)] p-3"><div className="mb-3 flex items-center gap-2"><Badge variant={profile.label === "standard" ? "default" : "outline"}>{profileLabel(profile.label)}</Badge><span className="text-xs text-muted-foreground">{profile.source}</span></div><div className="grid gap-3 sm:grid-cols-5"><Cell label={text.seeder} value={profile.seeder}/><Cell label={text.rows} value={profile.rows}/><Cell label={text.spacing} value={profile.spacing}/><Cell label={text.calibration} value={profile.calibration}/><Cell label={text.density} value={profile.density}/></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{profile.notes}</p></div>)}</div></article> })}</div>}</section>

      <section><div className="mb-4"><h2 className="text-2xl font-normal">{text.transplant}</h2><p className="mt-1 text-sm text-muted-foreground">{transplantPlans.length} {text.plantings} · {transplantCovered}/{transplantPlans.length} {text.nurseryCoverage}</p></div>{transplantPlans.length === 0 ? <p className="text-sm text-muted-foreground">{text.noRows}</p> : <div className="space-y-px">{transplantPlans.map((s) => { const cycle = cycleById.get(s.crop_cycle_id)!; const ref = nurseryByCycle.get(cycle.crop_name); return <article key={s.id} className="bg-[var(--bs-surface-primary)] p-4"><div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr_.75fr_.7fr_.8fr_.65fr_.65fr_1fr]"><div><div className="flex flex-wrap items-center gap-2"><strong className="font-medium">{cycle.crop_name}</strong>{ref ? <Badge variant="secondary">{text.sourceBadge}</Badge> : <Badge variant="outline">{text.noSource}</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{text.sequence} {s.sequence_no}{ref?.reference_crop ? ` · ${ref.reference_crop}` : ""}</p></div><Cell label={text.date} value={dateLabel(s.planned_sow_date, locale)}/><Cell label={text.transplantDate} value={dateLabel(s.planned_transplant_date, locale)}/><Cell label={text.trays} value={String(ref?.tray_cells ?? "—")}/><Cell label={text.temp} value={ref?.germination_temp ?? "—"}/><Cell label={text.germDays} value={String(ref?.days_to_germinate ?? "—")}/><Cell label={text.nurseryDays} value={String(ref?.days_in_nursery ?? "—")}/><Cell label={text.technique} value={ref?.seeding_technique ?? "—"}/></div>{ref && (ref.nursery_notes || ref.transplant_notes) ? <div className="mt-3 grid gap-2 border-t border-[var(--bs-divider-subtle)] pt-3 text-xs leading-5 text-muted-foreground md:grid-cols-2"><span>{ref.nursery_notes ?? ""}</span><span>{ref.transplant_notes ?? ""}</span></div> : null}</article> })}</div>}</section>

      <section><div className="mb-4 flex items-center gap-2"><Database className="h-5 w-5 text-muted-foreground"/><h2 className="text-2xl font-normal">{text.germTitle}</h2></div><div className="grid gap-px bg-[var(--bs-divider-subtle)] md:grid-cols-4"><Evidence label={text.planningFallback} value={`${ORCHARD_GERMINATION_PLANNING_REFERENCE.planningFallbackPct}%`} detail={`Seeds!J4:J30 · ${ORCHARD_GERMINATION_PLANNING_REFERENCE.operationalStatus}`}/><Evidence label={text.expected} value={text.unresolved} detail="crop/cultivar-specific evidence pending"/><Evidence label={text.seedLots} value={String(seedLots ?? 0)} detail="orchard_seed_lots"/><Evidence label={text.batches} value={String(nurseryBatches ?? 0)} detail={nurseryBatches ? "emerged_count / seeds_sown" : text.noObserved}/></div><div className="mt-4 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-sm leading-6 text-muted-foreground">{text.fallbackHelp}</div></section>

      <div className="flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm font-medium text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
    </div>}
  </main></AppLayout>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl tabular-nums">{value}</p></div> }
function ProcurementMetric({ label, value, unit }: { label: string; value: string; unit: string }) { return <div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl tabular-nums">{value} <span className="text-sm text-muted-foreground">{unit}</span></p></div> }
function Cell({ label, value }: { label: string; value: string }) { return <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm">{value}</p></div> }
function Evidence({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl">{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p></div> }
