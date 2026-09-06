"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { HelpCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Plan = { id: string; name: string; season: string | null; status: string }

type RouteTitle = {
  prefix: string
  title: Record<Locale, string>
}

const routeTitles: RouteTitle[] = [
  { prefix: "/orchard/getting-started", title: { en: "Getting Started with Black Swan", es: "Primeros pasos con Black Swan", de: "Erste Schritte mit Black Swan" } },
  { prefix: "/orchard/dashboard", title: { en: "Dashboard", es: "Dashboard", de: "Dashboard" } },
  { prefix: "/orchard/crops/catalog", title: { en: "Crop Selection", es: "Selección de cultivos", de: "Kulturauswahl" } },
  { prefix: "/orchard/game-plan/season", title: { en: "Game Plan - Planting Schedule", es: "Plan estratégico - Calendario de siembra", de: "Saisonplan - Pflanzkalender" } },
  { prefix: "/orchard/game-plan", title: { en: "Game Plan", es: "Plan estratégico", de: "Saisonplan" } },
  { prefix: "/orchard/crop-map", title: { en: "Crop Map", es: "Mapa de cultivos", de: "Anbaukarte" } },
  { prefix: "/orchard/seed-orders", title: { en: "Seeds & Transplants", es: "Semillas y trasplantes", de: "Saatgut & Jungpflanzen" } },
  { prefix: "/orchard/nursery", title: { en: "Nursery", es: "Vivero", de: "Anzucht" } },
  { prefix: "/orchard/harvest", title: { en: "Harvests", es: "Cosechas", de: "Ernten" } },
  { prefix: "/orchard/work", title: { en: "Tasks", es: "Tareas", de: "Aufgaben" } },
  { prefix: "/orchard/farm-map", title: { en: "Farm Map", es: "Mapa de la granja", de: "Hofkarte" } },
  { prefix: "/orchard/notes", title: { en: "Notes", es: "Notas", de: "Notizen" } },
  { prefix: "/orchard/charts", title: { en: "Charts", es: "Gráficos", de: "Diagramme" } },
  { prefix: "/orchard/settings", title: { en: "Settings", es: "Configuración", de: "Einstellungen" } },
  { prefix: "/orchard/library", title: { en: "Agronomic Library", es: "Biblioteca agronómica", de: "Agronomische Bibliothek" } },
  { prefix: "/orchard/care", title: { en: "Care", es: "Cuidados", de: "Pflege" } },
  { prefix: "/orchard/pests", title: { en: "Plant Health", es: "Sanidad", de: "Pflanzengesundheit" } },
  { prefix: "/orchard/soil", title: { en: "Soil", es: "Suelo", de: "Boden" } },
  { prefix: "/orchard/equipment", title: { en: "Equipment", es: "Equipos", de: "Geräte" } },
  { prefix: "/orchard/performance", title: { en: "Plan vs Actual", es: "Plan vs real", de: "Plan vs. Ist" } },
  { prefix: "/orchard/decisions", title: { en: "Decisions", es: "Decisiones", de: "Entscheidungen" } },
  { prefix: "/orchard/analytics", title: { en: "Data & Analytics", es: "Datos y análisis", de: "Daten & Analyse" } },
]

const copy = {
  en: { season: "Season", loading: "Loading season…", help: "Getting started" },
  es: { season: "Temporada", loading: "Cargando temporada…", help: "Iniciación" },
  de: { season: "Saison", loading: "Saison wird geladen…", help: "Einrichtung" },
} as const

function stripLocale(pathname: string) {
  return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/"
}

export function OrchardDesktopHeader() {
  const pathname = usePathname() || "/"
  const internalPathname = stripLocale(pathname)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { language } = useLanguage()
  const locale = language as Locale
  const text = copy[locale]
  const supabase = useMemo(() => createClient(), [])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [userInitials, setUserInitials] = useState("BS")

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.from("orchard_game_plans").select("id,name,season,status").order("start_date", { ascending: false }),
      supabase.auth.getUser(),
    ]).then(([planResult, userResult]) => {
      if (cancelled) return
      if (!planResult.error) setPlans((planResult.data ?? []) as Plan[])
      const user = userResult.data.user
      const parts = user?.user_metadata?.full_name?.split(" ") ?? user?.email?.split("@")[0].split(".") ?? []
      const initials = parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join("")
      if (initials) setUserInitials(initials)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [supabase])

  const requested = searchParams.get("game_plan")
  const selected = plans.find((plan) => plan.id === requested)
    ?? plans.find((plan) => plan.status === "active")
    ?? plans.find((plan) => plan.status === "draft")
    ?? plans[0]
    ?? null

  const title = [...routeTitles]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((item) => internalPathname === item.prefix || internalPathname.startsWith(`${item.prefix}/`))
    ?.title[locale] ?? "Orchard"

  const changePlan = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("game_plan", id)
    router.push(`${pathname}?${params.toString()}`)
  }

  return <header data-orchard-desktop-header className="hidden h-14 shrink-0 items-center justify-between border-b border-[#302f2b] bg-[#11110f] px-5 text-[#f1eee7] md:flex">
    <h1 className="text-[21px] font-semibold leading-none tracking-[-0.025em] text-[#f1eee7]">{title}</h1>
    <div className="flex items-center gap-3">
      <label className="flex h-9 items-center gap-2 border border-[#35332e] bg-[#171614] px-3">
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#8f8a81]">{text.season}</span>
        <select aria-label={text.season} value={selected?.id ?? ""} onChange={(event) => changePlan(event.target.value)} disabled={loading || !plans.length} className="h-7 min-w-[170px] border-0 bg-transparent pr-2 text-xs text-[#dedad2] outline-none">
          {loading ? <option>{text.loading}</option> : plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.season ?? plan.name}</option>)}
        </select>
      </label>
      <Link href={`/${language}/orchard/getting-started${selected?.id ? `?game_plan=${selected.id}` : ""}`} aria-label={text.help} title={text.help} className="flex h-9 w-9 items-center justify-center border-l border-[#302f2b] text-[#aaa69c] hover:text-[#bde1cf]">
        <HelpCircle className="h-[18px] w-[18px]" />
      </Link>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#174335] text-[11px] font-semibold text-[#bde1cf]" aria-label={userInitials}>{userInitials}</div>
    </div>
  </header>
}
