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

export function AddEmployeeDialog() {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: "", role: "", phone: "", email: "", is_active: true })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const name = formData.name.trim()
    if (!name) return setError("El nombre es obligatorio.")

    setIsSubmitting(true)
    setError(null)
    const supabase = createBrowserClient()
    const { data: duplicate } = await supabase.from("employees").select("id, name").ilike("name", name).limit(1)
    if (duplicate?.length) {
      setError("Ya existe una persona con este nombre. Revisa el registro antes de crear otro.")
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
      setError(`No fue posible registrar a la persona: ${insertError.message}`)
      setIsSubmitting(false)
      return
    }

    toast({ title: "Persona registrada", description: `${name} fue agregada al directorio operativo.` })
    setFormData({ name: "", role: "", phone: "", email: "", is_active: true })
    setOpen(false)
    setIsSubmitting(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Agregar persona</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Agregar persona</DialogTitle>
            <DialogDescription>Registro básico para el equipo operativo de Fundo Corcovado. Esto no crea una cuenta de acceso.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid gap-2"><Label htmlFor="name">Nombre completo *</Label><Input id="name" autoFocus value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Nombre y apellido" required /></div>
            <div className="grid gap-2"><Label htmlFor="role">Función principal</Label><Input id="role" value={formData.role} onChange={(event) => setFormData({ ...formData, role: event.target.value })} placeholder="Ej. Operaciones, mantención, cocina" /></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="phone">Teléfono</Label><Input id="phone" type="tel" inputMode="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="+56 9 1234 5678" /></div>
              <div className="grid gap-2"><Label htmlFor="email">Correo</Label><Input id="email" type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} placeholder="persona@dominio.cl" /></div>
            </div>
            <div className="flex items-center space-x-2"><Checkbox id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })} /><Label htmlFor="is_active" className="cursor-pointer">Actualmente activa en la operación</Label></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Registrar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
