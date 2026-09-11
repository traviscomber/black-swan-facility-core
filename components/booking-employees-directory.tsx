"use client"

import { Mail, Phone, Users } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import type { Employee } from "@/lib/types"

const COPY = {
  en: { title: "Employees", subtitle: "Canonical Black Swan team directory available to the Booking workspace.", name: "Name", role: "Role", contact: "Contact", status: "Status", active: "Active", inactive: "Inactive", empty: "No employees registered.", loadFailed: "The employee directory could not be loaded." },
  es: { title: "Equipo", subtitle: "Directorio canónico de Black Swan disponible para el workspace de Reservas.", name: "Nombre", role: "Función", contact: "Contacto", status: "Estado", active: "Activo", inactive: "Inactivo", empty: "No hay personas registradas.", loadFailed: "No fue posible cargar el directorio del equipo." },
  de: { title: "Mitarbeiter", subtitle: "Kanonisches Black-Swan-Teamverzeichnis für den Buchungsbereich.", name: "Name", role: "Rolle", contact: "Kontakt", status: "Status", active: "Aktiv", inactive: "Inaktiv", empty: "Keine Mitarbeiter erfasst.", loadFailed: "Das Mitarbeiterverzeichnis konnte nicht geladen werden." },
} as const

export function BookingEmployeesDirectory({ employees, loadFailed }: { employees: Employee[]; loadFailed: boolean }) {
  const { language } = useLanguage()
  const copy = COPY[language]

  return <div className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] items-center justify-between gap-3 border-b border-white/[0.07] bg-[#211e1a] px-4 py-2">
      <div className="min-w-0"><h1 className="truncate text-lg font-medium">{copy.title}</h1><p className="truncate text-xs text-[#b9b0a4]">{copy.subtitle}</p></div>
      <div className="flex items-center gap-2 text-xs text-[#b9b0a4]"><Users className="h-4 w-4" /><span>{employees.length}</span></div>
    </header>

    {loadFailed && <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">{copy.loadFailed}</div>}

    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="border-b border-white/[0.07] bg-[#1c1916] text-left text-[#b9b0a4]"><tr><th className="px-3 py-2 font-medium">{copy.name}</th><th className="px-3 py-2 font-medium">{copy.role}</th><th className="px-3 py-2 font-medium">{copy.contact}</th><th className="px-3 py-2 font-medium">{copy.status}</th></tr></thead>
        <tbody>{employees.length === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-[#b9b0a4]">{copy.empty}</td></tr> : employees.map((employee) => <tr key={employee.id} className="border-b border-white/[0.05] hover:bg-white/[0.025]">
          <td className="px-3 py-2 font-medium">{employee.name}</td>
          <td className="px-3 py-2 text-[#b9b0a4]">{employee.role?.trim() || "—"}</td>
          <td className="px-3 py-2"><div className="flex flex-wrap gap-x-4 gap-y-1 text-[#b9b0a4]">{employee.email ? <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" />{employee.email}</span> : null}{employee.phone ? <span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" />{employee.phone}</span> : null}{!employee.email && !employee.phone ? "—" : null}</div></td>
          <td className="px-3 py-2"><span className={`inline-flex px-1.5 py-0.5 text-[10px] ${employee.is_active ? "bg-emerald-500/10 text-emerald-300" : "bg-white/[0.04] text-[#b9b0a4]"}`}>{employee.is_active ? copy.active : copy.inactive}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>
}
