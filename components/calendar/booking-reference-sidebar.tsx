"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BadgeDollarSign,
  BedDouble,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  LayoutList,
  LineChart,
  ReceiptText,
  Settings,
  Users,
  Wrench,
} from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

const SIDEBAR_GROUPS_KEY = "black-swan.booking.sidebar.groups"

const copy = {
  en: {
    calendar:"Calendar", bookings:"Bookings", reservationList:"Reservation list", cancelled:"Cancelled", clients:"Clients", messageTemplates:"Message templates",
    operations:"Operations", stayCockpit:"Stay cockpit", charges:"Charges", roomBlocks:"Room blocks", rooms:"Rooms & beds", handovers:"Shift handovers", auditLog:"Audit log",
    priceList:"Price list", setPrices:"Set prices", configuration:"Configuration", prepayment:"Prepayment", additionalServices:"Additional services",
    reports:"Reports and finances", financialReport:"Financial report", roomReport:"Room report", occupancyReport:"Occupancy report", localTaxReport:"Local Tax Report", paymentList:"Payment list", registrationBook:"Registration book",
    invoices:"Invoices", taxRates:"Tax rates", employees:"Employees", settings:"Settings", reservationSystem:"Reservation system", paymentMethods:"Payment methods", salesChannels:"Sales channels", profile:"Profile",
    hide:"Hide", show:"Show", backToOs:"Back to Black Swan OS",
  },
  es: {
    calendar:"Calendario", bookings:"Reservas", reservationList:"Lista de reservas", cancelled:"Canceladas", clients:"Huéspedes", messageTemplates:"Plantillas de mensajes",
    operations:"Operación", stayCockpit:"Stay cockpit", charges:"Cargos", roomBlocks:"Bloqueos", rooms:"Habitaciones y camas", handovers:"Entregas de turno", auditLog:"Auditoría",
    priceList:"Tarifas", setPrices:"Definir precios", configuration:"Configuración", prepayment:"Prepago", additionalServices:"Servicios adicionales",
    reports:"Reportes y finanzas", financialReport:"Reporte financiero", roomReport:"Reporte por habitación", occupancyReport:"Ocupación", localTaxReport:"Impuesto local", paymentList:"Lista de pagos", registrationBook:"Libro de registro",
    invoices:"Facturas", taxRates:"Tasas de impuesto", employees:"Equipo", settings:"Configuración", reservationSystem:"Sistema de reservas", paymentMethods:"Métodos de pago", salesChannels:"Canales de venta", profile:"Perfil",
    hide:"Ocultar", show:"Mostrar", backToOs:"Volver a Black Swan OS",
  },
  de: {
    calendar:"Kalender", bookings:"Buchungen", reservationList:"Reservierungsliste", cancelled:"Storniert", clients:"Gäste", messageTemplates:"Nachrichtenvorlagen",
    operations:"Betrieb", stayCockpit:"Stay cockpit", charges:"Gebühren", roomBlocks:"Zimmerblöcke", rooms:"Zimmer & Betten", handovers:"Schichtübergaben", auditLog:"Prüfprotokoll",
    priceList:"Preisliste", setPrices:"Preise festlegen", configuration:"Konfiguration", prepayment:"Vorauszahlung", additionalServices:"Zusatzleistungen",
    reports:"Berichte und Finanzen", financialReport:"Finanzbericht", roomReport:"Zimmerbericht", occupancyReport:"Belegung", localTaxReport:"Lokale Steuer", paymentList:"Zahlungsliste", registrationBook:"Melderegister",
    invoices:"Rechnungen", taxRates:"Steuersätze", employees:"Mitarbeiter", settings:"Einstellungen", reservationSystem:"Reservierungssystem", paymentMethods:"Zahlungsmethoden", salesChannels:"Vertriebskanäle", profile:"Profil",
    hide:"Ausblenden", show:"Einblenden", backToOs:"Zurück zu Black Swan OS",
  },
} as const

type GroupKey = "bookings" | "operations" | "prices" | "reports" | "settings"
type NavLinkProps = { href:string; active?:boolean; icon?:React.ComponentType<{className?:string}>; children:React.ReactNode; inset?:boolean }

