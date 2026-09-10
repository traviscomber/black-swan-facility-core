"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BadgeDollarSign,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutList,
  ReceiptText,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: {
    calendar: "Calendar",
    bookings: "Bookings",
    reservationList: "Reservation list",
    clients: "Clients",
    priceList: "Price list",
    charges: "Charges",
    additionalServices: "Additional services",
    reports: "Reports and finances",
    invoices: "Invoices",
    reservationSystem: "Reservation system",
    properties: "Properties",
    blocks: "Blocks",
    employees: "Employees",
    operations: "Operations",
    hide: "Hide",
  },
  es: {
    calendar: "Calendario",
    bookings: "Reservas",
    reservationList: "Lista de reservas",
    clients: "Huéspedes",
    priceList: "Tarifas",
    charges: "Cargos",
    additionalServices: "Servicios adicionales",
    reports: "Reportes y finanzas",
    invoices: "Facturas",
    reservationSystem: "Sistema de reservas",
    properties: "Propiedades",
    blocks: "Bloqueos",
    employees: "Equipo",
    operations: "Operación",
    hide: "Ocultar",
  },
  de: {
    calendar: "Kalender",
    bookings: "Buchungen",
    reservationList: "Reservierungsliste",
    clients: "Gäste",
    priceList: "Preisliste",
    charges: "Gebühren",
    additionalServices: "Zusatzleistungen",
    reports: "Berichte und Finanzen",
    invoices: "Rechnungen",
    reservationSystem: "Reservierungssystem",
    properties: "Unterkünfte",
    blocks: "Sperren",
    employees: "Mitarbeiter",
    operations: "Betrieb",
    hide: "Ausblenden",
  },
} as const

function NavLink({ href, active, icon: Icon, children, inset = false }: {
  href: string
  active: boolean
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  inset?: boolean
}) {
  return (
    <Link href={href} className={`booking-reference-nav-link ${active ? "is-active" : ""} ${inset ? "is-inset" : ""}`}>
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : <span className="w-4 shrink-0" />}
      <span className="truncate">{children}</span>
    </Link>
  )
}

export function BookingReferenceSidebar() {
  const pathname = usePathname() || "/"
  const { language } = useLanguage()
  const c = copy[language]
  const base = `/${language}`
  const href = (path: string) => `${base}${path}`
  const active = (path: string) => pathname === href(path) || pathname.startsWith(`${href(path)}/`)

  return (
    <aside className="booking-reference-sidebar" aria-label="Booking navigation">
      <div className="booking-reference-brand">
        <img src="/blackswan-logo.png" alt="Black Swan" className="h-6 w-6 object-contain" />
        <span className="booking-reference-brand-name">BlackSwan</span>
        <span className="booking-reference-brand-pill">Booking</span>
      </div>

      <nav className="booking-reference-nav">
        <NavLink href={href("/bookings/calendar")} active={active("/bookings/calendar")} icon={CalendarDays}>{c.calendar}</NavLink>
        <div className="booking-reference-nav-group">
          <div className="booking-reference-nav-parent"><LayoutList className="h-4 w-4" /><span>{c.bookings}</span><ChevronDown className="ml-auto h-3.5 w-3.5" /></div>
          <NavLink href={href("/bookings")} active={pathname === href("/bookings")} inset>{c.reservationList}</NavLink>
          <NavLink href={href("/bookings/guests")} active={active("/bookings/guests")} inset>{c.clients}</NavLink>
        </div>
        <div className="booking-reference-nav-group">
          <div className="booking-reference-nav-parent"><BadgeDollarSign className="h-4 w-4" /><span>{c.priceList}</span><ChevronDown className="ml-auto h-3.5 w-3.5" /></div>
          <NavLink href={href("/bookings/charges")} active={active("/bookings/charges")} inset>{c.charges}</NavLink>
          <NavLink href={href("/bookings/extras")} active={active("/bookings/extras")} inset>{c.additionalServices}</NavLink>
        </div>
        <NavLink href={href("/bookings/audit")} active={active("/bookings/audit")} icon={SlidersHorizontal}>{c.reports}</NavLink>
        <NavLink href={href("/bookings/invoices")} active={active("/bookings/invoices")} icon={ReceiptText}>{c.invoices}</NavLink>
        <div className="booking-reference-nav-group">
          <div className="booking-reference-nav-parent"><Settings2 className="h-4 w-4" /><span>{c.reservationSystem}</span><ChevronDown className="ml-auto h-3.5 w-3.5" /></div>
          <NavLink href={href("/bookings/facilities")} active={active("/bookings/facilities")} inset>{c.properties}</NavLink>
          <NavLink href={href("/bookings/blocks")} active={active("/bookings/blocks")} inset>{c.blocks}</NavLink>
        </div>
        <NavLink href={href("/bookings/activities")} active={active("/bookings/activities")} icon={Sparkles}>{c.operations}</NavLink>
        <NavLink href={href("/employees")} active={active("/employees")} icon={Users}>{c.employees}</NavLink>
      </nav>

      <div className="booking-reference-sidebar-footer">
        <div className="booking-reference-user"><UserRound className="h-4 w-4" /><span>Santiago</span></div>
        <div className="booking-reference-hide"><FileText className="h-3.5 w-3.5" /><span>{c.hide}</span></div>
      </div>
    </aside>
  )
}
