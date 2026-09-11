"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, ChevronDown, Home, LayoutList, Wrench } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: { calendar: "Calendar", reservations: "Reservations", operations: "Operations", more: "More", home: "Black Swan OS", guests: "Guests", rates: "Rates", finance: "Finance", invoices: "Invoices", settings: "Booking settings", channels: "Sales channels", profile: "Profile", handovers: "Shift handovers" },
  es: { calendar: "Calendario", reservations: "Reservas", operations: "Operación", more: "Más", home: "Black Swan OS", guests: "Huéspedes", rates: "Tarifas", finance: "Finanzas", invoices: "Facturas", settings: "Configuración", channels: "Canales", profile: "Perfil", handovers: "Entregas de turno" },
  de: { calendar: "Kalender", reservations: "Buchungen", operations: "Betrieb", more: "Mehr", home: "Black Swan OS", guests: "Gäste", rates: "Preise", finance: "Finanzen", invoices: "Rechnungen", settings: "Einstellungen", channels: "Vertriebskanäle", profile: "Profil", handovers: "Schichtübergaben" },
} as const

export function BookingMobileNav() {
  const pathname = usePathname() || "/"
  const { language } = useLanguage()
  const c = copy[language]
  const href = (path: string) => `/${language}${path}`
  const active = (path: string) => pathname === href(path) || pathname.startsWith(`${href(path)}/`)
  const item = "inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 border-r border-white/[0.06] px-2 text-[11px] last:border-r-0"
  const tone = (path: string) => active(path) ? "bg-[#15261d] text-[#00ce63]" : "text-white/70 hover:bg-white/[0.04] hover:text-white"

  return <div className="booking-mobile-nav border-b border-white/10 bg-[#111213] lg:hidden">
    <div className="flex min-w-0 items-stretch">
      <Link href={href("/bookings/calendar")} className={`${item} ${tone("/bookings/calendar")}`}><CalendarDays className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.calendar}</span></Link>
      <Link href={href("/bookings")} className={`${item} ${pathname === href("/bookings") ? "bg-[#15261d] text-[#00ce63]" : "text-white/70 hover:bg-white/[0.04] hover:text-white"}`}><LayoutList className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.reservations}</span></Link>
      <Link href={href("/bookings/activities")} className={`${item} ${tone("/bookings/activities")}`}><Wrench className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.operations}</span></Link>
      <details className="group relative flex flex-1">
        <summary className={`${item} w-full cursor-pointer list-none text-white/70 hover:bg-white/[0.04] hover:text-white`}><span className="truncate">{c.more}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" /></summary>
        <div className="absolute right-1 top-[calc(100%+4px)] z-[70] grid w-[min(290px,calc(100vw-8px))] grid-cols-2 border border-white/10 bg-[#17191a] p-1.5 shadow-2xl">
          <MobileLink href={href("/os")} icon={<Home className="h-3.5 w-3.5" />} label={c.home} />
          <MobileLink href={href("/bookings/guests")} label={c.guests} />
          <MobileLink href={href("/bookings/operations")} label={c.operations} />
          <MobileLink href={href("/bookings/handovers")} label={c.handovers} />
          <MobileLink href={href("/bookings/rates")} label={c.rates} />
          <MobileLink href={href("/bookings/revenue")} label={c.finance} />
          <MobileLink href={href("/bookings/invoices")} label={c.invoices} />
          <MobileLink href={href("/bookings/facilities")} label={c.settings} />
          <MobileLink href={href("/bookings/channels")} label={c.channels} />
          <MobileLink href={href("/bookings/profile")} label={c.profile} />
        </div>
      </details>
    </div>
  </div>
}

function MobileLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return <Link href={href} className="flex min-h-10 items-center gap-2 px-3 py-2 text-[11px] text-white/72 hover:bg-white/[0.05] hover:text-white">{icon}<span className="truncate">{label}</span></Link>
}
