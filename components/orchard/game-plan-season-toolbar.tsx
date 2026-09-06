"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Layers3, Plus, SlidersHorizontal, Sprout } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"


type Locale = "en" | "es" | "de"
type TypeFilter = "all" | "direct_sow" | "transplant"

const copy = {
  en: {
    crops: "Crops",
    allCrops: "All crops",
    filters: "Filters",
    allTypes: "All planting types",
    direct: "Direct sow",
    transplant: "Transplant",
    successions: "Successions",
    collapse: "Collapse successions",
    expand: "Expand successions",
    actions: "Actions",
    edit: "Edit Game Plan",
    cropMap: "Open Crop Map",
    add: "Add planting(s)",
  },
  es: {
    crops: "Cultivos",
    allCrops: "Todos los cultivos",
    filters: "Filtros",
    allTypes: "Todos los tipos de plantación",
    direct: "Siembra directa",
    transplant: "Trasplante",
    successions: "Sucesiones",
    collapse: "Contraer sucesiones",
    expand: "Expandir sucesiones",
    actions: "Acciones",
    edit: "Editar plan de cultivo",
    cropMap: "Abrir Mapa de Cultivos",
    add: "Agregar plantación(es)",
  },
  de: {
    crops: "Kulturen",
    allCrops: "Alle Kulturen",
    filters: "Filter",
    allTypes: "Alle Pflanztypen",
    direct: "Direktsaat",
    transplant: "Verpflanzung",
    successions: "Folgen",
    collapse: "Folgen einklappen",
    expand: "Folgen ausklappen",
    actions: "Aktionen",
    edit: "Game Plan bearbeiten",
    cropMap: "Anbaukarte öffnen",
    add: "Pflanzung(en) hinzufügen",
  },
} as const

function cropNameFromDetail(detail: HTMLDetailsElement) {
  const label = detail.querySelector("summary p")?.textContent?.trim() ?? ""
  return label.split(" · ")[0]?.trim() ?? label
}

function detailMatchesType(detail: HTMLDetailsElement, filter: TypeFilter, text: (typeof copy)[Locale]) {
  if (filter === "all") return true
  const summary = detail.querySelector("summary")?.textContent?.toLowerCase() ?? ""
  const needle = filter === "direct_sow" ? text.direct.toLowerCase() : text.transplant.toLowerCase()
  return summary.includes(needle)
}

