"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Building2, FileText, RefreshCw, ShieldCheck, Wrench } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"

type Infra = { id:string; name:string; category:string; status:string|null; priority:string|null; next_inspection:string|null; last_inspection:string|null; location_id:string|null }
type Inspection = { id:string; infrastructure_id:string; condition:string; status:string; inspected_at:string; next_inspection:string|null; findings:string|null }

const normalize = (value:string) => value.trim().toLowerCase()
const label = (value:string|null) => value ? value.replaceAll("_", " ") : "Sin estado"

export default function InfrastructurePage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [items,setItems]=useState<Infra[]>([])
  const [inspections,setInspections]=useState<Inspection[]>([])
  const [docs,setDocs]=useState(0)
  const [incidents,setIncidents]=useState(0)
  const [tasks,setTasks]=useState(0)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)

  const load = useCallback(async()=>{
    setLoading(true); setError(null)
    const [infra, insp, docCount, incidentCount, taskCount] = await Promise.all([
      supabase.from("infrastructure_plans").select("id,name,category,status,priority,next_inspection,last_inspection,location_id").order("name"),
      supabase.from("infrastructure_inspections").select("id,infrastructure_id,condition,status,inspected_at,next_inspection,findings").order("inspected_at",{ascending:false}).limit(20),
      supabase.from("infrastructure_documents").select("id",{count:"exact",head:true}),
      supabase.from("incidents").select("id",{count:"exact",head:true}).not("infrastructure_id","is",null).neq("status","closed"),
      supabase.from("maintenance_tasks").select("id",{count:"exact",head:true}).not("infrastructure_id","is",null).neq("status","completed"),
    ])
    const e=infra.error||insp.error||docCount.error||incidentCount.error||taskCount.error
    if(e){setError(e.message);setItems([]);setInspections([])} else {
      setItems((infra.data??[]) as Infra[]); setInspections((insp.data??[]) as Inspection[]); setDocs(docCount.count??0); setIncidents(incidentCount.count??0); setTasks(taskCount.count??0)
    }
    setLoading(false)
  },[supabase])
  useEffect(()=>{void load()},[load])

  const categories = new Map<string,Set<string>>()
  items.forEach(i=>{const key=normalize(i.category); if(!categories.has(key)) categories.set(key,new Set()); categories.get(key)!.add(i.category)})
  const duplicatedCategories=[...categories.values()].filter(v=>v.size>1).length
  const overdue=items.filter(i=>i.next_inspection && i.next_inspection < new Date().toISOString().slice(0,10)).length
  const planned=items.filter(i=>normalize(i.status??"")==="planned").length

  return <AppLayout>
    <PageHeader title="Propiedades e Infraestructura" description="Inventario técnico, inspecciones, documentos y mantenimiento asociado a Fundo Corcovado." actions={<Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Actualizar</Button>}/>
    <div className="space-y-6 p-4 sm:p-8">
      {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">No fue posible cargar infraestructura: {error}</CardContent></Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric title="Elementos técnicos" value={items.length} icon={<Building2 className="h-4 w-4"/>}/>
        <Metric title="Planificados" value={planned}/>
        <Metric title="Inspecciones vencidas" value={overdue} alert={overdue>0}/>
        <Metric title="Documentos" value={docs} icon={<FileText className="h-4 w-4"/>}/>
        <Metric title="Incidencias abiertas" value={incidents} alert={incidents>0} icon={<AlertTriangle className="h-4 w-4"/>}/>
        <Metric title="Mantenciones abiertas" value={tasks} alert={tasks>0} icon={<Wrench className="h-4 w-4"/>}/>
      </div>

      {duplicatedCategories>0 && <Card className="border-amber-300"><CardHeader><CardTitle className="text-base">Calidad de datos</CardTitle><CardDescription>Se detectaron {duplicatedCategories} categorías duplicadas solo por mayúsculas/minúsculas. La vista las agrupa, pero no modifica los registros productivos.</CardDescription></CardHeader></Card>}

      <Card><CardHeader><CardTitle>Inventario técnico</CardTitle><CardDescription>Edificios, redes, agua, energía, conectividad y otros sistemas registrados.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Elemento</TableHead><TableHead>Categoría</TableHead><TableHead>Estado</TableHead><TableHead>Prioridad</TableHead><TableHead>Última inspección</TableHead><TableHead>Próxima inspección</TableHead></TableRow></TableHeader><TableBody>
        {loading?<TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Cargando infraestructura…</TableCell></TableRow>:items.map(i=><TableRow key={i.id}><TableCell className="font-medium">{i.name}</TableCell><TableCell>{i.category}</TableCell><TableCell><Badge variant="outline">{label(i.status)}</Badge></TableCell><TableCell>{label(i.priority)}</TableCell><TableCell>{i.last_inspection??"Sin registro"}</TableCell><TableCell className={i.next_inspection&&i.next_inspection<new Date().toISOString().slice(0,10)?"text-destructive font-medium":""}>{i.next_inspection??"Sin programar"}</TableCell></TableRow>)}
      </TableBody></Table></div></CardContent></Card>

      <Card><CardHeader><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/><CardTitle>Inspecciones recientes</CardTitle></div><CardDescription>Historial canónico y hallazgos vinculados a cada elemento de infraestructura.</CardDescription></CardHeader><CardContent>{inspections.length===0?<p className="py-8 text-center text-sm text-muted-foreground">Todavía no existen inspecciones registradas.</p>:<div className="space-y-3">{inspections.map(x=>{const item=items.find(i=>i.id===x.infrastructure_id);return <div key={x.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item?.name??"Infraestructura no disponible"}</p><Badge variant="outline">{label(x.condition)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("es-CL",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Santiago"}).format(new Date(x.inspected_at))}</p>{x.findings&&<p className="mt-2 text-sm">{x.findings}</p>}</div>})}</div>}</CardContent></Card>
    </div>
  </AppLayout>
}

function Metric({title,value,alert=false,icon}:{title:string;value:number;alert?:boolean;icon?:React.ReactNode}){return <Card className={alert?"border-amber-300":undefined}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{icon}{title}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{value.toLocaleString("es-CL")}</CardContent></Card>}
