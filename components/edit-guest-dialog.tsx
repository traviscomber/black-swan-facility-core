"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

interface EditableGuest {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  company_name?: string | null
  address?: string | null
  notes?: string | null
  vip_status?: boolean | null
}

interface EditGuestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guest: EditableGuest
  onSuccess: () => void
}

export function EditGuestDialog({ open, onOpenChange, guest, onSuccess }: EditGuestDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    address: "",
    notes: "",
    vip_status: false,
  })

  const supabase = createBrowserClient()

  useEffect(() => {
    setFormData({
      name: guest.name || "",
      email: guest.email || "",
      phone: guest.phone || "",
      company_name: guest.company_name || "",
      address: guest.address || "",
      notes: guest.notes || "",
      vip_status: guest.vip_status ?? false,
    })
  }, [guest])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from("guests").update(formData).eq("id", guest.id)
      if (error) throw error

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating guest:", error)
      alert("No se pudo actualizar el huésped")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar huésped</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nombre *</Label>
            <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Teléfono</Label>
            <Input id="edit-phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-company-name">Empresa u organización</Label>
            <Input id="edit-company-name" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} placeholder="Opcional" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-address">Dirección</Label>
            <Textarea id="edit-address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notas</Label>
            <Textarea id="edit-notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="edit-vip-status" checked={formData.vip_status} onCheckedChange={(checked) => setFormData({ ...formData, vip_status: checked === true })} />
            <Label htmlFor="edit-vip-status" className="font-normal">Huésped VIP</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Actualizando..." : "Guardar cambios"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
