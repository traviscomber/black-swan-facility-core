"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BadgeDollarSign,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Crown,
  LayoutList,
  LineChart,
  ReceiptText,
  Settings2,
  Share2,
  UserRound,
  Users,
} from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

const SIDEBAR_GROUPS_KEY = "black-swan.booking.sidebar.groups"

const copy = {
  en: {
    calendar: "Calendar", premium: "Premium", bookings: "Bookings", reservationList: "Reservation list", clients: "Clients", messageTemplates: "Message templates",
    priceList: "Price list", setPrices: "Set prices", configuration: "Configuration", prepayment: "Prepayment", additionalServices: "Additional services",
    reports: "Reports and finances", statistics: "Statistics", financialReport: "Financial Report", roomReport: "Room report", occupancyReport: "Occupancy report", localTaxReport: "Local Tax Report", paymentList: "Payment list", registrationBook: "Registration book", exportBookings: "Export bookings",
    invoices: "Invoices", open: "Open", taxes: "Taxes", taxRates: "Tax rates",
    reservationSystem: "Reservation system", paymentMethods: "Payment methods", amenities: "Amenities", notifications: "Notifications", licenseNumber: "License number",
    salesChannels: "Sales channels", airbnb: "Airbnb", booking: "Booking", iCalendar: "iCalendar", employees: "Employees", profile: "Profile", hide: "Hide", show: "Show", notConfigured: "Not configured yet", backToOs: "Back to Black Swan OS",
  },
  es: {
    calendar: "Calendario", premium: "Premium", bookings: "Reservas", reservationList: "Lista de reservas", clients: "Huéspedes", messageTemplates: "Plantillas de mensajes",
    priceList: "Tarifas", setPrices: "Definir precios", configuration: "Configuración", prepayment: "Prepago", additionalServices: "Servicios adicionales",
    reports: "Reportes y finanzas", statistics: "Estadísticas", financialReport: "Reporte financiero", roomReport: "Reporte por habitación", occupancyReport: "Reporte de ocupación", localTaxReport: "Reporte de impuesto local", paymentList: "Lista de pagos", registrationBook: "Libro de registro", exportBookings: "Exportar reservas",
    invoices: "Facturas", open: "Abiertas", taxes: "Impuestos", taxRates: "Tasas de impuesto",
    reservationSystem: "Sistema de reservas", paymentMethods: "Métodos de pago", amenities: "Amenities", notifications: "Notificaciones", licenseNumber: "Número de licencia",
    salesChannels: "Canales de venta", airbnb: "Airbnb", booking: "Booking", iCalendar: "iCalendar", employees: "Equipo", profile: "Perfil", hide: "Ocultar", show: "Mostrar", notConfigured: "Aún no configurado", backToOs: "Volver a Black Swan OS",
  },
  de: {
    calendar: "Kalender", premium: "Premium", bookings: "Buchungen", reservationList: "Reservierungsliste", clients: "Gäste", messageTemplates: "Nachrichtenvorlagen",
    priceList: "Preisliste", setPrices: "Preise festlegen", configuration: "Konfiguration", prepayment: "Vorauszahlung", additionalServices: "Zusatzleistungen",
    reports: "Berichte und Finanzen", statistics: "Statistiken", financialReport: "Finanzbericht", roomReport: "Zimmerbericht", occupancyReport: "Belegungsbericht", localTaxReport: "Lokaler Steuerbericht", paymentList: "Zahlungsliste", registrationBook: "Melderegister", exportBookings: "Buchungen exportieren",
    invoices: "Rechnungen", open: "Offen", taxes: "Steuern", taxRates: "Steuersätze",
    reservationSystem: "Reservierungssystem", paymentMethods: "Zahlungsmethoden", amenities: "Ausstattung", notifications: "Benachrichtigungen", licenseNumber: "Lizenznummer",
    salesChannels: "Vertriebskanäle", airbnb: "Airbnb", booking: "Booking", iCalendar: "iCalendar", employees: "Mitarbeiter", profile: "Profil", hide: "Ausblenden", show: "Einblenden", notConfigured: "Noch nicht konfiguriert", backToOs: "Zurück zu Black Swan OS",
  },
} as const

type GroupKey = "bookings" | "prices" | "reports" | "invoices" | "reservation" | "channels"
type NavLinkProps = { href?: string; active?: boolean; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; inset?: boolean; title?: string; dot?: "airbnb" | "booking" | "ical" }

