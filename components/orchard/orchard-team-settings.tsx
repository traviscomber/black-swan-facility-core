"use client"

import { useEffect, useMemo, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Employee={id:string;name:string;email:string|null;role:string|null;is_active:boolean}
type Profile={employee_id:string;canonical_job_title:string|null;primary_operational_area:string|null;secondary_operational_areas:string[]|null}
const copy={
 en:{title:"Team",help:"People canonically associated with Orchard work. Access and monetary visibility are not inferred from job titles.",member:"Team members",status:"Status",role:"Role",money:"Show monetary values",active:"Active",inactive:"Inactive",unknown:"—",none:"No canonical Orchard team members available.",people:"people"},
 es:{title:"Equipo",help:"Personas asociadas canónicamente al trabajo de Orchard. El acceso y la visibilidad monetaria no se infieren desde el cargo.",member:"Miembros del equipo",status:"Estado",role:"Rol",money:"Mostrar valores monetarios",active:"Activo",inactive:"Inactivo",unknown:"—",none:"No hay miembros canónicos del equipo Orchard.",people:"personas"},
 de:{title:"Team",help:"Personen, die kanonisch mit Orchard-Arbeit verbunden sind. Zugriff und Geldwertsichtbarkeit werden nicht aus Rollen abgeleitet.",member:"Teammitglieder",status:"Status",role:"Rolle",money:"Geldwerte anzeigen",active:"Aktiv",inactive:"Inaktiv",unknown:"—",none:"Keine kanonischen Orchard-Teammitglieder verfügbar.",people:"Personen"}
} as const
export function OrchardTeamSettings(){
 const {language}=useLanguage();const t=copy[language as Locale];const supabase=useMemo(()=>createBrowserClient(),[]);const [employees,setEmployees]=useState<Employee[]>([]);const [profiles,setProfiles]=useState<Profile[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null)
 useEffect(()=>{let live=true;void Promise.all([supabase.from("employees").select("id,name,email,role,is_active").order("name"),supabase.from("employee_task_profiles").select("employee_id,canonical_job_title,primary_operational_area,secondary_operational_areas")]).then(([e,p])=>{if(!live)return;const failure=e.error??p.error;if(failure)setError(failure.message);setEmployees((e.data??[]) as Employee[]);setProfiles((p.data??[]) as Profile[]);setLoading(false)});return()=>{live=false}},[supabase])
 const people=useMemo(()=>{const employeeById=new Map(employees.map(e=>[e.id,e]));return profiles.filter(p=>p.primary_operational_area==="orchard"||(p.secondary_operational_areas??[]).includes("orchard")).map(profile=>({profile,employee:employeeById.get(profile.employee_id)})).filter((x):x is {profile:Profile;employee:Employee}=>Boolean(x.employee)).sort((a,b)=>a.employee.name.localeCompare(b.employee.name))},[employees,profiles])
 return <AppLayout><OrchardNavigation/><main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1320px] flex-col px-4 pb-5 pt-4 sm:px-6 lg:px-8">
  <header className="flex flex-col gap-2 border-b border-[var(--orchard-line)] pb-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-[25px] font-normal tracking-[-.03em]">{t.title}</h1><p className="mt-1 max-w-3xl text-[12px] leading-5 text-muted-foreground">{t.help}</p></div><p className="text-[10px] uppercase tracking-[.1em] text-muted-foreground">{people.length} {t.people}</p></header>
  {error?<p className="mt-4 text-sm text-red-300">{error}</p>:null}
  <div className="mt-4 min-h-0 flex-1 overflow-auto border-y border-[var(--orchard-line)]"><table className="w-full min-w-[720px] border-collapse text-[12px]"><thead className="sticky top-0 z-10 bg-[var(--bs-surface-primary)] shadow-[0_1px_0_var(--orchard-line)]"><tr>{[t.member,t.status,t.role,t.money].map(h=><th key={h} className="px-3 py-2.5 text-left text-[9px] font-medium uppercase tracking-[.09em] text-muted-foreground">{h}</th>)}</tr></thead><tbody>{people.map(({employee,profile})=><tr key={employee.id} className="transition-colors hover:bg-[var(--bs-surface-secondary)]/55"><td className="border-b border-[var(--orchard-line-soft)] px-3 py-2.5 font-medium text-[#eee9e1]"><div>{employee.name}</div>{employee.email?<div className="mt-0.5 text-[10px] font-normal text-muted-foreground">{employee.email}</div>:null}</td><Td>{employee.is_active?t.active:t.inactive}</Td><Td>{profile.canonical_job_title||employee.role||t.unknown}</Td><Td>{t.unknown}</Td></tr>)}</tbody></table>{!loading&&!people.length?<div className="flex min-h-[280px] items-center justify-center px-6 text-center text-sm text-muted-foreground">{t.none}</div>:null}</div>
 </main></AppLayout>
}
function Td({children}:{children:React.ReactNode}){return <td className="border-b border-[var(--orchard-line-soft)] px-3 py-2.5 align-top text-[#c4bcb1]">{children}</td>}