export function GamePlanSeasonToolbar() {
  const { language } = useLanguage()
  const locale: Locale = language
  const text = copy[locale]
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [cropFilter, setCropFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [cropNames, setCropNames] = useState<string[]>([])
  const [expanded, setExpanded] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)

  const params = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams()
    return new URLSearchParams(window.location.search)
  }, [])
  const gamePlan = params.get("game_plan")
  const suffix = gamePlan ? `?game_plan=${encodeURIComponent(gamePlan)}` : ""
  const advancedHref = `/${language}/orchard/game-plan${suffix}`
  const cropMapHref = `/${language}/orchard/crop-map/overview${suffix}`

  useEffect(() => {
    const pageMain = document.querySelector<HTMLElement>("main > main")
    const header = pageMain?.querySelector<HTMLElement>(":scope > header")
    if (!pageMain || !header) return
    const node = document.createElement("div")
    node.dataset.gamePlanSeasonToolbar = "true"
    header.insertAdjacentElement("afterend", node)
    setHost(node)
    return () => node.remove()
  }, [])

  useEffect(() => {
    if (!host) return
    const readDetails = () => {
      const details = Array.from(document.querySelectorAll<HTMLDetailsElement>("details[data-orchard-season-crop]"))
      const names = [...new Set(details.map(cropNameFromDetail).filter(Boolean))].sort((a, b) => a.localeCompare(b))
      setCropNames(current => current.join("\u0000") === names.join("\u0000") ? current : names)
      for (const detail of details) {
        const cropMatches = cropFilter === "all" || cropNameFromDetail(detail) === cropFilter
        const typeMatches = detailMatchesType(detail, typeFilter, text)
        detail.style.display = cropMatches && typeMatches ? "" : "none"
      }
    }
    readDetails()
    const observer = new MutationObserver(readDetails)
    const pageMain = document.querySelector<HTMLElement>("main > main")
    if (pageMain) observer.observe(pageMain, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      document.querySelectorAll<HTMLDetailsElement>("details[data-orchard-season-crop]").forEach(detail => { detail.style.display = "" })
    }
  }, [host, cropFilter, typeFilter, text])

  const toggleSuccessions = () => {
    const next = !expanded
    document.querySelectorAll<HTMLDetailsElement>("details[data-orchard-season-crop]").forEach(detail => { detail.open = next })
    setExpanded(next)
  }

  if (!host) return null

  return createPortal(
    <section className="relative z-40 border-b border-[var(--orchard-line)] bg-white px-4 py-2.5 sm:px-6 lg:px-8" aria-label="Game Plan controls">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative inline-flex min-h-9 items-center border border-[var(--orchard-line)] bg-white text-sm">
          <Sprout className="ml-3 h-4 w-4 text-muted-foreground" />
          <span className="sr-only">{text.crops}</span>
          <select value={cropFilter} onChange={event => setCropFilter(event.target.value)} className="h-9 min-w-[150px] appearance-none bg-transparent pl-2 pr-8 text-sm outline-none">
            <option value="all">{text.crops}</option>
            {cropNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground" />
        </label>

        <div className="relative">
          <button type="button" onClick={() => { setFiltersOpen(value => !value); setActionsOpen(false) }} className={`inline-flex min-h-9 items-center gap-2 border px-3 text-sm ${typeFilter !== "all" ? "border-[var(--orchard-green)] bg-[var(--orchard-green)]/10" : "border-[var(--orchard-line)] bg-white"}`}>
            <SlidersHorizontal className="h-4 w-4" />{text.filters}<ChevronDown className="h-3.5 w-3.5" />
          </button>
          {filtersOpen && <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-56 border border-[var(--orchard-line)] bg-white p-1 shadow-xl">
            {(["all", "direct_sow", "transplant"] as TypeFilter[]).map(value => <button key={value} type="button" onClick={() => { setTypeFilter(value); setFiltersOpen(false) }} className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--bs-surface-secondary)] ${typeFilter === value ? "font-medium text-[var(--orchard-green)]" : ""}`}>
              <span>{value === "all" ? text.allTypes : value === "direct_sow" ? text.direct : text.transplant}</span>{typeFilter === value ? <span>✓</span> : null}
            </button>)}
          </div>}
        </div>

        <button type="button" onClick={toggleSuccessions} title={expanded ? text.collapse : text.expand} className="inline-flex min-h-9 items-center gap-2 border border-[var(--orchard-line)] bg-white px-3 text-sm">
          <Layers3 className="h-4 w-4" />{text.successions}
        </button>

        <div className="relative">
          <button type="button" onClick={() => { setActionsOpen(value => !value); setFiltersOpen(false) }} className="inline-flex min-h-9 items-center gap-2 border border-[var(--orchard-line)] bg-white px-3 text-sm">
            {text.actions}<ChevronDown className="h-3.5 w-3.5" />
          </button>
          {actionsOpen && <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-52 border border-[var(--orchard-line)] bg-white p-1 shadow-xl">
            <Link href={advancedHref} className="block px-3 py-2 text-sm hover:bg-[var(--bs-surface-secondary)]">{text.edit}</Link>
            <Link href={cropMapHref} className="block px-3 py-2 text-sm hover:bg-[var(--bs-surface-secondary)]">{text.cropMap}</Link>
          </div>}
        </div>

        <Link href={advancedHref} className="ml-auto inline-flex min-h-9 items-center gap-2 bg-[var(--orchard-green)] px-4 text-sm font-medium text-[#10130f]">
          <Plus className="h-4 w-4" />{text.add}
        </Link>
      </div>
    </section>,
    host,
  )
}
