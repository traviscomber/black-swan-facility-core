"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { createBrowserClient } from "@/lib/supabase/client"
import { EmployeePhotoUpload } from "@/components/employee-photo-upload"
import type { Employee } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/hooks/use-language"

interface EditEmployeeDialogProps {
  employee: Employee
}

const COPY = {
  en: { edit:"Edit", title:"Edit person", description:"Update role, contact details, photo or operational status.", nameRequired:"Name is required.", saveError:"Changes could not be saved", updated:"Record updated", updatedDescription:"was updated in the directory.", fullName:"Full name *", role:"Primary role", rolePlaceholder:"e.g. Operations, maintenance, kitchen", phone:"Phone", email:"Email", active:"Currently active in operations", cancel:"Cancel", saving:"Saving…", save:"Save changes" },
  es: { edit:"Editar", title:"Editar persona", description:"Actualiza función, contacto, fotografía o estado operativo.", nameRequired:"El nombre es obligatorio.", saveError:"No fue posible guardar los cambios", updated:"Registro actualizado", updatedDescription:"quedó actualizado en el directorio.", fullName:"Nombre completo *", role:"Función principal", rolePlaceholder:"Ej. Operaciones, mantención, cocina", phone:"Teléfono", email:"Correo", active:"Actualmente activa en la operación", cancel:"Cancelar", saving:"Guardando…", save:"Guardar cambios" },
  de: { edit:"Bearbeiten", title:"Person bearbeiten", description:"Funktion, Kontaktdaten, Foto oder Betriebsstatus aktualisieren.", nameRequired:"Der Name ist erforderlich.", saveError:"Änderungen konnten nicht gespeichert werden", updated:"Datensatz aktualisiert", updatedDescription:"wurde im Verzeichnis aktualisiert.", fullName:"Vollständiger Name *", role:"Hauptfunktion", rolePlaceholder:"z. B. Betrieb, Instandhaltung, Küche", phone:"Telefon", email:"E-Mail", active:"Derzeit im Betrieb aktiv", cancel:"Abbrechen", saving:"Speichern…", save:"Änderungen speichern" },
} as const

export function EditEmployeeDialog({ employee }: EditEmployeeDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { language } = useLanguage()
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: employee.name?.trim() || "",
    role: employee.role?.trim() || "",
    phone: employee.phone || "",
    email: employee.email || "",
    is_active: employee.is_active ?? true,
    photo_url: employee.photo_url || "",
  })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const name = formData.name.trim()
    if (!name) return setError(copy.nameRequired)

    setIsSubmitting(true)
    setError(null)
    const supabase = createBrowserClient()
    const { error: updateError } = await supabase.from("employees").update({
      name,
      role: formData.role.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim().toLowerCase() || null,
      is_active: formData.is_active,
      photo_url: formData.photo_url || null,
      updated_at: new Date().toISOString(),
    }).eq("id", employee.id)

    if (updateError) {
      setError(`${copy.saveError}: ${updateError.message}`)
      setIsSubmitting(false)
      return
    }

    toast({ title: copy.updated, description: `${name} ${copy.updatedDescription}` })
    setOpen(false)
    setIsSubmitting(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="flex-1 gap-1 bg-transparent"><Edit className="h-4 w-4" />{copy.edit}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
            <EmployeePhotoUpload employeeId={employee.id} employeeName={employee.name} currentPhotoUrl={formData.photo_url} onPhotoUploaded={(url) => setFormData({ ...formData, photo_url: url })} />
            <div className="grid gap-2"><Label htmlFor={`edit-name-${employee.id}`}>{copy.fullName}</Label><Input id={`edit-name-${employee.id}`} value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required /></div>
            <div className="grid gap-2"><Label htmlFor={`edit-role-${employee.id}`}>{copy.role}</Label><Input id={`edit-role-${employee.id}`} value={formData.role} onChange={(event) => setFormData({ ...formData, role: event.target.value })} placeholder={copy.rolePlaceholder} /></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor={`edit-phone-${employee.id}`}>{copy.phone}</Label><Input id={`edit-phone-${employee.id}`} type="tel" inputMode="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="+56 9 1234 5678" /></div>
              <div className="grid gap-2"><Label htmlFor={`edit-email-${employee.id}`}>{copy.email}</Label><Input id={`edit-email-${employee.id}`} type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} placeholder="persona@dominio.cl" /></div>
            </div>
            <div className="flex items-center space-x-2"><Checkbox id={`edit-active-${employee.id}`} checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })} /><Label htmlFor={`edit-active-${employee.id}`} className="cursor-pointer">{copy.active}</Label></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>{copy.cancel}</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? copy.saving : copy.save}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
