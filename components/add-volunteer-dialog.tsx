"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { createBrowserClient } from "@/lib/supabase/client"
import { VolunteerPhotoUpload } from "@/components/volunteer-photo-upload"
import { useLanguage } from "@/lib/hooks/use-language"

const COPY = {
  en: { add:"Add volunteer", addTitle:"Add volunteer", addDescription:"Add a volunteer to the facility team.", photoTitle:"Add photo", photoDescription:"Add an optional photo for", skip:"Skip & finish", done:"Done", name:"Name", role:"Volunteer role", rolePlaceholder:"e.g. Maintenance assistant", email:"Email", phone:"Phone", start:"Start date", availability:"Availability", availabilityPlaceholder:"e.g. Weekends or flexible", skills:"Skills (comma separated)", skillsPlaceholder:"e.g. Carpentry, gardening", notes:"Notes", notesPlaceholder:"Additional information", active:"Active volunteer", cancel:"Cancel", next:"Next", adding:"Adding…", failed:"Failed to add volunteer" },
  es: { add:"Agregar voluntario", addTitle:"Agregar voluntario", addDescription:"Agrega un voluntario al equipo del recinto.", photoTitle:"Agregar foto", photoDescription:"Agrega una foto opcional para", skip:"Omitir y finalizar", done:"Finalizar", name:"Nombre", role:"Función del voluntario", rolePlaceholder:"Ej. apoyo de mantenimiento", email:"Correo", phone:"Teléfono", start:"Fecha de inicio", availability:"Disponibilidad", availabilityPlaceholder:"Ej. fines de semana o flexible", skills:"Habilidades (separadas por coma)", skillsPlaceholder:"Ej. carpintería, jardinería", notes:"Notas", notesPlaceholder:"Información adicional", active:"Voluntario activo", cancel:"Cancelar", next:"Siguiente", adding:"Agregando…", failed:"No fue posible agregar al voluntario" },
  de: { add:"Freiwilligen hinzufügen", addTitle:"Freiwilligen hinzufügen", addDescription:"Füge dem Betriebsteam eine freiwillige Person hinzu.", photoTitle:"Foto hinzufügen", photoDescription:"Optionales Foto hinzufügen für", skip:"Überspringen & abschließen", done:"Fertig", name:"Name", role:"Rolle", rolePlaceholder:"z. B. Unterstützung Instandhaltung", email:"E-Mail", phone:"Telefon", start:"Startdatum", availability:"Verfügbarkeit", availabilityPlaceholder:"z. B. Wochenenden oder flexibel", skills:"Fähigkeiten (durch Komma getrennt)", skillsPlaceholder:"z. B. Tischlerei, Gartenarbeit", notes:"Notizen", notesPlaceholder:"Zusätzliche Informationen", active:"Aktiv", cancel:"Abbrechen", next:"Weiter", adding:"Wird hinzugefügt…", failed:"Freiwillige Person konnte nicht hinzugefügt werden" },
} as const

const EMPTY_FORM = { name:"", email:"", phone:"", volunteer_role:"", start_date:"", availability:"", skills:"", notes:"", is_active:true }

