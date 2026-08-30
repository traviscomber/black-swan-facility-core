"use client"

import { Database, History, ShieldCheck, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type LibraryLocale = "en" | "es" | "de"

export type BlackSwanSeasonIntel = {
  season: string
  harvestRecords: number
  firstHarvest: string | null
  lastHarvest: string | null
  actualByUnit: Record<string, number>
  cultivars: string[]
  measurementStatus: string | null
  signal: string | null
  comparability: string | null
}

export type BlackSwanCropIntel = {
  observedCount: number
  seasons: BlackSwanSeasonIntel[]
  cultivars: string[]
}

const copy = {
  en: {
    title: "Corcovado intelligence",
    realData: "Canonical farm evidence",
    seasons: "real seasons",
    harvests: "harvest records",
    cultivars: "Cultivars used at Corcovado",
    window: "Recorded harvest window",
    measured: "Recorded output",
    complete: "Closed measurement window",
    censored: "Partial measurement window",
    harvestOnly: "Harvest evidence only",
    related: "Related profile — not equivalent",
    confidence: "Evidence confidence",
    high: "High · two real seasons",
    medium: "Medium · one real season",
    limited: "Limited · partial/related evidence",
    signal: "Historical signal",
    noFinalSignal: "No final performance conclusion",
  },
  es: {
    title: "Inteligencia Corcovado",
    realData: "Evidencia canónica del fundo",
    seasons: "temporadas reales",
    harvests: "registros de cosecha",
    cultivars: "Cultivares usados en Corcovado",
    window: "Ventana de cosecha registrada",
    measured: "Producción registrada",
    complete: "Ventana de medición cerrada",
    censored: "Ventana de medición parcial",
    harvestOnly: "Sólo evidencia de cosecha",
    related: "Perfil relacionado — no equivalente",
    confidence: "Confianza de evidencia",
    high: "Alta · dos temporadas reales",
    medium: "Media · una temporada real",
    limited: "Limitada · evidencia parcial/relacionada",
    signal: "Señal histórica",
    noFinalSignal: "Sin conclusión final de rendimiento",
  },
  de: {
    title: "Corcovado-Intelligenz",
    realData: "Kanonische Betriebsdaten",
    seasons: "reale Saisons",
    harvests: "Ernteeinträge",
    cultivars: "In Corcovado eingesetzte Sorten",
    window: "Erfasstes Erntefenster",
    measured: "Erfasste Produktion",
    complete: "Messfenster abgeschlossen",
    censored: "Messfenster unvollständig",
    harvestOnly: "Nur Erntenachweis",
    related: "Verwandtes Profil — nicht gleichwertig",
    confidence: "Evidenzvertrauen",
    high: "Hoch · zwei reale Saisons",
    medium: "Mittel · eine reale Saison",
    limited: "Begrenzt · partielle/verwandte Evidenz",
    signal: "Historisches Signal",
    noFinalSignal: "Keine abschließende Leistungsbewertung",
  },
} as const

const localeMap: Record<LibraryLocale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }

function formatDate(value: string | null, lang: LibraryLocale) {
  if (!value) return "—"
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(localeMap[lang], { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

function formatActual(values: Record<string, number>, lang: LibraryLocale) {
  const nf = new Intl.NumberFormat(localeMap[lang], { maximumFractionDigits: 2 })
  const labels: Record<LibraryLocale, Record<string, string>> = {
    en: { kg: "kg", unit: "units", Unidad: "units", Kilo: "kg" },
    es: { kg: "kg", unit: "unid.", Unidad: "unid.", Kilo: "kg" },
    de: { kg: "kg", unit: "Stk.", Unidad: "Stk.", Kilo: "kg" },
  }
  return Object.entries(values)
    .filter(([, value]) => Number.isFinite(value))
    .map(([unit, value]) => `${nf.format(value)} ${labels[lang][unit] ?? unit}`)
    .join(" · ") || "—"
}

function isLimited(season: BlackSwanSeasonIntel) {
  return Boolean(season.comparability?.includes("related") || season.measurementStatus?.includes("right_censored") || season.measurementStatus?.includes("incomplete"))
}

function statusLabel(season: BlackSwanSeasonIntel, lang: LibraryLocale) {
  const text = copy[lang]
  if (season.comparability?.includes("related")) return text.related
  if (season.measurementStatus?.includes("right_censored") || season.measurementStatus?.includes("incomplete")) return text.censored
  if (season.measurementStatus?.includes("harvest_measurement_only")) return text.harvestOnly
  if (season.measurementStatus === "measurement_window_closed") return text.complete
  return text.realData
}

function confidenceLabel(intel: BlackSwanCropIntel, lang: LibraryLocale) {
  const text = copy[lang]
  if (intel.seasons.some(isLimited)) return text.limited
  if (intel.seasons.length >= 2) return text.high
  return text.medium
}

function humanSignal(value: string | null) {
  if (!value) return null
  return value.replaceAll("_", " ")
}

export function BlackSwanIntelligence({ intel, lang }: { intel: BlackSwanCropIntel | null; lang: LibraryLocale }) {
  if (!intel || intel.seasons.length === 0) return null
  const text = copy[lang]
  const totalHarvests = intel.seasons.reduce((sum, season) => sum + season.harvestRecords, 0)

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.045] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-emerald-500" />
          <p className="text-xs font-semibold">{text.title}</p>
        </div>
        <Badge variant="outline" className="border-emerald-500/30 text-[10px]">
          <ShieldCheck className="mr-1 h-3 w-3" />{text.realData}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{intel.seasons.length} {text.seasons}</span><span>·</span><span>{totalHarvests} {text.harvests}</span>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-background/35 p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{text.confidence}</p>
        <p className="mt-1 text-xs font-medium">{confidenceLabel(intel, lang)}</p>
      </div>

      {intel.cultivars.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{text.cultivars}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {intel.cultivars.slice(0, 5).map((cultivar) => <Badge key={cultivar} variant="secondary" className="text-[10px]">{cultivar}</Badge>)}
            {intel.cultivars.length > 5 && <Badge variant="secondary" className="text-[10px]">+{intel.cultivars.length - 5}</Badge>}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {intel.seasons.map((season) => {
          const signal = isLimited(season) ? null : humanSignal(season.signal)
          return (
            <div key={season.season} className="rounded-lg border border-white/10 bg-background/40 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium"><History className="h-3.5 w-3.5" />{season.season}</div>
                <span className="text-right text-[10px] text-muted-foreground">{statusLabel(season, lang)}</span>
              </div>
              <div className="mt-2 grid gap-1 text-[11px] sm:grid-cols-2">
                <div><span className="text-muted-foreground">{text.measured}: </span><span className="font-medium">{formatActual(season.actualByUnit, lang)}</span></div>
                <div><span className="text-muted-foreground">{text.window}: </span><span className="font-medium">{formatDate(season.firstHarvest, lang)} – {formatDate(season.lastHarvest, lang)}</span></div>
              </div>
              <div className="mt-2 flex items-start gap-1.5 text-[10px]">
                {isLimited(season) && <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />}
                <span className="text-muted-foreground">{text.signal}: </span>
                <span className="font-medium">{signal ?? text.noFinalSignal}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
