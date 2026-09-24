"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { KeyRound, Mail, Phone, Search, Users } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import type { Employee } from "@/lib/types"

const COPY = {
  en: { title: "Employees", subtitle: "Canonical Black Swan team directory available to the Booking workspace.", name: "Name", role: "Role", contact: "Contact", status: "Status", active: "Active", inactive: "Inactive", empty: "No employees registered.", loadFailed: "The employee directory could not be loaded.", manage: "Access & permissions", search: "Search name, role or contact", all: "All", activeOnly: "Active", inactiveOnly: "Inactive" },
  es: { title: "Equipo", subtitle: "Directorio canónico de Black Swan disponible para el workspace de Reservas.", name: "Nombre", role: "Función", contact: "Contacto", status: "Estado", active: "Activo", inactive: "Inactivo", empty: "No hay personas registradas.", loadFailed: "No fue posible cargar el directorio del equipo.", manage: "Accesos y permisos", search: "Buscar nombre, función o contacto", all: "Todos", activeOnly: "Activos", inactiveOnly: "Inactivos" },
  de: { title: "Mitarbeiter", subtitle: "Kanonisches Black-Swan-Teamverzeichnis für den Buchungsbereich.", name: "Name", role: "Rolle", contact: "Kontakt", status: "Status", active: "Aktiv", inactive: "Inaktiv", empty: "Keine Mitarbeiter erfasst.", loadFailed: "Das Mitarbeiterverzeichnis konnte nicht geladen werden.", manage: "Zugriff & Berechtigungen", search: "Name, Rolle oder Kontakt suchen", all: "Alle", activeOnly: "Aktiv", inactiveOnly: "Inaktiv" },
} as const

export function BookingEmployeesDirectory({ employees, loadFailed }: { employees: Employee[]; loadFailed: boolean }) {
  const { language } = useLanguage()
  const { access } = useEffectiveAccess()
  const copy = COPY[language]
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return employees.filter((employee) => {
      if (status === "active" && !employee.is_active) return false
      if (status === "inactive" && employee.is_active) return false
      if (!term) return true
      return [employee.name, employee.role, employee.email, employee.phone].filter(Boolean).join(" ").toLowerCase().includes(term)
    })
  }, [employees, query, status])
  const activeCount = useMemo(() => employees.filter((employee) => employee.is_active).length, [employees])

  return <div className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] items-center justify-between gap-3 border-b border-white/[0.07] bg-[#211e1a] px-4 py-2">
      <div className="min-w-0"><h1 className="truncate text-lg font-medium">{copy.title}</h1><p className="truncate text-xs text-[#b9b0a4]">{copy.subtitle}</p></div>
      <div className="flex items-center gap-2">{access.is_admin ? <Link href="/admin/access" className="inline-flex h-8 items-center gap-2 bg-[#2b2722] px-3 text-xs text-[#e7e1d8] hover:bg-[#332e28]"><KeyRound className="h-3.5 w-3.5" />{copy.manage}</Link> : null}<div className="flex items-center gap-2 text-xs text-[#b9b0a4]"><Users className="h-4 w-4" /><span>{activeCount}/{employees.length}</span></div></div>
    </header>

    {loadFailed && <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">{copy.loadFailed}</div>}

    <div className="flex min-h-10 items-center gap-2 border-b border-white/[0.07] bg-[#1c1916] px-3 py-1">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8f867b]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} className="h-8 w-full bg-[#171512] pl-9 pr-3 text-xs outline-none focus:ring-1 focus:ring-[#6f8373]" /></div>
      <select value={status} onChange={(event) => setStatus(event.target.value as "all" | "active" | "inactive")} className="h-8 min-w-32 bg-[#171512] px-2 text-xs outline-none focus:ring-1 focus:ring-[#6f8373]"><option value="all">{copy.all}</option><option value="active">{copy.activeOnly}</option><option value="inactive">{copy.inactiveOnly}</option></select>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="border-b border-white/[0.07] bg-[#1c1916] text-left text-[#b9b0a4]"><tr><th className="px-3 py-2 font-medium">{copy.name}</th><th className="px-3 py-2 font-medium">{copy.role}</th><th className="px-3 py-2 font-medium">{copy.contact}</th><th className="px-3 py-2 font-medium">{copy.status}</th></tr></thead>
        <tbody>{filtered.length === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-[#b9b0a4]">{copy.empty}</td></tr> : filtered.map((employee) => <tr key={employee.id} className="border-b border-white/[0.05] hover:bg-white/[0.025]">
          <td className="px-3 py-2 font-medium">{employee.name}</td>
          <td className="px-3 py-2 text-[#b9b0a4]">{employee.role?.trim() || "—"}</td>
          <td className="px-3 py-2"><div className="flex flex-wrap gap-x-4 gap-y-1 text-[#b9b0a4]">{employee.email ? <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" />{employee.email}</span> : null}{employee.phone ? <span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" />{employee.phone}</span> : null}{!employee.email && !employee.phone ? "—" : null}</div></td>
          <td className="px-3 py-2"><span className={`inline-flex px-1.5 py-0.5 text-[10px] ${employee.is_active ? "bg-emerald-500/10 text-emerald-300" : "bg-white/[0.04] text-[#b9b0a4]"}`}>{employee.is_active ? copy.active : copy.inactive}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>
}
