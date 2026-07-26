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

interface EditEmployeeDialogProps {
  employee: Employee
}

export function EditEmployeeDialog({ employee }: EditEmployeeDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
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
    if (!name) return setError("El nombre es obligatorio.")

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
      setError(`No fue posible guardar los cambios: ${updateError.message}`)
      setIsSubmitting(false)
      return
    }

    toast({ title: "Registro actualizado", description: `${name} quedó actualizado en el directorio.` })
    setOpen(false)
    setIsSubmitting(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="flex-1 gap-1 bg-transparent"><Edit className="h-4 w-4" />Editar</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader><DialogTitle>Editar persona</DialogTitle><DialogDescription>Actualiza función, contacto, fotografía o estado operativo.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
            <EmployeePhotoUpload employeeId={employee.id} employeeName={employee.name} currentPhotoUrl={formData.photo_url} onPhotoUploaded={(url) => setFormData({ ...formData, photo_url: url })} />
            <div className="grid gap-2"><Label htmlFor={`edit-name-${employee.id}`}>Nombre completo *</Label><Input id={`edit-name-${employee.id}`} value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required /></div>
            <div className="grid gap-2"><Label htmlFor={`edit-role-${employee.id}`}>Función principal</Label><Input id={`edit-role-${employee.id}`} value={formData.role} onChange={(event) => setFormData({ ...formData, role: event.target.value })} placeholder="Ej. Operaciones, mantención, cocina" /></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor={`edit-phone-${employee.id}`}>Teléfono</Label><Input id={`edit-phone-${employee.id}`} type="tel" inputMode="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="+56 9 1234 5678" /></div>
              <div className="grid gap-2"><Label htmlFor={`edit-email-${employee.id}`}>Correo</Label><Input id={`edit-email-${employee.id}`} type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} placeholder="persona@dominio.cl" /></div>
            </div>
            <div className="flex items-center space-x-2"><Checkbox id={`edit-active-${employee.id}`} checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })} /><Label htmlFor={`edit-active-${employee.id}`} className="cursor-pointer">Actualmente activa en la operación</Label></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar cambios"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
