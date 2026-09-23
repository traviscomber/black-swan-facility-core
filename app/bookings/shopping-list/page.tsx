"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChefHat, ExternalLink, Plus, RefreshCw, Send, ShoppingCart, Sprout } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type ShoppingItem = {
  id: string
  item_name: string
  quantity: number
  unit: string
  notes: string | null
  status: string
  source_strategy: string
  assigned_to: string | null
  orchard_crop_id: string | null
  procurement_request_id: string | null
  reservation_id: string | null
  hospitality_request_id: string | null
  location_id: string | null
  required_date: string | null
  created_at: string
}
type Employee = { id: string; name: string; role: string | null }
type Location = { id: string; name: string }
type Crop = { id: string; crop_name: string; variety: string | null; status: string | null }

const COPY = {
  en: {
    title: "Hospitality shopping list",
    subtitle: "Kitchen and guest-service needs connected to Orchard first, procurement second.",
    add: "Add item", refresh: "Refresh", item: "Item", qty: "Qty", unit: "Unit", required: "Required", source: "Source", owner: "Owner", status: "Status", actions: "Actions",
    orchard: "Orchard", purchase: "Purchase", either: "Orchard or purchase", needed: "Needed", sourcing: "Sourcing", orchardRequested: "Orchard requested", purchaseRequested: "Purchase requested", ready: "Ready", completed: "Completed", cancelled: "Cancelled",
    sendProcurement: "Send to procurement", markOrchard: "Source from Orchard", complete: "Complete", newItem: "New shopping item", notes: "Notes", crop: "Orchard crop", location: "Property", assignee: "Responsible", save: "Add to list", noCrop: "No crop selected", noItems: "No shopping items.", procurement: "Procurement", orchardDesk: "Orchard harvest", carlos: "Carlos Bustamante · Chef / Orchard"
  },
  es: {
    title: "Lista de compras de Hospitality",
    subtitle: "Necesidades de cocina y huéspedes conectadas primero a Orchard y luego a Compras.",
    add: "Agregar ítem", refresh: "Actualizar", item: "Ítem", qty: "Cant.", unit: "Unidad", required: "Requerido", source: "Origen", owner: "Responsable", status: "Estado", actions: "Acciones",
    orchard: "Huerta", purchase: "Comprar", either: "Huerta o compra", needed: "Necesario", sourcing: "Buscando", orchardRequested: "Solicitado a huerta", purchaseRequested: "Compra solicitada", ready: "Listo", completed: "Completado", cancelled: "Cancelado",
    sendProcurement: "Enviar a Compras", markOrchard: "Solicitar a Orchard", complete: "Completar", newItem: "Nuevo ítem de compra", notes: "Notas", crop: "Cultivo de Orchard", location: "Propiedad", assignee: "Responsable", save: "Agregar a lista", noCrop: "Sin cultivo asociado", noItems: "No hay ítems en la lista.", procurement: "Compras", orchardDesk: "Cosecha Orchard", carlos: "Carlos Bustamante · Chef / Huerta"
  },
  de: {
    title: "Hospitality-Einkaufsliste",
    subtitle: "Küchen- und Gästebedarf zuerst mit Orchard, danach mit Einkauf verbunden.",
    add: "Eintrag hinzufügen", refresh: "Aktualisieren", item: "Artikel", qty: "Menge", unit: "Einheit", required: "Benötigt", source: "Quelle", owner: "Verantwortlich", status: "Status", actions: "Aktionen",
    orchard: "Orchard", purchase: "Einkauf", either: "Orchard oder Einkauf", needed: "Benötigt", sourcing: "Beschaffung", orchardRequested: "Orchard angefragt", purchaseRequested: "Einkauf angefragt", ready: "Bereit", completed: "Abgeschlossen", cancelled: "Storniert",
    sendProcurement: "An Einkauf senden", markOrchard: "Bei Orchard anfragen", complete: "Abschließen", newItem: "Neuer Einkaufsartikel", notes: "Notizen", crop: "Orchard-Kultur", location: "Objekt", assignee: "Verantwortlich", save: "Zur Liste hinzufügen", noCrop: "Keine Kultur gewählt", noItems: "Keine Einträge.", procurement: "Einkauf", orchardDesk: "Orchard-Ernte", carlos: "Carlos Bustamante · Chef / Orchard"
  },
} as const

