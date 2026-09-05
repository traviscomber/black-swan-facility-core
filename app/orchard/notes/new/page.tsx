"use client"

import { FormEvent, useMemo, useState } from "react"
import { ArrowLeft, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

const copy={
 en:{eyebrow:"Orchard · Notes",title:"New note",description:"Capture an operational observation without leaving the daily workflow.",noteTitle:"Title",optional:"Optional",body:"Note",placeholder:"Write an operational observation…",save:"Save note",saving:"Saving…",cancel:"Back to notes",required:"Write a note before saving.",error:"Could not save note."},
 es:{eyebrow:"Huerto · Notas",title:"Nueva nota",description:"Registra una observación operacional sin salir del flujo diario.",noteTitle:"Título",optional:"Opcional",body:"Nota",placeholder:"Escribe una observación operacional…",save:"Guardar nota",saving:"Guardando…",cancel:"Volver a notas",required:"Escribe una nota antes de guardar.",error:"No fue posible guardar la nota."},
 de:{eyebrow:"Orchard · Notizen",title:"Neue Notiz",description:"Eine operative Beobachtung erfassen, ohne den Tagesablauf zu verlassen.",noteTitle:"Titel",optional:"Optional",body:"Notiz",placeholder:"Operative Beobachtung schreiben…",save:"Notiz speichern",saving:"Speichern…",cancel:"Zurück zu Notizen",required:"Vor dem Speichern eine Notiz schreiben.",error:"Notiz konnte nicht gespeichert werden."},
} as const

export default function OrchardNewNotePage(){
 const supabase=useMemo(()=>createBrowserClient(),[])
 const router=useRouter()
 const {language}=useLanguage()
 const text=copy[language]
 const [title,setTitle]=useState("")
 const [body,setBody]=useState("")
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState<string|null>(null)

 async function submit(event:FormEvent){
  event.preventDefault()
  setError(null)
  if(!body.trim()){setError(text.required);return}
  setSaving(true)
  const result=await supabase.from("orchard_notes").insert({note_type:"observation",title:title.trim()||null,body:body.trim(),observed_at:new Date().toISOString()}).select("id").single()
  if(result.error){setError(`${text.error} ${result.error.message}`);setSaving(false);return}
  router.push(`/${language}/orchard/notes`)
  router.refresh()
 }

 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 lg:px-8">
  <button type="button" onClick={()=>router.push(`/${language}/orchard/notes`)} className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>{text.cancel}</button>
  <header className="border-b border-[var(--orchard-line)] pb-5"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--orchard-green)]">{text.eyebrow}</p><h1 className="mt-1 text-3xl font-normal">{text.title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{text.description}</p></header>
  <form onSubmit={submit} className="mt-5 border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] p-5 sm:p-6">
   <label className="block"><span className="mb-1.5 block text-xs text-muted-foreground">{text.noteTitle} · {text.optional}</span><input autoFocus value={title} onChange={event=>setTitle(event.target.value)} className="h-11 w-full border border-[var(--orchard-line)] bg-[var(--bs-surface-secondary)] px-3 text-sm outline-none focus:border-[var(--orchard-green)]"/></label>
   <label className="mt-4 block"><span className="mb-1.5 block text-xs text-muted-foreground">{text.body}</span><textarea value={body} onChange={event=>setBody(event.target.value)} placeholder={text.placeholder} rows={12} className="w-full resize-y border border-[var(--orchard-line)] bg-[var(--bs-surface-secondary)] p-3 text-sm leading-6 outline-none focus:border-[var(--orchard-green)]"/></label>
   {error?<p className="mt-3 text-xs text-red-300">{error}</p>:null}
   <div className="mt-5 flex justify-end"><button type="submit" disabled={saving||!body.trim()} className="inline-flex min-h-10 items-center gap-2 bg-[var(--orchard-green)] px-4 text-sm font-medium text-black disabled:opacity-50"><Save className="h-4 w-4"/>{saving?text.saving:text.save}</button></div>
  </form>
 </main></AppLayout>
}
