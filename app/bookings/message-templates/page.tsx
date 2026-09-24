"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, Edit, Plus, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type TemplateRow = {
  id: string
  template_key: string
  name: string
  event_type: string
  channel: string
  subject_template: string | null
  body_template: string
  is_active: boolean
  requires_manual_approval: boolean
}

const emptyForm = { template_key:"", name:"", event_type:"prearrival", channel:"email", subject_template:"", body_template:"", is_active:true, requires_manual_approval:true }

const copy = {
  en: { title:"Message templates", subtitle:"Canonical guest communication templates. The original BedBooking pre-arrival template is preserved as a legacy record.", add:"New template", edit:"Edit template", key:"Key", name:"Name", event:"Event", channel:"Channel", subject:"Subject", body:"Body", active:"Active", approval:"Manual approval", save:"Save", create:"Create", cancel:"Cancel", copy:"Copy", copied:"Copied", delete:"Delete", readonly:"Your role can read templates but cannot modify them.", empty:"No templates available.", search:"Search templates", all:"All channels" },
  es: { title:"Plantillas de mensajes", subtitle:"Plantillas canónicas para comunicación con huéspedes. El pre-arrival original de BedBooking permanece preservado como legado.", add:"Nueva plantilla", edit:"Editar plantilla", key:"Clave", name:"Nombre", event:"Evento", channel:"Canal", subject:"Asunto", body:"Contenido", active:"Activa", approval:"Aprobación manual", save:"Guardar", create:"Crear", cancel:"Cancelar", copy:"Copiar", copied:"Copiado", delete:"Eliminar", readonly:"Tu rol puede leer plantillas, pero no modificarlas.", empty:"No hay plantillas disponibles.", search:"Buscar plantillas", all:"Todos los canales" },
  de: { title:"Nachrichtenvorlagen", subtitle:"Kanonische Vorlagen für Gästekommunikation. Die originale BedBooking-Pre-Arrival-Vorlage bleibt als Altbestand erhalten.", add:"Neue Vorlage", edit:"Vorlage bearbeiten", key:"Schlüssel", name:"Name", event:"Ereignis", channel:"Kanal", subject:"Betreff", body:"Inhalt", active:"Aktiv", approval:"Manuelle Freigabe", save:"Speichern", create:"Erstellen", cancel:"Abbrechen", copy:"Kopieren", copied:"Kopiert", delete:"Löschen", readonly:"Ihre Rolle kann Vorlagen lesen, aber nicht ändern.", empty:"Keine Vorlagen verfügbar.", search:"Vorlagen suchen", all:"Alle Kanäle" },
} as const

