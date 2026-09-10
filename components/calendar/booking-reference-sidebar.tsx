"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { BadgeDollarSign, CalendarDays, ChevronDown, ChevronLeft, LayoutList, ReceiptText, Settings2, SlidersHorizontal, Sparkles, Users } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: { calendar: "Calendar", bookings: "Bookings", reservationList: "Reservation list", clients: "Clients", priceList: "Price list", charges: "Set prices", additionalServices: "Additional services", reports: "Reports and finances", audit: "Operational report", invoices: "Invoices", reservationSystem: "Reservation system", properties: "Properties", blocks: "Blocks", employees: "Employees", operations: "Operations", hide: "Hide", show: "Show" },
  es: { calendar: "Calendario", bookings: "Reservas", reservationList: "Lista de reservas", clients: "Huéspedes", priceList: "Tarifas", charges: "Definir precios", additionalServices: "Servicios adicionales", reports: "Reportes y finanzas", audit: "Reporte operacional", invoices: "Facturas", reservationSystem: "Sistema de reservas", properties: "Propiedades", blocks: "Bloqueos", employees: "Equipo", operations: "Operación", hide: "Ocultar", show: "Mostrar" },
  de: { calendar: "Kalender", bookings: "Buchungen", reservationList: "Reservierungsliste", clients: "Gäste", priceList: "Preisliste", charges: "Preise festlegen", additionalServices: "Zusatzleistungen", reports: "Berichte und Finanzen", audit: "Betriebsbericht", invoices: "Rechnungen", reservationSystem: "Reservierungssystem", properties: "Unterkünfte", blocks: "Sperren", employees: "Mitarbeiter", operations: "Betrieb", hide: "Ausblenden", show: "Einblenden" },
} as const

type GroupKey = "bookings" | "prices" | "reports" | "reservation"

function NavLink({ href, active, icon: Icon, children, inset = false }: { href: string; active: boolean; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; inset?: boolean }) {
  return <Link href={href} className={`booking-reference-nav-link ${active ? "is-active" : ""} ${inset ? "is-inset" : ""}`}>{Icon ? <Icon className="booking-reference-nav-icon h-4 w-4 shrink-0" /> : <span className="booking-reference-nav-spacer" />}<span className="booking-reference-nav-label truncate">{children}</span></Link>
}

function NavGroup({ label, icon: Icon, open, onToggle, children }: { label: string; icon: React.ComponentType<{ className?: string }>; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className={`booking-reference-nav-group ${open ? "is-open" : ""}`}><button type="button" className="booking-reference-nav-parent" aria-expanded={open} onClick={onToggle}><Icon className="booking-reference-nav-icon h-4 w-4 shrink-0" /><span className="booking-reference-nav-label truncate">{label}</span><ChevronDown className="booking-reference-chevron ml-auto h-3.5 w-3.5" /></button>{open && <div className="booking-reference-nav-children">{children}</div>}</div>
}

function groupForPath(pathname: string): GroupKey | null {
  if (/\/bookings\/(guests)?\/?$/.test(pathname) || /\/bookings\/?$/.test(pathname)) return "bookings"
  if (/\/bookings\/(charges|extras)(\/|$)/.test(pathname)) return "prices"
  if (/\/bookings\/audit(\/|$)/.test(pathname)) return "reports"
  if (/\/bookings\/(facilities|blocks)(\/|$)/.test(pathname)) return "reservation"
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
    const current = groupForPath(pathname)
    if (!current) return
    setOpenGroups((groups) => groups.has(current) ? groups : new Set([...groups, current]))
  }, [pathname])

  function toggleGroup(key: GroupKey) { setOpenGroups((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next }) }

  return <aside className={`booking-reference-sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Booking navigation">
    <div className="booking-reference-brand"><img src="/blackswan-logo.png" alt="Black Swan" className="booking-reference-logo h-5 w-5 object-contain" /><span className="booking-reference-brand-name">BlackSwan</span><span className="booking-reference-brand-pill">Booking</span></div>
    <nav className="booking-reference-nav">
      <NavLink href={href("/bookings/calendar")} active={active("/bookings/calendar")} icon={CalendarDays}>{c.calendar}</NavLink>
      <NavGroup label={c.bookings} icon={LayoutList} open={openGroups.has("bookings")} onToggle={() => toggleGroup("bookings")}><NavLink href={href("/bookings")} active={pathname === href("/bookings")} inset>{c.reservationList}</NavLink><NavLink href={href("/bookings/guests")} active={active("/bookings/guests")} inset>{c.clients}</NavLink></NavGroup>
      <NavGroup label={c.priceList} icon={BadgeDollarSign} open={openGroups.has("prices")} onToggle={() => toggleGroup("prices")}><NavLink href={href("/bookings/charges")} active={active("/bookings/charges")} inset>{c.charges}</NavLink><NavLink href={href("/bookings/extras")} active={active("/bookings/extras")} inset>{c.additionalServices}</NavLink></NavGroup>
      <NavGroup label={c.reports} icon={SlidersHorizontal} open={openGroups.has("reports")} onToggle={() => toggleGroup("reports")}><NavLink href={href("/bookings/audit")} active={active("/bookings/audit")} inset>{c.audit}</NavLink></NavGroup>
      <NavLink href={href("/bookings/invoices")} active={active("/bookings/invoices")} icon={ReceiptText}>{c.invoices}</NavLink>
      <NavGroup label={c.reservationSystem} icon={Settings2} open={openGroups.has("reservation")} onToggle={() => toggleGroup("reservation")}><NavLink href={href("/bookings/facilities")} active={active("/bookings/facilities")} inset>{c.properties}</NavLink><NavLink href={href("/bookings/blocks")} active={active("/bookings/blocks")} inset>{c.blocks}</NavLink></NavGroup>
      <NavLink href={href("/bookings/activities")} active={active("/bookings/activities")} icon={Sparkles}>{c.operations}</NavLink>
      <NavLink href={href("/employees")} active={active("/employees")} icon={Users}>{c.employees}</NavLink>
    </nav>
    <div className="booking-reference-sidebar-footer"><button type="button" className="booking-reference-hide" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? c.show : c.hide} title={collapsed ? c.show : c.hide}><ChevronLeft className="booking-reference-hide-icon h-4 w-4" /><span className="booking-reference-nav-label">{collapsed ? c.show : c.hide}</span></button></div>
  </aside>
}