function NavLink({ href, active = false, icon: Icon, children, inset = false, title, dot }: NavLinkProps) {
  const body = <>{Icon ? <Icon className="booking-reference-nav-icon h-4 w-4 shrink-0" /> : dot ? <span className={`booking-channel-dot is-${dot}`} /> : <span className="booking-reference-nav-spacer" />}<span className="booking-reference-nav-label truncate">{children}</span></>
  const className = `booking-reference-nav-link ${active ? "is-active" : ""} ${inset ? "is-inset" : ""} ${href ? "" : "is-unavailable"}`
  if (!href) return <span className={className} aria-disabled="true" title={title}>{body}</span>
  return <Link href={href} className={className}>{body}</Link>
}

function NavGroup({ label, icon: Icon, open, onToggle, children }: { label: string; icon: React.ComponentType<{ className?: string }>; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className={`booking-reference-nav-group ${open ? "is-open" : ""}`}><button type="button" className="booking-reference-nav-parent" aria-expanded={open} onClick={onToggle}><Icon className="booking-reference-nav-icon h-4 w-4 shrink-0" /><span className="booking-reference-nav-label truncate">{label}</span><ChevronDown className="booking-reference-chevron ml-auto h-3.5 w-3.5" /></button>{open && <div className="booking-reference-nav-children">{children}</div>}</div>
}

function groupForPath(pathname: string): GroupKey | null {
  if (/\/bookings\/(guests)?\/?$/.test(pathname) || /\/bookings\/?$/.test(pathname)) return "bookings"
  if (/\/bookings\/(rates|extras)(\/|$)/.test(pathname)) return "prices"
  if (/\/bookings\/(reports|revenue|rooms|audit)(\/|$)/.test(pathname)) return "reports"
  if (/\/bookings\/invoices(\/|$)/.test(pathname)) return "invoices"
  if (/\/bookings\/(facilities|payments|requests)(\/|$)/.test(pathname)) return "reservation"
  if (/\/bookings\/channels(\/|$)/.test(pathname)) return "channels"
  return null
}

export function BookingReferenceSidebar() {
  const pathname = usePathname() || "/"
  const { language } = useLanguage()
  const c = copy[language]
  const base = `/${language}`
  const href = (path: string) => `${base}${path}`
  const active = (path: string) => pathname === href(path) || pathname.startsWith(`${href(path)}/`)
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<GroupKey>>(() => new Set([groupForPath(pathname) ?? "reservation"]))

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_GROUPS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as GroupKey[]
        if (Array.isArray(parsed)) setOpenGroups(new Set(parsed))
      }
    } catch {}
  }, [])

  useEffect(() => {
    const current = groupForPath(pathname)
    if (!current) return
    setOpenGroups((groups) => groups.has(current) ? groups : new Set([...groups, current]))
  }, [pathname])

  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify([...openGroups])) } catch {}
  }, [openGroups])

  function toggleGroup(key: GroupKey) { setOpenGroups((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next }) }

  return <aside className={`booking-reference-sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Booking navigation" data-booking-reference-sidebar>
    <div className="booking-reference-brand">
      <Link href={href("/os")} className="booking-reference-brand-home" aria-label={c.backToOs} title={c.backToOs}>
        <img src="/blackswan-logo.png" alt="Black Swan" className="booking-reference-logo h-5 w-5 object-contain" />
        <span className="booking-reference-brand-name">BlackSwan</span>
      </Link>
      <span className="booking-reference-brand-pill"><Crown className="h-3 w-3" />{c.premium}</span>
    </div>
    <nav className="booking-reference-nav">
      <NavLink href={href("/bookings/calendar")} active={active("/bookings/calendar")} icon={CalendarDays}>{c.calendar}</NavLink>
      <NavLink icon={Crown} title={c.notConfigured}>{c.premium}</NavLink>
      <NavGroup label={c.bookings} icon={LayoutList} open={openGroups.has("bookings")} onToggle={() => toggleGroup("bookings")}>
        <NavLink href={href("/bookings")} active={pathname === href("/bookings")} inset>{c.reservationList}</NavLink>
        <NavLink href={href("/bookings/guests")} active={active("/bookings/guests")} inset>{c.clients}</NavLink>
        <NavLink inset title={c.notConfigured}>{c.messageTemplates}</NavLink>
      </NavGroup>
      <NavGroup label={c.priceList} icon={BadgeDollarSign} open={openGroups.has("prices")} onToggle={() => toggleGroup("prices")}>
        <NavLink href={href("/bookings/rates")} active={active("/bookings/rates")} inset>{c.setPrices}</NavLink>
        <NavLink href={`${href("/bookings/rates")}?view=configuration`} inset>{c.configuration}</NavLink>
        <NavLink href={`${href("/bookings/payments")}?view=prepayment`} inset>{c.prepayment}</NavLink>
        <NavLink href={href("/bookings/extras")} active={active("/bookings/extras")} inset>{c.additionalServices}</NavLink>
      </NavGroup>
      <NavGroup label={c.reports} icon={LineChart} open={openGroups.has("reports")} onToggle={() => toggleGroup("reports")}>
        <NavLink href={href("/bookings/reports")} active={active("/bookings/reports")} inset>{c.statistics}</NavLink>
        <NavLink href={href("/bookings/revenue")} active={active("/bookings/revenue")} inset>{c.financialReport}</NavLink>
        <NavLink href={href("/bookings/rooms")} active={active("/bookings/rooms")} inset>{c.roomReport}</NavLink>
        <NavLink href={`${href("/bookings/reports")}?view=occupancy`} inset>{c.occupancyReport}</NavLink>
        <NavLink href={`${href("/bookings/invoices")}?view=local-tax`} inset>{c.localTaxReport}</NavLink>
        <NavLink href={href("/bookings/payments")} active={active("/bookings/payments")} inset>{c.paymentList}</NavLink>
        <NavLink href={href("/bookings/audit")} active={active("/bookings/audit")} inset>{c.registrationBook}</NavLink>
        <NavLink inset title={c.notConfigured}>{c.exportBookings}</NavLink>
      </NavGroup>
      <NavGroup label={c.invoices} icon={ReceiptText} open={openGroups.has("invoices")} onToggle={() => toggleGroup("invoices")}>
        <NavLink href={href("/bookings/invoices")} active={active("/bookings/invoices")} inset>{c.open}</NavLink>
        <NavLink href={`${href("/bookings/invoices")}?view=taxes`} inset>{c.taxes}</NavLink>
        <NavLink href={`${href("/bookings/invoices")}?view=tax-rates`} inset>{c.taxRates}</NavLink>
      </NavGroup>
      <NavGroup label={c.reservationSystem} icon={Settings2} open={openGroups.has("reservation")} onToggle={() => toggleGroup("reservation")}>
        <NavLink href={href("/bookings/facilities")} active={active("/bookings/facilities")} inset>{c.configuration}</NavLink>
        <NavLink href={href("/bookings/payments")} active={active("/bookings/payments")} inset>{c.paymentMethods}</NavLink>
        <NavLink href={href("/bookings/extras")} active={active("/bookings/extras")} inset>{c.amenities}</NavLink>
        <NavLink href={href("/bookings/requests")} active={active("/bookings/requests")} inset>{c.notifications}</NavLink>
        <NavLink inset title={c.notConfigured}>{c.licenseNumber}</NavLink>
      </NavGroup>
      <NavGroup label={c.salesChannels} icon={Share2} open={openGroups.has("channels")} onToggle={() => toggleGroup("channels")}>
        <NavLink href={`${href("/bookings/channels")}?channel=airbnb`} active={active("/bookings/channels") && pathname.includes("channel=airbnb")} inset dot="airbnb">{c.airbnb}</NavLink>
        <NavLink href={`${href("/bookings/channels")}?channel=booking`} inset dot="booking">{c.booking}</NavLink>
        <NavLink href={`${href("/bookings/channels")}?channel=ical`} inset dot="ical">{c.iCalendar}</NavLink>
      </NavGroup>
      <NavLink href={href("/employees")} active={active("/employees")} icon={Users}>{c.employees}</NavLink>
      <NavLink href={href("/bookings/profile")} active={active("/bookings/profile")} icon={UserRound}>{c.profile}</NavLink>
    </nav>
    <div className="booking-reference-sidebar-footer"><button type="button" className="booking-reference-hide" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? c.show : c.hide} title={collapsed ? c.show : c.hide}><ChevronLeft className="booking-reference-hide-icon h-4 w-4" /><span className="booking-reference-nav-label">{collapsed ? c.show : c.hide}</span></button></div>
  </aside>
}