const STATUS_ORDER = ["needed","sourcing","orchard_requested","purchase_requested","ready","completed","cancelled"] as const

export default function HospitalityShoppingListPage() {
  const { language } = useLanguage()
  const c = COPY[language]
  const supabase = useMemo(() => createClient(), [])
  const params = useSearchParams()
  const [items,setItems] = useState<ShoppingItem[]>([])
  const [employees,setEmployees] = useState<Employee[]>([])
  const [locations,setLocations] = useState<Location[]>([])
  const [crops,setCrops] = useState<Crop[]>([])
  const [open,setOpen] = useState(false)
  const [saving,setSaving] = useState(false)
  const [form,setForm] = useState({
    item_name: params.get("item") || "",
    quantity: "1",
    unit: "unit",
    notes: "",
    source_strategy: "either",
    assigned_to: "",
    orchard_crop_id: "none",
    location_id: params.get("location_id") || "",
    reservation_id: params.get("reservation_id") || "",
    hospitality_request_id: params.get("request_id") || "",
    required_date: "",
  })

  const load = useCallback(async () => {
    const [itemsResult,employeesResult,locationsResult,cropsResult] = await Promise.all([
      supabase.from("hospitality_shopping_items").select("id,item_name,quantity,unit,notes,status,source_strategy,assigned_to,orchard_crop_id,procurement_request_id,reservation_id,hospitality_request_id,location_id,required_date,created_at").order("status").order("required_date",{ascending:true,nullsFirst:false}).order("created_at",{ascending:false}),
      supabase.from("employees").select("id,name,role").eq("is_active",true).order("name"),
      supabase.from("locations").select("id,name").eq("is_active",true).order("name"),
      supabase.from("orchard_crops").select("id,crop_name,variety,status").order("crop_name").limit(300),
    ])
    const error = itemsResult.error || employeesResult.error || locationsResult.error
    if (error) {
      toast.error(error.message)
      return
    }
    setItems((itemsResult.data ?? []) as ShoppingItem[])
    const loadedEmployees=(employeesResult.data ?? []) as Employee[]
    setEmployees(loadedEmployees)
    setLocations((locationsResult.data ?? []) as Location[])
    setCrops(cropsResult.error ? [] : (cropsResult.data ?? []) as Crop[])
    setForm(current => {
      if (current.assigned_to) return current
      const carlos = loadedEmployees.find(employee => employee.name.trim().toLowerCase() === "carlos bustamante")
      return { ...current, assigned_to: carlos?.id ?? "" }
    })
  },[supabase])

  useEffect(()=>{ void load() },[load])
  useEffect(()=>{ if(params.get("request_id") || params.get("item")) setOpen(true) },[params])

  const employeeMap=useMemo(()=>new Map(employees.map(row=>[row.id,row])),[employees])
  const locationMap=useMemo(()=>new Map(locations.map(row=>[row.id,row])),[locations])
  const cropMap=useMemo(()=>new Map(crops.map(row=>[row.id,row])),[crops])

  async function addItem(){
    if(!form.item_name.trim() || !form.location_id || Number(form.quantity)<=0) return
    setSaving(true)
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){ toast.error("Session expired"); setSaving(false); return }
    const {error}=await supabase.from("hospitality_shopping_items").insert({
      item_name:form.item_name.trim(),
      quantity:Number(form.quantity),
      unit:form.unit.trim()||"unit",
      notes:form.notes.trim()||null,
      source_strategy:form.source_strategy,
      assigned_to:form.assigned_to||null,
      orchard_crop_id:form.orchard_crop_id==="none"?null:form.orchard_crop_id,
      location_id:form.location_id,
      reservation_id:form.reservation_id||null,
      hospitality_request_id:form.hospitality_request_id||null,
      required_date:form.required_date||null,
      created_by:user.id,
    })
    setSaving(false)
    if(error){ toast.error(error.message); return }
    setOpen(false)
    setForm(current=>({...current,item_name:"",quantity:"1",unit:"unit",notes:"",source_strategy:"either",orchard_crop_id:"none",reservation_id:"",hospitality_request_id:"",required_date:""}))
    await load()
  }

  async function patch(id:string, values:Partial<ShoppingItem>){
    const {error}=await supabase.from("hospitality_shopping_items").update({...values,updated_at:new Date().toISOString()}).eq("id",id)
    if(error) toast.error(error.message); else await load()
  }

  async function sendToProcurement(item:ShoppingItem){
    if(item.procurement_request_id) return
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){ toast.error("Session expired"); return }
    const {data,error}=await supabase.from("procurement_requests").insert({
      title:item.item_name,
      description:item.notes,
      business_justification:"Hospitality / kitchen requirement from the canonical shopping list.",
      category:"Supplies",
      quantity:item.quantity,
      unit:item.unit,
      priority:"normal",
      status:"submitted",
      required_date:item.required_date,
      region:"Los Ríos",
      commune:"Valdivia",
      location_id:item.location_id,
      delivery_location:"Black Swan Hospitality / Kitchen",
      requested_by:user.id,
      source_type:"hospitality_shopping",
      source_ref:item.id,
      source_path:"/bookings/shopping-list",
    }).select("id").single()
    if(error){ toast.error(error.message); return }
    await patch(item.id,{procurement_request_id:data.id,status:"purchase_requested",source_strategy:"purchase"})
  }

  const statusLabel=(value:string)=>{
    const labels:Record<string,string>={needed:c.needed,sourcing:c.sourcing,orchard_requested:c.orchardRequested,purchase_requested:c.purchaseRequested,ready:c.ready,completed:c.completed,cancelled:c.cancelled}
    return labels[value]??value
  }
  const sourceLabel=(value:string)=>value==="orchard"?c.orchard:value==="purchase"?c.purchase:c.either

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 bg-[#211e1a] px-4 py-3">
      <div><h1 className="text-base font-medium">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-none"><Link href={"/" + language + "/orchard/harvest"}><Sprout className="mr-2 h-4 w-4"/>{c.orchardDesk}</Link></Button>
        <Button asChild variant="outline" size="sm" className="rounded-none"><Link href={"/" + language + "/procurement/requests"}><ShoppingCart className="mr-2 h-4 w-4"/>{c.procurement}</Link></Button>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-none" onClick={()=>void load()}><RefreshCw className="h-4 w-4"/></Button>
        <Button size="sm" className="h-9 rounded-none" onClick={()=>setOpen(true)}><Plus className="mr-2 h-4 w-4"/>{c.add}</Button>
      </div>
    </header>

    <div className="border-b border-white/[.06] bg-[#1d1a17] px-4 py-2 text-xs text-[#b9b0a4]">
      <ChefHat className="mr-2 inline h-4 w-4"/>{c.carlos}
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-xs">
        <thead className="bg-[#211e1a] text-left text-[#8f867b]"><tr><th className="px-3 py-2">{c.item}</th><th className="px-3 py-2">{c.qty}</th><th className="px-3 py-2">{c.required}</th><th className="px-3 py-2">{c.source}</th><th className="px-3 py-2">{c.owner}</th><th className="px-3 py-2">{c.status}</th><th className="px-3 py-2 text-right">{c.actions}</th></tr></thead>
        <tbody>
          {items.length===0?<tr><td colSpan={7} className="p-10 text-center text-[#8f867b]">{c.noItems}</td></tr>:items.map(item=>{
            const employee=item.assigned_to?employeeMap.get(item.assigned_to):null
            const crop=item.orchard_crop_id?cropMap.get(item.orchard_crop_id):null
            return <tr key={item.id} className="border-t border-white/[.05] align-top hover:bg-[#211e1a]">
              <td className="px-3 py-3"><div className="font-medium">{item.item_name}</div><div className="mt-1 text-[11px] text-[#8f867b]">{item.notes||"—"}{item.location_id?<span> · {locationMap.get(item.location_id)?.name||""}</span>:null}</div></td>
              <td className="px-3 py-3 tabular-nums">{Number(item.quantity)} {item.unit}</td>
              <td className="px-3 py-3">{item.required_date||"—"}</td>
              <td className="px-3 py-3"><div>{sourceLabel(item.source_strategy)}</div><div className="mt-1 text-[11px] text-[#8f867b]">{crop ? crop.crop_name + (crop.variety ? " · " + crop.variety : "") : c.noCrop}</div></td>
              <td className="px-3 py-3">{employee?<><div>{employee.name}</div><div className="text-[11px] text-[#8f867b]">{employee.role||""}</div></>:"—"}</td>
              <td className="px-3 py-3"><select value={item.status} onChange={event=>void patch(item.id,{status:event.target.value})} className="h-8 bg-[#171512] px-2 text-xs">{STATUS_ORDER.map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select></td>
              <td className="px-3 py-3"><div className="flex justify-end gap-1">
                {item.status!=="completed"&&item.status!=="cancelled"?<Button size="sm" variant="outline" className="h-8 rounded-none" onClick={()=>void patch(item.id,{status:"orchard_requested",source_strategy:"orchard"})}><Sprout className="mr-1.5 h-3.5 w-3.5"/>{c.markOrchard}</Button>:null}
                {!item.procurement_request_id&&item.status!=="completed"&&item.status!=="cancelled"?<Button size="sm" variant="outline" className="h-8 rounded-none" onClick={()=>void sendToProcurement(item)}><Send className="mr-1.5 h-3.5 w-3.5"/>{c.sendProcurement}</Button>:item.procurement_request_id?<Button asChild size="icon" variant="outline" className="h-8 w-8 rounded-none"><Link href={"/" + language + "/procurement/requests/" + item.procurement_request_id}><ExternalLink className="h-3.5 w-3.5"/></Link></Button>:null}
                {item.status==="ready"?<Button size="sm" className="h-8 rounded-none" onClick={()=>void patch(item.id,{status:"completed"})}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5"/>{c.complete}</Button>:null}
              </div></td>
            </tr>
          })}
        </tbody>
      </table>
    </div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl rounded-none"><DialogHeader><DialogTitle>{c.newItem}</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.item}><Input value={form.item_name} onChange={e=>setForm({...form,item_name:e.target.value})}/></Field>
        <div className="grid grid-cols-2 gap-2"><Field label={c.qty}><Input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></Field><Field label={c.unit}><Input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></Field></div>
        <Field label={c.location}><Select value={form.location_id} onValueChange={value=>setForm({...form,location_id:value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{locations.map(row=><SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label={c.required}><Input type="date" value={form.required_date} onChange={e=>setForm({...form,required_date:e.target.value})}/></Field>
        <Field label={c.source}><Select value={form.source_strategy} onValueChange={value=>setForm({...form,source_strategy:value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="either">{c.either}</SelectItem><SelectItem value="orchard">{c.orchard}</SelectItem><SelectItem value="purchase">{c.purchase}</SelectItem></SelectContent></Select></Field>
        <Field label={c.crop}><Select value={form.orchard_crop_id} onValueChange={value=>setForm({...form,orchard_crop_id:value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">{c.noCrop}</SelectItem>{crops.map(row=><SelectItem key={row.id} value={row.id}>{row.crop_name}{row.variety ? " · " + row.variety : ""}</SelectItem>)}</SelectContent></Select></Field>
        <Field label={c.assignee}><Select value={form.assigned_to} onValueChange={value=>setForm({...form,assigned_to:value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{employees.map(row=><SelectItem key={row.id} value={row.id}>{row.name}{row.role ? " · " + row.role : ""}</SelectItem>)}</SelectContent></Select></Field>
        <Field label={c.notes}><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
      </div>
      <div className="flex justify-end"><Button disabled={saving||!form.item_name.trim()||!form.location_id} onClick={()=>void addItem()}>{c.save}</Button></div>
    </DialogContent></Dialog>
  </section>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="space-y-1.5 text-xs text-muted-foreground"><Label>{label}</Label>{children}</label>}