function NavLink({ href, active=false, icon:Icon, children, inset=false }:NavLinkProps){
  const body=<>{Icon?<Icon className="booking-reference-nav-icon h-4 w-4 shrink-0"/>:<span className="booking-reference-nav-spacer"/>}<span className="booking-reference-nav-label truncate">{children}</span></>
  return <Link href={href} prefetch={false} className={`booking-reference-nav-link ${active?"is-active":""} ${inset?"is-inset":""}`}>{body}</Link>
}

function NavGroup({label,icon:Icon,open,onToggle,children}:{label:string;icon:React.ComponentType<{className?:string}>;open:boolean;onToggle:()=>void;children:React.ReactNode}){
  return <div className={`booking-reference-nav-group ${open?"is-open":""}`}>
    <button type="button" className="booking-reference-nav-parent" aria-expanded={open} onClick={onToggle}>
      <Icon className="booking-reference-nav-icon h-4 w-4 shrink-0"/><span className="booking-reference-nav-label truncate">{label}</span><ChevronDown className="booking-reference-chevron ml-auto h-3.5 w-3.5"/>
    </button>
    {open&&<div className="booking-reference-nav-children">{children}</div>}
  </div>
}

function groupForPath(pathname:string):GroupKey|null{
  if(/\/bookings\/(guests|cancelled|message-templates)?\/?$/.test(pathname)||/\/bookings\/?$/.test(pathname))return "bookings"
  if(/\/bookings\/(operations|charges|blocks|rooms|handovers|audit)(\/|$)/.test(pathname))return "operations"
  if(/\/bookings\/(rates|prepayment|extras)(\/|$)/.test(pathname))return "prices"
  if(/\/bookings\/(revenue|reports|room-report|local-tax|payments|registration-book)(\/|$)/.test(pathname))return "reports"
  if(/\/bookings\/(reservation-settings|payment-methods|channels|profile)(\/|$)/.test(pathname))return "settings"
  return null
}

