"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarDays, CheckCircle2, ChevronDown, CircleAlert, Database, PackageCheck, ShoppingBasket, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { cropChipStyle, cropColor } from "@/lib/orchard/crop-identity"
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
type CropLibraryRow = { id: string; crop_name: string; crop_family: string | null; germination_rate_pct: number | null; seeds_per_plant: number | null }
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
    eyebrow: "Orchard · Plan demand", title: "Seeds & transplants", description: "Start with what the reconciled field plan requires us to buy. Sowing method, nursery parameters and evidence stay available as progressive detail instead of competing with the purchase decision.",
    direct: "Direct sow", transplant: "Nursery & transplant", plantings: "plantings", methodCoverage: "method coverage", calibrationCoverage: "equipment / calibration", nurseryCoverage: "nursery reference", standard: "Standard", alternate: "Alternative", manual: "Manual / N/A equipment",
    crop: "Crop", date: "Sow", transplantDate: "Transplant", seeder: "Method / seeder", rows: "Rows", calibration: "Calibration", density: "Source density / 30 m", spacing: "Spacing", notes: "Notes", trays: "Container", temp: "Germination temp", germDays: "Days to germinate", nurseryDays: "Days in nursery", technique: "Seeding technique", advanced: "Open seed & nursery management",
    source: "Workbook references: Ds Chart, Nursery & Transplant Chart, Crop Chart and Seeds · 2026/27", scopeWarning: "Only the 32 physically reconciled Crop Map plantings are included.", directWarning: "Direct-sowing density stays in the workbook's native 30 m unit. Potatoes are manual, so seeder calibration is N/A rather than missing.",
    germTitle: "Germination evidence", planningFallback: "Procurement fallback", expected: "Crop / cultivar expected", seedLots: "Seed lots recorded", batches: "Nursery batches observed", unresolved: "Unresolved", noObserved: "No observed batches yet", fallbackHelp: "90% is the workbook-global seed-purchase planning factor. It is not observed germination and is not treated as crop-specific evidence.",
    procurementTitle: "Required by the plan", procurementDescription: "Gross purchasing requirement. Current inventory has not been deducted yet.", inventoryLater: "Stock still needs to be consolidated. The plan requirement remains unchanged; the next calculation will be required − available = buy.", seedRequired: "Transplant seeds", gramsRequired: "Direct-sow seed", tubersRequired: "Seed tubers", requirement: "Required", basis: "Calculation basis", seedUnit: "seeds", gramUnit: "g", tuberUnit: "tubers", explicitBasis: "Specific germination", fallbackBasis: "90% purchase factor", densityBasis: "Workbook density / 30 m", spacingBasis: "Manual spacing",
    noRows: "No reconciled plantings.", noSource: "No exact reference", sourceBadge: "Source", sequence: "Succession", upcoming: "Next sowings", stockPending: "Stock not consolidated", technical: "Method & evidence", expand: "Open details", planReady: "Plan demand ready",
  },
  es: {
    eyebrow: "Huerto · Demanda del plan", title: "Semillas y trasplantes", description: "Primero vemos qué exige comprar el plan de campo reconciliado. Método de siembra, parámetros de almácigo y evidencia quedan como detalle progresivo, sin competir con la decisión de compra.",
    direct: "Siembra directa", transplant: "Almácigo y trasplante", plantings: "plantaciones", methodCoverage: "cobertura método", calibrationCoverage: "equipo / calibración", nurseryCoverage: "referencia almácigo", standard: "Estándar", alternate: "Alternativa", manual: "Manual / equipo N/A",
    crop: "Cultivo", date: "Siembra", transplantDate: "Trasplante", seeder: "Método / sembradora", rows: "Filas", calibration: "Calibración", density: "Densidad fuente / 30 m", spacing: "Distancia", notes: "Notas", trays: "Contenedor", temp: "Temp. germinación", germDays: "Días a germinar", nurseryDays: "Días en almácigo", technique: "Técnica siembra", advanced: "Abrir gestión de semillas y almácigos",
    source: "Referencias workbook: Ds Chart, Nursery & Transplant Chart, Crop Chart y Seeds · 2026/27", scopeWarning: "Sólo se incluyen las 32 plantaciones físicamente reconciliadas en Crop Map.", directWarning: "La densidad de siembra directa se conserva en la unidad nativa del workbook: 30 m. Las papas son manuales; la calibración de sembradora es N/A, no un dato faltante.",
    germTitle: "Evidencia de germinación", planningFallback: "Fallback de compra", expected: "Esperada cultivo / cultivar", seedLots: "Lotes de semilla registrados", batches: "Batches de almácigo observados", unresolved: "Sin resolver", noObserved: "Aún sin batches observados", fallbackHelp: "90% es el factor global del workbook para planificar compra de semillas. No es germinación observada ni se trata como evidencia específica por cultivo.",
    procurementTitle: "Requerido por el plan", procurementDescription: "Requerimiento bruto de compra. Todavía no se descuenta el inventario disponible.", inventoryLater: "El stock aún debe consolidarse. El requerimiento del plan no cambia; el siguiente cálculo será requerido − disponible = comprar.", seedRequired: "Semillas de trasplante", gramsRequired: "Semilla siembra directa", tubersRequired: "Tubérculos semilla", requirement: "Requerido", basis: "Base de cálculo", seedUnit: "semillas", gramUnit: "g", tuberUnit: "tubérculos", explicitBasis: "Germinación específica", fallbackBasis: "Factor de compra 90%", densityBasis: "Densidad workbook / 30 m", spacingBasis: "Espaciado manual",
    noRows: "No hay plantaciones reconciliadas.", noSource: "Sin referencia exacta", sourceBadge: "Fuente", sequence: "Sucesión", upcoming: "Próximas siembras", stockPending: "Stock por consolidar", technical: "Método y evidencia", expand: "Abrir detalle", planReady: "Demanda del plan lista",
  },
  de: {
    eyebrow: "Orchard · Planbedarf", title: "Saatgut & Jungpflanzen", description: "Zuerst zeigt die Ansicht den Einkaufsbedarf des abgeglichenen Feldplans. Aussaatmethode, Anzuchtparameter und Nachweise bleiben als progressive Details verfügbar.",
    direct: "Direktsaat", transplant: "Anzucht & Verpflanzung", plantings: "Pflanzungen", methodCoverage: "Methodenabdeckung", calibrationCoverage: "Gerät / Kalibrierung", nurseryCoverage: "Anzuchtreferenz", standard: "Standard", alternate: "Alternative", manual: "Manuell / Gerät N/A",
    crop: "Kultur", date: "Aussaat", transplantDate: "Pflanzung", seeder: "Methode / Sämaschine", rows: "Reihen", calibration: "Kalibrierung", density: "Quelldichte / 30 m", spacing: "Abstand", notes: "Hinweise", trays: "Behälter", temp: "Keimtemperatur", germDays: "Keimtage", nurseryDays: "Tage Anzucht", technique: "Aussaattechnik", advanced: "Saatgut- & Anzuchtverwaltung öffnen",
    source: "Workbook-Referenzen: Ds Chart, Nursery & Transplant Chart, Crop Chart und Seeds · 2026/27", scopeWarning: "Nur die 32 physisch abgeglichenen Crop-Map-Pflanzungen werden einbezogen.", directWarning: "Die Direktsaatdichte bleibt in der nativen 30-m-Workbook-Einheit. Kartoffeln werden manuell gepflanzt; Maschinenkalibrierung ist N/A und kein fehlender Wert.",
    germTitle: "Keimungsnachweise", planningFallback: "Beschaffungs-Fallback", expected: "Erwartet Kultur / Sorte", seedLots: "Erfasste Saatgutlose", batches: "Beobachtete Anzucht-Chargen", unresolved: "Ungeklärt", noObserved: "Noch keine beobachteten Chargen", fallbackHelp: "90% ist der globale Workbook-Planungsfaktor für Saatgutbeschaffung. Er ist keine beobachtete Keimung und keine kulturspezifische Evidenz.",
    procurementTitle: "Vom Plan benötigt", procurementDescription: "Brutto-Beschaffungsbedarf. Vorhandener Bestand wurde noch nicht abgezogen.", inventoryLater: "Der Bestand muss noch konsolidiert werden. Der Planbedarf bleibt unverändert; als Nächstes gilt benötigt − verfügbar = kaufen.", seedRequired: "Saatgut für Verpflanzung", gramsRequired: "Direktsaat-Saatgut", tubersRequired: "Pflanzkartoffeln", requirement: "Benötigt", basis: "Berechnungsbasis", seedUnit: "Samen", gramUnit: "g", tuberUnit: "Knollen", explicitBasis: "Spezifische Keimrate", fallbackBasis: "90% Einkaufsfaktor", densityBasis: "Workbook-Dichte / 30 m", spacingBasis: "Manueller Abstand",
    noRows: "Keine abgeglichenen Pflanzungen.", noSource: "Keine exakte Referenz", sourceBadge: "Quelle", sequence: "Folge", upcoming: "Nächste Aussaaten", stockPending: "Bestand noch offen", technical: "Methode & Nachweise", expand: "Details öffnen", planReady: "Planbedarf bereit",
  },
} as const

