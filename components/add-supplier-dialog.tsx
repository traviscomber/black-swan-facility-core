"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createBrowserClient } from "@/lib/supabase/client"
import { Textarea } from "@/components/ui/textarea"

interface AddSupplierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSupplierAdded: () => void
}

export function AddSupplierDialog({ open, onOpenChange, onSupplierAdded }: AddSupplierDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    city: "Valdivia",
    country: "Chile",
    payment_terms: "",
    notes: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createBrowserClient()
    const { error: insertError } = await supabase.from("suppliers").insert([{
      ...formData,
      rating: 0,
      is_active: false,
      approval_status: "pending",
      last_verified_at: new Date().toISOString(),
    }])

    if (insertError) {
      setError(`No fue posible agregar el proveedor: ${insertError.message}`)
      setLoading(false)
      return
    }

    onSupplierAdded()
    setFormData({
      name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      city: "Valdivia",
      country: "Chile",
      payment_terms: "",
      notes: "",
    })
    onOpenChange(false)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar candidato a proveedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-96 overflow-y-auto">
          <p className="text-sm text-muted-foreground">El proveedor quedará pendiente e inactivo hasta ser aprobado.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="text-sm font-medium text-muted-foreground">Empresa</label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1" /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Contacto</label><Input value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} className="mt-1" /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Correo</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="mt-1" /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Teléfono</label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="mt-1" /></div>
            <div className="sm:col-span-2"><label className="text-sm font-medium text-muted-foreground">Dirección</label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="mt-1" /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Ciudad</label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="mt-1" /></div>
            <div><label className="text-sm font-medium text-muted-foreground">País</label><Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="mt-1" /></div>
            <div className="sm:col-span-2"><label className="text-sm font-medium text-muted-foreground">Condiciones de pago</label><Input value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} placeholder="Pendiente de validar" className="mt-1" /></div>
            <div className="sm:col-span-2"><label className="text-sm font-medium text-muted-foreground">Notas para aprobación</label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="mt-1" /></div>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Agregar como pendiente"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