export function BookingReferenceSidebar(){
  const pathname=usePathname()||"/"
  const {language}=useLanguage()
  const c=copy[language]
  const base=`/${language}`
  const href=(path:string)=>`${base}${path}`
  const active=(path:string)=>pathname===href(path)||pathname.startsWith(`${href(path)}/`)
  const [collapsed,setCollapsed]=useState(false)
  const [openGroups,setOpenGroups]=useState<Set<GroupKey>>(()=>new Set([groupForPath(pathname)??"bookings"]))

  useEffect(()=>{try{const saved=window.localStorage.getItem(SIDEBAR_GROUPS_KEY);if(saved){const parsed=JSON.parse(saved) as GroupKey[];if(Array.isArray(parsed))setOpenGroups(new Set(parsed.filter((key):key is GroupKey=>["bookings","operations","prices","reports","settings"].includes(key))))}}catch{}},[])
  useEffect(()=>{const current=groupForPath(pathname);if(!current)return;setOpenGroups(groups=>groups.has(current)?groups:new Set([...groups,current]))},[pathname])
  useEffect(()=>{try{window.localStorage.setItem(SIDEBAR_GROUPS_KEY,JSON.stringify([...openGroups]))}catch{}},[openGroups])
  function toggleGroup(key:GroupKey){setOpenGroups(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next})}

  return <aside className={`booking-reference-sidebar ${collapsed?"is-collapsed":""}`} aria-label="Booking navigation" data-booking-reference-sidebar>
    <div className="booking-reference-brand"><Link href={href("/os")} prefetch={false} className="booking-reference-brand-home" aria-label={c.backToOs} title={c.backToOs}><img src="/blackswan-logo.png" alt="Black Swan" className="booking-reference-logo h-5 w-5 object-contain"/><span className="booking-reference-brand-name">BlackSwan</span></Link></div>
    <nav className="booking-reference-nav">
      <NavLink href={href("/bookings/calendar")} active={active("/bookings/calendar")} icon={CalendarDays}>{c.calendar}</NavLink>
      <NavGroup label={c.bookings} icon={LayoutList} open={openGroups.has("bookings")} onToggle={()=>toggleGroup("bookings")}>
        <NavLink href={href("/bookings")} active={pathname===href("/bookings")} inset>{c.reservationList}</NavLink>
        <NavLink href={href("/bookings/cancelled")} active={active("/bookings/cancelled")} inset>{c.cancelled}</NavLink>
        <NavLink href={href("/bookings/guests")} active={active("/bookings/guests")} inset>{c.clients}</NavLink>
        <NavLink href={href("/bookings/message-templates")} active={active("/bookings/message-templates")} inset>{c.messageTemplates}</NavLink>
      </NavGroup>
      <NavGroup label={c.operations} icon={Wrench} open={openGroups.has("operations")} onToggle={()=>toggleGroup("operations")}>
        <NavLink href={href("/bookings/operations")} active={active("/bookings/operations")} inset>{c.stayCockpit}</NavLink>
        <NavLink href={href("/bookings/charges")} active={active("/bookings/charges")} inset>{c.charges}</NavLink>
        <NavLink href={href("/bookings/blocks")} active={active("/bookings/blocks")} inset>{c.roomBlocks}</NavLink>
        <NavLink href={href("/bookings/rooms")} active={active("/bookings/rooms")} inset icon={BedDouble}>{c.rooms}</NavLink>
        <NavLink href={href("/bookings/handovers")} active={active("/bookings/handovers")} inset>{c.handovers}</NavLink>
        <NavLink href={href("/bookings/audit")} active={active("/bookings/audit")} inset>{c.auditLog}</NavLink>
      </NavGroup>
      <NavGroup label={c.priceList} icon={BadgeDollarSign} open={openGroups.has("prices")} onToggle={()=>toggleGroup("prices")}>
        <NavLink href={href("/bookings/rates")} active={active("/bookings/rates")} inset>{c.setPrices}</NavLink>
        <NavLink href={href("/bookings/rates?view=configuration")} active={false} inset>{c.configuration}</NavLink>
        <NavLink href={href("/bookings/prepayment")} active={active("/bookings/prepayment")} inset>{c.prepayment}</NavLink>
        <NavLink href={href("/bookings/extras")} active={active("/bookings/extras")} inset>{c.additionalServices}</NavLink>
      </NavGroup>
      <NavGroup label={c.reports} icon={LineChart} open={openGroups.has("reports")} onToggle={()=>toggleGroup("reports")}>
        <NavLink href={href("/bookings/revenue")} active={active("/bookings/revenue")} inset>{c.financialReport}</NavLink>
        <NavLink href={href("/bookings/room-report")} active={active("/bookings/room-report")} inset>{c.roomReport}</NavLink>
        <NavLink href={href("/bookings/reports")} active={active("/bookings/reports")} inset>{c.occupancyReport}</NavLink>
        <NavLink href={href("/bookings/local-tax")} active={active("/bookings/local-tax")} inset>{c.localTaxReport}</NavLink>
        <NavLink href={href("/bookings/payments")} active={active("/bookings/payments")} inset>{c.paymentList}</NavLink>
        <NavLink href={href("/bookings/registration-book")} active={active("/bookings/registration-book")} inset>{c.registrationBook}</NavLink>
      </NavGroup>
      <NavLink href={href("/bookings/invoices")} active={active("/bookings/invoices")} icon={ReceiptText}>{c.invoices}</NavLink>
      <NavLink href={href("/bookings/tax-rates")} active={active("/bookings/tax-rates")} icon={ReceiptText}>{c.taxRates}</NavLink>
      <NavLink href={href("/bookings/employees")} active={active("/bookings/employees")} icon={Users}>{c.employees}</NavLink>
      <NavGroup label={c.settings} icon={Settings} open={openGroups.has("settings")} onToggle={()=>toggleGroup("settings")}>
        <NavLink href={href("/bookings/reservation-settings")} active={active("/bookings/reservation-settings")} inset>{c.reservationSystem}</NavLink>
        <NavLink href={href("/bookings/payment-methods")} active={active("/bookings/payment-methods")} inset>{c.paymentMethods}</NavLink>
        <NavLink href={href("/bookings/channels")} active={active("/bookings/channels")} inset>{c.salesChannels}</NavLink>
        <NavLink href={href("/bookings/profile")} active={active("/bookings/profile")} inset>{c.profile}</NavLink>
      </NavGroup>
    </nav>
    <div className="booking-reference-sidebar-footer"><button type="button" className="booking-reference-hide" onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?c.show:c.hide} title={collapsed?c.show:c.hide}><ChevronLeft className="booking-reference-hide-icon h-4 w-4"/><span className="booking-reference-nav-label">{collapsed?c.show:c.hide}</span></button></div>
  </aside>
}