export default function MessageTemplatesPage() {
  const { language } = useLanguage()
  const c = copy[language]
  const supabase = useMemo(() => createClient(), [])
  const [rows,setRows] = useState<TemplateRow[]>([])
  const [canManage,setCanManage] = useState(false)
  const [open,setOpen] = useState(false)
  const [editing,setEditing] = useState<TemplateRow|null>(null)
  const [form,setForm] = useState(emptyForm)
  const [copied,setCopied] = useState<string|null>(null)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState<string|null>(null)
  const [query,setQuery] = useState("")
  const [channelFilter,setChannelFilter] = useState("all")

  const load = useCallback(async()=>{
    const [{data,error:loadError},{data:{user}}] = await Promise.all([
      supabase.from("booking_message_templates").select("id,template_key,name,event_type,channel,subject_template,body_template,is_active,requires_manual_approval").order("event_type").order("name"),
      supabase.auth.getUser(),
    ])
    if(loadError){ setError(loadError.message); setRows([]) } else { setError(null); setRows((data??[]) as TemplateRow[]) }
    const role = String(user?.app_metadata?.procurement_role ?? "")
    setCanManage(role==="admin" || role==="approver")
  },[supabase])

  useEffect(()=>{ void load() },[load])

  function openCreate(){ setEditing(null); setForm(emptyForm); setOpen(true) }
  function openEdit(row:TemplateRow){
    setEditing(row)
    setForm({template_key:row.template_key,name:row.name,event_type:row.event_type,channel:row.channel,subject_template:row.subject_template??"",body_template:row.body_template,is_active:row.is_active,requires_manual_approval:row.requires_manual_approval})
    setOpen(true)
  }

  async function save(){
    if(!canManage || !form.template_key.trim() || !form.name.trim() || !form.event_type.trim() || !form.channel.trim() || !form.body_template.trim()) return
    setSaving(true); setError(null)
    const payload = {
      template_key:form.template_key.trim(),
      name:form.name.trim(),
      event_type:form.event_type.trim(),
      channel:form.channel,
      subject_template:form.subject_template.trim()||null,
      body_template:form.body_template,
      is_active:form.is_active,
      requires_manual_approval:form.requires_manual_approval,
      updated_at:new Date().toISOString(),
    }
    const result = editing
      ? await supabase.from("booking_message_templates").update(payload).eq("id",editing.id)
      : await supabase.from("booking_message_templates").insert(payload)
    if(result.error) setError(result.error.message)
    else { setOpen(false); setEditing(null); setForm(emptyForm); await load() }
    setSaving(false)
  }

  async function remove(row:TemplateRow){
    if(!canManage || !window.confirm(`${c.delete}: ${row.name}?`)) return
    const {error:deleteError}=await supabase.from("booking_message_templates").delete().eq("id",row.id)
    if(deleteError)setError(deleteError.message); else await load()
  }

  const visibleRows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (channelFilter !== "all" && row.channel !== channelFilter) return false
      if (!term) return true
      return [row.name,row.template_key,row.event_type,row.channel,row.subject_template,row.body_template].filter(Boolean).join(" ").toLowerCase().includes(term)
    })
  }, [rows, query, channelFilter])

  async function copyBody(row:TemplateRow){
    await navigator.clipboard.writeText(row.body_template)
    setCopied(row.id)
    window.setTimeout(()=>setCopied(null),1200)
  }

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] items-center justify-between gap-3 bg-[#211e1a] px-4 py-3">
      <div><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle} · {visibleRows.length}/{rows.length}</p></div>
      {canManage?<button type="button" onClick={openCreate} className="inline-flex h-8 items-center gap-2 bg-[#d7ccb9] px-3 text-xs text-[#171512]"><Plus className="h-3.5 w-3.5"/>{c.add}</button>:null}
    </header>
    {!canManage?<div className="bg-[#2b2722] px-4 py-2 text-xs text-[#8f867b]">{c.readonly}</div>:null}
    {error?<div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    <div className="flex min-h-10 items-center gap-2 border-b border-[#39342d] bg-[#211e1a] px-3 py-1"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8f867b]"/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder={c.search} className="h-8 w-full bg-[#171512] pl-9 pr-3 text-xs outline-none focus:ring-1 focus:ring-[#6f8373]"/></div><select value={channelFilter} onChange={(event)=>setChannelFilter(event.target.value)} className="h-8 min-w-36 bg-[#171512] px-2 text-xs"><option value="all">{c.all}</option><option value="email">email</option><option value="whatsapp">whatsapp</option><option value="sms">sms</option></select></div>
    <div className="divide-y divide-[#39342d]">
      {visibleRows.length===0?<div className="p-8 text-sm text-[#8f867b]">{c.empty}</div>:visibleRows.map(row=><article key={row.id} className="bg-[#171512] p-4 hover:bg-[#1d1a17]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium">{row.name}</h2><span className={`px-1.5 py-0.5 text-[10px] ${row.is_active?"bg-[#2f3a31] text-[#bcd0bf]":"bg-[#2b2722] text-[#8f867b]"}`}>{row.is_active?c.active:"OFF"}</span>{row.requires_manual_approval?<span className="bg-[#3d3423] px-1.5 py-0.5 text-[10px] text-[#d3ad61]">{c.approval}</span>:null}</div><p className="mt-1 text-[11px] text-[#8f867b]">{row.template_key} · {row.event_type} · {row.channel}</p>{row.subject_template?<p className="mt-2 text-xs text-[#b9b0a4]">{c.subject}: {row.subject_template}</p>:null}</div>
          <div className="flex gap-1"><button onClick={()=>void copyBody(row)} className="inline-flex h-8 items-center gap-2 bg-[#2b2722] px-3 text-xs hover:bg-[#332e28]"><Copy className="h-3.5 w-3.5"/>{copied===row.id?c.copied:c.copy}</button>{canManage?<><button onClick={()=>openEdit(row)} className="inline-flex h-8 items-center gap-2 bg-[#2b2722] px-3 text-xs hover:bg-[#332e28]"><Edit className="h-3.5 w-3.5"/>{c.edit}</button><button onClick={()=>void remove(row)} className="inline-flex h-8 items-center gap-2 bg-[#2b2722] px-3 text-xs hover:bg-[#3a2522]"><Trash2 className="h-3.5 w-3.5"/>{c.delete}</button></>:null}</div>
        </div>
        <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-[#b9b0a4]">{row.body_template}</pre>
      </article>)}
    </div>

    {open?<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={()=>setOpen(false)}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-[#211e1a] p-5" onMouseDown={(event)=>event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-medium">{editing?c.edit:c.add}</h2><button onClick={()=>setOpen(false)} className="text-xs text-[#8f867b]">×</button></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={c.key}><input value={form.template_key} disabled={Boolean(editing)} onChange={(e)=>setForm({...form,template_key:e.target.value})} className="h-9 w-full bg-[#171512] px-3 text-sm disabled:opacity-60"/></Field>
          <Field label={c.name}><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="h-9 w-full bg-[#171512] px-3 text-sm"/></Field>
          <Field label={c.event}><input value={form.event_type} onChange={(e)=>setForm({...form,event_type:e.target.value})} className="h-9 w-full bg-[#171512] px-3 text-sm"/></Field>
          <Field label={c.channel}><select value={form.channel} onChange={(e)=>setForm({...form,channel:e.target.value})} className="h-9 w-full bg-[#171512] px-3 text-sm"><option value="email">email</option><option value="whatsapp">whatsapp</option><option value="sms">sms</option></select></Field>
        </div>
        <Field label={c.subject}><input value={form.subject_template} onChange={(e)=>setForm({...form,subject_template:e.target.value})} className="h-9 w-full bg-[#171512] px-3 text-sm"/></Field>
        <Field label={c.body}><textarea rows={14} value={form.body_template} onChange={(e)=>setForm({...form,body_template:e.target.value})} className="w-full bg-[#171512] p-3 text-sm leading-5"/></Field>
        <div className="mt-3 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e)=>setForm({...form,is_active:e.target.checked})}/>{c.active}</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requires_manual_approval} onChange={(e)=>setForm({...form,requires_manual_approval:e.target.checked})}/>{c.approval}</label></div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={()=>setOpen(false)} className="h-9 bg-[#2b2722] px-4 text-xs">{c.cancel}</button><button disabled={saving} onClick={()=>void save()} className="h-9 bg-[#6f8373] px-4 text-xs font-medium text-[#171512] disabled:opacity-50">{editing?c.save:c.create}</button></div>
      </div>
    </div>:null}
  </section>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="mt-3 block text-xs text-[#b9b0a4]"><span className="mb-1.5 block">{label}</span>{children}</label>}
