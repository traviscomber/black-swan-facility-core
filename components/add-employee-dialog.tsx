"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/hooks/use-language"

const COPY = {
  en: { add:"Add person", description:"Basic record for the Fundo Corcovado operating team. This does not create an access account.", nameRequired:"Name is required.", duplicate:"A person with this name already exists. Review the record before creating another.", insertError:"The person could not be registered", registered:"Person registered", registeredDescription:"was added to the operating directory.", fullName:"Full name *", namePlaceholder:"First and last name", role:"Primary role", rolePlaceholder:"e.g. Operations, maintenance, kitchen", phone:"Phone", email:"Email", active:"Currently active in operations", cancel:"Cancel", saving:"Saving…", submit:"Register" },
  es: { add:"Agregar persona", description:"Registro básico para el equipo operativo de Fundo Corcovado. Esto no crea una cuenta de acceso.", nameRequired:"El nombre es obligatorio.", duplicate:"Ya existe una persona con este nombre. Revisa el registro antes de crear otro.", insertError:"No fue posible registrar a la persona", registered:"Persona registrada", registeredDescription:"fue agregada al directorio operativo.", fullName:"Nombre completo *", namePlaceholder:"Nombre y apellido", role:"Función principal", rolePlaceholder:"Ej. Operaciones, mantención, cocina", phone:"Teléfono", email:"Correo", active:"Actualmente activa en la operación", cancel:"Cancelar", saving:"Guardando…", submit:"Registrar" },
  de: { add:"Person hinzufügen", description:"Basisdatensatz für das Betriebsteam von Fundo Corcovado. Dadurch wird kein Zugangskonto erstellt.", nameRequired:"Der Name ist erforderlich.", duplicate:"Eine Person mit diesem Namen existiert bereits. Prüfe den Datensatz, bevor du einen weiteren anlegst.", insertError:"Die Person konnte nicht erfasst werden", registered:"Person erfasst", registeredDescription:"wurde dem operativen Verzeichnis hinzugefügt.", fullName:"Vollständiger Name *", namePlaceholder:"Vor- und Nachname", role:"Hauptfunktion", rolePlaceholder:"z. B. Betrieb, Instandhaltung, Küche", phone:"Telefon", email:"E-Mail", active:"Derzeit im Betrieb aktiv", cancel:"Abbrechen", saving:"Speichern…", submit:"Erfassen" },
} as const

export function AddEmployeeDialog() {
  const router = useRouter()
  const { toast } = useToast()
  const { language } = useLanguage()
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: "", role: "", phone: "", email: "", is_active: true })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const name = formData.name.trim()
    if (!name) return setError(copy.nameRequired)

    setIsSubmitting(true)
    setError(null)
    const supabase = createBrowserClient()
    const { data: duplicate } = await supabase.from("employees").select("id, name").ilike("name", name).limit(1)
    if (duplicate?.length) {
      setError(copy.duplicate)
      setIsSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from("employees").insert({
      name,
      role: formData.role.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim().toLowerCase() || null,
      is_active: formData.is_active,
    })

    if (insertError) {
      setError(`${copy.insertError}: ${insertError.message}`)
      setIsSubmitting(false)
      return
    }

    toast({ title: copy.registered, description: `${name} ${copy.registeredDescription}` })
    setFormData({ name: "", role: "", phone: "", email: "", is_active: true })
    setOpen(false)
    setIsSubmitting(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{copy.add}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{copy.add}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid gap-2"><Label htmlFor="name">{copy.fullName}</Label><Input id="name" autoFocus value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder={copy.namePlaceholder} required /></div>
            <div className="grid gap-2"><Label htmlFor="role">{copy.role}</Label><Input id="role" value={formData.role} onChange={(event) => setFormData({ ...formData, role: event.target.value })} placeholder={copy.rolePlaceholder} /></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="phone">{copy.phone}</Label><Input id="phone" type="tel" inputMode="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="+56 9 1234 5678" /></div>
              <div className="grid gap-2"><Label htmlFor="email">{copy.email}</Label><Input id="email" type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} placeholder="persona@dominio.cl" /></div>
            </div>
            <div className="flex items-center space-x-2"><Checkbox id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })} /><Label htmlFor="is_active" className="cursor-pointer">{copy.active}</Label></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>{copy.cancel}</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? copy.saving : copy.submit}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
