"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { createBrowserClient } from "@/lib/supabase/client"
import { VolunteerPhotoUpload } from "@/components/volunteer-photo-upload"
import { useLanguage } from "@/lib/hooks/use-language"
import type { Volunteer } from "@/lib/types"

const COPY = {
  en: { edit:"Edit", title:"Edit volunteer", description:"Update volunteer information.", name:"Name", role:"Volunteer role", email:"Email", phone:"Phone", start:"Start date", end:"End date", hours:"Hours logged", availability:"Availability", skills:"Skills (comma separated)", notes:"Notes", active:"Active volunteer", cancel:"Cancel", save:"Save changes", saving:"Saving…", failed:"Failed to update volunteer" },
  es: { edit:"Editar", title:"Editar voluntario", description:"Actualiza la información del voluntario.", name:"Nombre", role:"Función del voluntario", email:"Correo", phone:"Teléfono", start:"Fecha de inicio", end:"Fecha de término", hours:"Horas registradas", availability:"Disponibilidad", skills:"Habilidades (separadas por coma)", notes:"Notas", active:"Voluntario activo", cancel:"Cancelar", save:"Guardar cambios", saving:"Guardando…", failed:"No fue posible actualizar al voluntario" },
  de: { edit:"Bearbeiten", title:"Freiwilligen bearbeiten", description:"Informationen zur freiwilligen Person aktualisieren.", name:"Name", role:"Rolle", email:"E-Mail", phone:"Telefon", start:"Startdatum", end:"Enddatum", hours:"Erfasste Stunden", availability:"Verfügbarkeit", skills:"Fähigkeiten (durch Komma getrennt)", notes:"Notizen", active:"Aktiv", cancel:"Abbrechen", save:"Änderungen speichern", saving:"Wird gespeichert…", failed:"Freiwillige Person konnte nicht aktualisiert werden" },
} as const

export function EditVolunteerDialog({ volunteer }: { volunteer: Volunteer }) {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = COPY[language]
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({ name:volunteer.name || "", email:volunteer.email || "", phone:volunteer.phone || "", volunteer_role:volunteer.volunteer_role || "", start_date:volunteer.start_date || "", end_date:volunteer.end_date || "", availability:volunteer.availability || "", skills:volunteer.skills ? volunteer.skills.join(", ") : "", notes:volunteer.notes || "", hours_logged:volunteer.hours_logged || 0, is_active:volunteer.is_active ?? true, photo_url:volunteer.photo_url || "" })

  const handleSubmit = async (event:React.FormEvent) => {
    event.preventDefault(); setIsSubmitting(true)
    try {
      const supabase = createBrowserClient()
      const skillsArray = formData.skills ? formData.skills.split(",").map((value)=>value.trim()).filter(Boolean) : []
      const { error } = await supabase.from("volunteers").update({ name:formData.name, email:formData.email || null, phone:formData.phone || null, volunteer_role:formData.volunteer_role || null, start_date:formData.start_date || null, end_date:formData.end_date || null, availability:formData.availability || null, skills:skillsArray.length > 0 ? skillsArray : null, notes:formData.notes || null, hours_logged:formData.hours_logged, is_active:formData.is_active, status:formData.is_active ? "active" : "inactive", photo_url:formData.photo_url || null, updated_at:new Date().toISOString() }).eq("id", volunteer.id)
      if (error) throw error
      setOpen(false); router.refresh()
    } catch (error) { console.error("Error updating volunteer:", error); alert(copy.failed) }
    finally { setIsSubmitting(false) }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm" className="flex-1 bg-transparent"><Edit className="mr-1 h-4 w-4" />{copy.edit}</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]"><form onSubmit={handleSubmit}><DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></DialogHeader><div className="grid gap-4 py-4">
      <VolunteerPhotoUpload volunteerId={volunteer.id} volunteerName={volunteer.name} currentPhotoUrl={formData.photo_url} onPhotoUploaded={(url)=>setFormData({...formData,photo_url:url})} />
      <Field label={`${copy.name} *`} id={`edit-volunteer-name-${volunteer.id}`}><Input id={`edit-volunteer-name-${volunteer.id}`} value={formData.name} onChange={(e)=>setFormData({...formData,name:e.target.value})} required /></Field>
      <Field label={copy.role} id={`edit-volunteer-role-${volunteer.id}`}><Input id={`edit-volunteer-role-${volunteer.id}`} value={formData.volunteer_role} onChange={(e)=>setFormData({...formData,volunteer_role:e.target.value})} /></Field>
      <Field label={copy.email} id={`edit-volunteer-email-${volunteer.id}`}><Input id={`edit-volunteer-email-${volunteer.id}`} type="email" value={formData.email} onChange={(e)=>setFormData({...formData,email:e.target.value})} /></Field>
      <Field label={copy.phone} id={`edit-volunteer-phone-${volunteer.id}`}><Input id={`edit-volunteer-phone-${volunteer.id}`} type="tel" value={formData.phone} onChange={(e)=>setFormData({...formData,phone:e.target.value})} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label={copy.start} id={`edit-volunteer-start-${volunteer.id}`}><Input id={`edit-volunteer-start-${volunteer.id}`} type="date" value={formData.start_date} onChange={(e)=>setFormData({...formData,start_date:e.target.value})} /></Field><Field label={copy.end} id={`edit-volunteer-end-${volunteer.id}`}><Input id={`edit-volunteer-end-${volunteer.id}`} type="date" value={formData.end_date} onChange={(e)=>setFormData({...formData,end_date:e.target.value})} /></Field></div>
      <Field label={copy.hours} id={`edit-volunteer-hours-${volunteer.id}`}><Input id={`edit-volunteer-hours-${volunteer.id}`} type="number" step="0.5" value={formData.hours_logged} onChange={(e)=>setFormData({...formData,hours_logged:Number.parseFloat(e.target.value)||0})} /></Field>
      <Field label={copy.availability} id={`edit-volunteer-availability-${volunteer.id}`}><Input id={`edit-volunteer-availability-${volunteer.id}`} value={formData.availability} onChange={(e)=>setFormData({...formData,availability:e.target.value})} /></Field>
      <Field label={copy.skills} id={`edit-volunteer-skills-${volunteer.id}`}><Input id={`edit-volunteer-skills-${volunteer.id}`} value={formData.skills} onChange={(e)=>setFormData({...formData,skills:e.target.value})} /></Field>
      <Field label={copy.notes} id={`edit-volunteer-notes-${volunteer.id}`}><Textarea id={`edit-volunteer-notes-${volunteer.id}`} value={formData.notes} onChange={(e)=>setFormData({...formData,notes:e.target.value})} rows={3} /></Field>
      <div className="flex items-center gap-2"><Checkbox id={`edit-volunteer-active-${volunteer.id}`} checked={formData.is_active} onCheckedChange={(checked)=>setFormData({...formData,is_active:checked===true})} /><Label htmlFor={`edit-volunteer-active-${volunteer.id}`} className="cursor-pointer">{copy.active}</Label></div>
    </div><DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>{copy.cancel}</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? copy.saving : copy.save}</Button></DialogFooter></form></DialogContent>
  </Dialog>
}

function Field({ label, id, children }:{ label:string; id:string; children:React.ReactNode }) { return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label>{children}</div> }