const localeMap: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const dateLabel = (value: string | null, locale: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "—"
const normalize = (value: string) => value.trim().toLowerCase()
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

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
    supabase.from("orchard_crop_library").select("id,crop_name,crop_family,germination_rate_pct,seeds_per_plant").eq("is_active", true).eq("classification_scheme", "black_swan_canonical").eq("classification_code", "fundo_corcovado"),
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
  const familyByCrop = new Map(cropLibrary.map((row) => [normalize(row.crop_name), row.crop_family]))
  const familyFor = (crop: string) => familyByCrop.get(normalize(crop)) ?? null
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
    addProcurementLine(procurementMap, cycle.crop_name, estimateTransplantProcurement({ plannedPlants: succession.planned_plants, seedsPerPlant: succession.seeds_per_plant ?? library?.seeds_per_plant ?? null, germinationRatePct: succession.germination_rate_pct ?? library?.germination_rate_pct ?? null, fallbackGerminationRatePct: ORCHARD_GERMINATION_PLANNING_REFERENCE.planningFallbackPct }))
  }
  for (const succession of directPlans) {
    const cycle = cycleById.get(succession.crop_cycle_id)
    if (!cycle) continue
    const potato = POTATO_PROFILES[cycle.crop_name]
    if (potato) { addProcurementLine(procurementMap, cycle.crop_name, estimateTuberProcurement({ plannedBedM: succession.planned_bed_m, spacingCm: parseCentimeters(potato.spacing) })); continue }
    const profiles = directProfilesFor(cycle.crop_name)
    const profile = profiles.find((item) => item.label === "standard") ?? profiles[0]
    addProcurementLine(procurementMap, cycle.crop_name, estimateDirectProcurement({ plannedBedM: succession.planned_bed_m, densityG: parseApproxGrams(profile?.density), referenceBedM: 30 }))
  }
  const procurementLines = Array.from(procurementMap.values()).sort((a, b) => a.unit.localeCompare(b.unit) || a.crop.localeCompare(b.crop))
  const procurementTotals = procurementLines.reduce((totals, row) => ({ ...totals, [row.unit]: (totals[row.unit] ?? 0) + row.value }), {} as Partial<Record<ProcurementUnit, number>>)
  const basisLabel = (basis: ProcurementBasis) => basis === "explicit_germination" ? text.explicitBasis : basis === "workbook_global_fallback" ? text.fallbackBasis : basis === "direct_sow_density" ? text.densityBasis : text.spacingBasis
  const unitLabel = (unit: ProcurementUnit) => unit === "seed_count" ? text.seedUnit : unit === "g" ? text.gramUnit : text.tuberUnit
  const formatValue = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 })
  const firstSowByCrop = new Map<string, string>(); for (const succession of scopedSuccessions) { const crop = cycleById.get(succession.crop_cycle_id)?.crop_name; if (!crop) continue; const current = firstSowByCrop.get(crop); if (!current || succession.planned_sow_date < current) firstSowByCrop.set(crop, succession.planned_sow_date) }
  const upcoming = scopedSuccessions.filter((s) => s.planned_sow_date >= todayKey()).sort((a, b) => a.planned_sow_date.localeCompare(b.planned_sow_date)).slice(0, 5)
  const procurementGroups: Array<{ unit: ProcurementUnit; label: string; total: number }> = [
    { unit: "seed_count", label: text.seedRequired, total: procurementTotals.seed_count ?? 0 },
    { unit: "g", label: text.gramsRequired, total: procurementTotals.g ?? 0 },
    { unit: "tuber_count", label: text.tubersRequired, total: procurementTotals.tuber_count ?? 0 },
  ]

  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-7 sm:px-6 lg:px-8">
    <header className="mb-6 flex flex-col gap-4 border-b border-[var(--orchard-line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-normal sm:text-4xl">{text.title}</h1>{plan?.season ? <Badge variant="secondary">{plan.season}</Badge> : null}</div><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{text.description}</p></div>
      <div className="flex min-w-[230px] items-center gap-3 border-l border-[var(--orchard-line)] pl-4"><PackageCheck className="h-5 w-5 text-[var(--orchard-green)]"/><div><p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{text.planReady}</p><p className="mt-1 text-sm font-medium">{scopedSuccessions.length} {text.plantings}</p></div></div>
    </header>

    {loading ? <div className="py-12 text-sm text-muted-foreground">…</div> : error ? <div className="border border-[rgba(236,43,2,.42)] bg-[rgba(236,43,2,.12)] p-4 text-sm text-[#ffb19f]">{error}</div> : <div className="space-y-7">
      <section data-testid="orchard-plan-procurement" className="overflow-hidden border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]">
        <div className="flex flex-col gap-3 border-b border-[var(--bs-divider-subtle)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><ShoppingBasket className="h-5 w-5 text-[var(--bs-cool-sage)]"/><h2 className="text-2xl font-normal">{text.procurementTitle}</h2></div><p className="mt-1 text-sm text-muted-foreground">{text.procurementDescription}</p></div><span className="inline-flex items-center gap-2 self-start border border-[rgba(226,176,86,.28)] bg-[rgba(226,176,86,.08)] px-3 py-2 text-xs text-[#dfbd78]"><CircleAlert className="h-3.5 w-3.5"/>{text.stockPending}</span></div>
        <div className="grid lg:grid-cols-3">{procurementGroups.map((group, index) => <article key={group.unit} className={`p-5 ${index ? "border-t lg:border-l lg:border-t-0" : ""} border-[var(--bs-divider-subtle)]`}><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{group.label}</p><p className="mt-2 text-3xl tabular-nums">{formatValue(group.total)} <span className="text-sm text-muted-foreground">{unitLabel(group.unit)}</span></p><div className="mt-4 space-y-1.5">{procurementLines.filter((line) => line.unit === group.unit).map((row) => { const family = familyFor(row.crop); const color = cropColor(row.crop, family); const chip = cropChipStyle(row.crop, family); return <div key={`${row.crop}-${row.basis}`} className="grid grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--bs-divider-subtle)] py-2 last:border-b-0"><i className="h-7 w-1" style={{backgroundColor: color}}/><div className="min-w-0"><p className="truncate text-sm font-medium">{row.crop}</p><p className="mt-0.5 truncate text-[10px]" style={{color: chip.color}}>{basisLabel(row.basis)} · {dateLabel(firstSowByCrop.get(row.crop) ?? null, locale)}</p></div><p className="text-sm font-medium tabular-nums">{formatValue(row.value)} <span className="text-[10px] font-normal text-muted-foreground">{unitLabel(row.unit)}</span></p></div>})}</div></article>)}</div>
        <div className="border-t border-[var(--bs-divider-subtle)] px-5 py-3 text-xs leading-5 text-muted-foreground">{text.inventoryLater}</div>
      </section>

      <section><div className="mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[var(--orchard-green)]"/><h2 className="text-lg font-medium">{text.upcoming}</h2></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{upcoming.map((succession) => { const cycle = cycleById.get(succession.crop_cycle_id)!; const family = familyFor(cycle.crop_name); const color = cropColor(cycle.crop_name, family); const chip = cropChipStyle(cycle.crop_name, family); return <article key={succession.id} className="relative overflow-hidden border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] p-3"><i className="absolute inset-x-0 top-0 h-0.5" style={{backgroundColor: color}}/><p className="text-[10px] uppercase tracking-[.12em]" style={{color: chip.color}}>{cycle.cycle_type === "direct_sow" ? text.direct : text.transplant}</p><p className="mt-2 truncate text-sm font-medium">{cycle.crop_name}</p><p className="mt-1 text-xs tabular-nums text-muted-foreground">{dateLabel(succession.planned_sow_date, locale)} · #{succession.sequence_no}</p></article>})}</div></section>

      <div className="flex gap-3 border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] p-4 text-sm text-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-cool-sage)]"/><span>{text.scopeWarning}</span></div>

      <details data-orchard-propagation-section className="group border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden"><div><h2 className="text-xl font-medium">{text.direct}</h2><p className="mt-1 text-xs text-muted-foreground">{directPlans.length} {text.plantings} · {directMethodCovered}/{directPlans.length} {text.methodCoverage} · {calibrationCovered}/{calibrationApplicable} {text.calibrationCoverage}</p></div><ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"/></summary><div className="border-t border-[var(--bs-divider-subtle)] p-4"><div className="mb-4 flex gap-3 border-l-2 border-[var(--bs-warm-amber)] pl-4 text-xs leading-5 text-muted-foreground"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0"/><span>{text.directWarning}</span></div>{directPlans.length === 0 ? <p className="text-sm text-muted-foreground">{text.noRows}</p> : <div className="space-y-2">{directPlans.map((s) => { const cycle = cycleById.get(s.crop_cycle_id)!; const profiles = directProfilesFor(cycle.crop_name); const family = familyFor(cycle.crop_name); const color = cropColor(cycle.crop_name, family); const primary = profiles[0]; return <details key={s.id} className="group/row border border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)]"><summary className="grid cursor-pointer list-none gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_.7fr_1fr_auto] sm:items-center marker:content-none [&::-webkit-details-marker]:hidden"><div className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor: color}}/><div className="min-w-0"><p className="truncate text-sm font-medium">{cycle.crop_name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{text.sequence} {s.sequence_no}</p></div></div><p className="text-xs tabular-nums">{dateLabel(s.planned_sow_date, locale)}</p><p className="truncate text-xs text-muted-foreground">{primary?.seeder ?? text.noSource}{profiles.length > 1 ? ` +${profiles.length - 1}` : ""}</p><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/row:rotate-180"/></summary><div className="space-y-2 border-t border-[var(--bs-divider-subtle)] p-3">{profiles.map((profile, index) => <div key={`${s.id}-${profile.seeder}-${index}`} className="border border-[var(--bs-divider-subtle)] p-3"><div className="mb-3 flex flex-wrap items-center gap-2"><Badge variant={profile.label === "standard" ? "default" : "outline"}>{profileLabel(profile.label)}</Badge><span className="text-[10px] text-muted-foreground">{profile.source}</span></div><div className="grid gap-3 sm:grid-cols-5"><Cell label={text.seeder} value={profile.seeder}/><Cell label={text.rows} value={profile.rows}/><Cell label={text.spacing} value={profile.spacing}/><Cell label={text.calibration} value={profile.calibration}/><Cell label={text.density} value={profile.density}/></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{profile.notes}</p></div>)}</div></details>})}</div>}</div></details>

      <details data-orchard-propagation-section className="group border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden"><div><h2 className="text-xl font-medium">{text.transplant}</h2><p className="mt-1 text-xs text-muted-foreground">{transplantPlans.length} {text.plantings} · {transplantCovered}/{transplantPlans.length} {text.nurseryCoverage}</p></div><ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"/></summary><div className="border-t border-[var(--bs-divider-subtle)]">{transplantPlans.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{text.noRows}</p> : transplantPlans.map((s) => { const cycle = cycleById.get(s.crop_cycle_id)!; const ref = nurseryByCycle.get(cycle.crop_name); const family = familyFor(cycle.crop_name); const color = cropColor(cycle.crop_name, family); return <details key={s.id} className="group/row border-b border-[var(--bs-divider-subtle)] last:border-b-0"><summary className="grid cursor-pointer list-none gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_.75fr_.75fr_.7fr_.7fr_auto] md:items-center marker:content-none [&::-webkit-details-marker]:hidden"><div className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor: color}}/><div className="min-w-0"><p className="truncate text-sm font-medium">{cycle.crop_name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{text.sequence} {s.sequence_no}{ref?.reference_crop ? ` · ${ref.reference_crop}` : ""}</p></div></div><CellCompact label={text.date} value={dateLabel(s.planned_sow_date, locale)}/><CellCompact label={text.transplantDate} value={dateLabel(s.planned_transplant_date, locale)}/><CellCompact label={text.trays} value={String(ref?.tray_cells ?? "—")}/><CellCompact label={text.nurseryDays} value={String(ref?.days_in_nursery ?? "—")}/><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/row:rotate-180"/></summary><div className="grid gap-4 border-t border-[var(--bs-divider-subtle)] bg-[var(--bs-bg-secondary)] p-4 sm:grid-cols-3"><Cell label={text.temp} value={ref?.germination_temp ?? "—"}/><Cell label={text.germDays} value={String(ref?.days_to_germinate ?? "—")}/><Cell label={text.technique} value={ref?.seeding_technique ?? "—"}/>{ref && (ref.nursery_notes || ref.transplant_notes) ? <div className="sm:col-span-3 grid gap-2 border-t border-[var(--bs-divider-subtle)] pt-3 text-xs leading-5 text-muted-foreground md:grid-cols-2"><span>{ref.nursery_notes ?? ""}</span><span>{ref.transplant_notes ?? ""}</span></div> : null}</div></details> })}</div></details>

      <details data-orchard-propagation-section className="group border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden"><div className="flex items-center gap-2"><Database className="h-4 w-4 text-muted-foreground"/><div><h2 className="text-xl font-medium">{text.germTitle}</h2><p className="mt-1 text-xs text-muted-foreground">{text.technical}</p></div></div><ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"/></summary><div className="grid gap-px border-t border-[var(--bs-divider-subtle)] bg-[var(--bs-divider-subtle)] md:grid-cols-4"><Evidence label={text.planningFallback} value={`${ORCHARD_GERMINATION_PLANNING_REFERENCE.planningFallbackPct}%`} detail={`Seeds!J4:J30 · ${ORCHARD_GERMINATION_PLANNING_REFERENCE.operationalStatus}`}/><Evidence label={text.expected} value={text.unresolved} detail="crop/cultivar-specific evidence pending"/><Evidence label={text.seedLots} value={String(seedLots ?? 0)} detail="orchard_seed_lots"/><Evidence label={text.batches} value={String(nurseryBatches ?? 0)} detail={nurseryBatches ? "emerged_count / seeds_sown" : text.noObserved}/><div className="md:col-span-4 bg-[var(--bs-surface-primary)] px-5 py-3 text-xs leading-5 text-muted-foreground">{text.fallbackHelp}</div></div></details>

      <footer className="flex flex-col gap-3 border-t border-[var(--bs-divider-subtle)] pt-5 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.source}</span><Link href={advancedHref} className="inline-flex items-center gap-2 text-sm font-medium text-foreground">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></footer>
    </div>}
  </main></AppLayout>
}

function Cell({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-1 text-sm">{value}</p></div> }
function CellCompact({ label, value }: { label: string; value: string }) { return <div><span className="block text-[9px] uppercase tracking-[.10em] text-muted-foreground md:hidden">{label}</span><span className="text-xs tabular-nums">{value}</span></div> }
function Evidence({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="bg-[var(--bs-surface-primary)] p-5"><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl">{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p></div> }
