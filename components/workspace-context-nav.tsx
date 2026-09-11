"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

const booking = {
  en: [
    ["Calendar", "/bookings/calendar"],
    ["Reservations", "/bookings"],
    ["Guests", "/bookings/guests"],
    ["Operations", "/bookings/activities"],
    ["Rates", "/bookings/rates"],
    ["Finance", "/bookings/reports"],
    ["Settings", "/bookings/facilities"],
  ],
  es: [
    ["Calendario", "/bookings/calendar"],
    ["Reservas", "/bookings"],
    ["Huéspedes", "/bookings/guests"],
    ["Operación", "/bookings/activities"],
    ["Tarifas", "/bookings/rates"],
    ["Finanzas", "/bookings/reports"],
    ["Configuración", "/bookings/facilities"],
  ],
  de: [
    ["Kalender", "/bookings/calendar"],
    ["Buchungen", "/bookings"],
    ["Gäste", "/bookings/guests"],
    ["Betrieb", "/bookings/activities"],
    ["Preise", "/bookings/rates"],
    ["Finanzen", "/bookings/reports"],
    ["Einstellungen", "/bookings/facilities"],
  ],
} as const

const orchard = {
  en: [
    ["Overview", "/orchard/dashboard"],
    ["Season", "/orchard/game-plan/season"],
    ["Crops", "/orchard/crops/catalog"],
    ["Work", "/orchard/work/list"],
    ["Map", "/orchard/farm-map"],
    ["Harvest", "/orchard/harvest/season"],
    ["Analytics", "/orchard/analytics"],
    ["Settings", "/orchard/settings"],
  ],
  es: [
    ["Resumen", "/orchard/dashboard"],
    ["Temporada", "/orchard/game-plan/season"],
    ["Cultivos", "/orchard/crops/catalog"],
    ["Trabajo", "/orchard/work/list"],
    ["Mapa", "/orchard/farm-map"],
    ["Cosecha", "/orchard/harvest/season"],
    ["Analítica", "/orchard/analytics"],
    ["Configuración", "/orchard/settings"],
  ],
  de: [
    ["Übersicht", "/orchard/dashboard"],
    ["Saison", "/orchard/game-plan/season"],
    ["Kulturen", "/orchard/crops/catalog"],
    ["Arbeit", "/orchard/work/list"],
    ["Karte", "/orchard/farm-map"],
    ["Ernte", "/orchard/harvest/season"],
    ["Analyse", "/orchard/analytics"],
    ["Einstellungen", "/orchard/settings"],
  ],
} as const

function stripLocale(pathname: string) {
  return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/"
}

export function WorkspaceContextNav() {
  const pathname = usePathname() || "/"
  const { language } = useLanguage()
  const internal = stripLocale(pathname)
  const kind = internal.startsWith("/bookings") ? "booking" : internal.startsWith("/orchard") ? "orchard" : null
  if (!kind) return null
  const items = kind === "booking" ? booking[language] : orchard[language]
  const title = kind === "booking" ? "Booking" : "Orchard"
  const activePath = items.find(([, href]) => internal === href || (href !== "/bookings" && internal.startsWith(`${href}/`)))?.[1]
    ?? (kind === "booking" && internal === "/bookings" ? "/bookings" : undefined)

  return (
    <div className="shrink-0 border-b border-border bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/90" data-workspace-context-nav>
      <div className="flex h-11 min-w-0 items-center gap-1 overflow-x-auto px-2 sm:px-3">
        <span className="mr-2 hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline">{title}</span>
        {items.map(([label, href]) => {
          const active = activePath === href
          return <Link key={href} href={`/${language}${href}`} className={`inline-flex h-8 shrink-0 items-center rounded px-2.5 text-xs transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{label}</Link>
        })}
        <details className="group relative ml-auto shrink-0">
          <summary className="flex h-8 cursor-pointer list-none items-center gap-1 rounded px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground marker:content-none [&::-webkit-details-marker]:hidden">More<ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary>
          <div className="absolute right-0 top-9 z-50 min-w-52 border border-border bg-popover p-1 shadow-xl">
            {kind === "booking" ? <>
              <Link href={`/${language}/bookings/operations`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Stay Cockpit</Link>
              <Link href={`/${language}/bookings/charges`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Charges</Link>
              <Link href={`/${language}/bookings/blocks`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Room blocks</Link>
              <Link href={`/${language}/bookings/handovers`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Shift handovers</Link>
              <Link href={`/${language}/bookings/payments`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Payments</Link>
              <Link href={`/${language}/bookings/invoices`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Invoices</Link>
              <Link href={`/${language}/bookings/channels`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Sales channels</Link>
            </> : <>
              <Link href={`/${language}/orchard/seed-orders`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Seeds & transplants</Link>
              <Link href={`/${language}/orchard/nursery/overview`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Nursery</Link>
              <Link href={`/${language}/orchard/care`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Care</Link>
              <Link href={`/${language}/orchard/pests`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Plant health</Link>
              <Link href={`/${language}/orchard/soil`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Soil</Link>
              <Link href={`/${language}/orchard/equipment`} className="block rounded px-3 py-2 text-xs hover:bg-muted">Equipment</Link>
            </>}
          </div>
        </details>
      </div>
    </div>
  )
}