export function AddVolunteerDialog() {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = COPY[language]
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [volunteerId, setVolunteerId] = useState<string | null>(null)
  const [volunteerName, setVolunteerName] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [formData, setFormData] = useState(EMPTY_FORM)

  const reset = () => { setVolunteerId(null); setVolunteerName(""); setPhotoUrl(""); setFormData(EMPTY_FORM) }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const supabase = createBrowserClient()
      const skillsArray = formData.skills ? formData.skills.split(",").map((value) => value.trim()).filter(Boolean) : []
      const { data, error } = await supabase.from("volunteers").insert([{ name:formData.name, email:formData.email || null, phone:formData.phone || null, volunteer_role:formData.volunteer_role || null, start_date:formData.start_date || null, availability:formData.availability || null, skills:skillsArray.length > 0 ? skillsArray : null, notes:formData.notes || null, is_active:formData.is_active, status:formData.is_active ? "active" : "inactive" }]).select()
      if (error) throw error
      if (data?.length) { setVolunteerId(data[0].id); setVolunteerName(data[0].name) }
    } catch (error) {
      console.error("Error adding volunteer:", error)
      alert(copy.failed)
    } finally { setIsSubmitting(false) }
  }

  const finish = () => { setOpen(false); reset(); router.refresh() }
  const handlePhotoUploaded = (url:string) => { setPhotoUrl(url); setTimeout(finish, 300) }

  if (volunteerId && volunteerName) {
    return <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{copy.add}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[500px]"><DialogHeader><DialogTitle>{copy.photoTitle}</DialogTitle><DialogDescription>{copy.photoDescription} {volunteerName}.</DialogDescription></DialogHeader><div className="py-4"><VolunteerPhotoUpload volunteerId={volunteerId} volunteerName={volunteerName} onPhotoUploaded={handlePhotoUploaded} /></div><DialogFooter><Button type="button" variant="outline" onClick={finish}>{copy.skip}</Button><Button type="button" onClick={() => photoUrl ? handlePhotoUploaded(photoUrl) : finish()}>{copy.done}</Button></DialogFooter></DialogContent>
    </Dialog>
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{copy.add}</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]"><form onSubmit={handleSubmit}><DialogHeader><DialogTitle>{copy.addTitle}</DialogTitle><DialogDescription>{copy.addDescription}</DialogDescription></DialogHeader><div className="grid gap-4 py-4">
      <Field label={`${copy.name} *`} id="volunteer-name"><Input id="volunteer-name" value={formData.name} onChange={(e)=>setFormData({...formData,name:e.target.value})} required /></Field>
      <Field label={copy.role} id="volunteer-role"><Input id="volunteer-role" placeholder={copy.rolePlaceholder} value={formData.volunteer_role} onChange={(e)=>setFormData({...formData,volunteer_role:e.target.value})} /></Field>
      <Field label={copy.email} id="volunteer-email"><Input id="volunteer-email" type="email" value={formData.email} onChange={(e)=>setFormData({...formData,email:e.target.value})} /></Field>
      <Field label={copy.phone} id="volunteer-phone"><Input id="volunteer-phone" type="tel" value={formData.phone} onChange={(e)=>setFormData({...formData,phone:e.target.value})} /></Field>
      <Field label={copy.start} id="volunteer-start"><Input id="volunteer-start" type="date" value={formData.start_date} onChange={(e)=>setFormData({...formData,start_date:e.target.value})} /></Field>
      <Field label={copy.availability} id="volunteer-availability"><Input id="volunteer-availability" placeholder={copy.availabilityPlaceholder} value={formData.availability} onChange={(e)=>setFormData({...formData,availability:e.target.value})} /></Field>
      <Field label={copy.skills} id="volunteer-skills"><Input id="volunteer-skills" placeholder={copy.skillsPlaceholder} value={formData.skills} onChange={(e)=>setFormData({...formData,skills:e.target.value})} /></Field>
      <Field label={copy.notes} id="volunteer-notes"><Textarea id="volunteer-notes" placeholder={copy.notesPlaceholder} value={formData.notes} onChange={(e)=>setFormData({...formData,notes:e.target.value})} rows={3} /></Field>
      <div className="flex items-center gap-2"><Checkbox id="volunteer-active" checked={formData.is_active} onCheckedChange={(checked)=>setFormData({...formData,is_active:checked===true})} /><Label htmlFor="volunteer-active" className="cursor-pointer">{copy.active}</Label></div>
    </div><DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>{copy.cancel}</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? copy.adding : copy.next}</Button></DialogFooter></form></DialogContent>
  </Dialog>
}

function Field({ label, id, children }:{ label:string; id:string; children:React.ReactNode }) { return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label>{children}</div> }
