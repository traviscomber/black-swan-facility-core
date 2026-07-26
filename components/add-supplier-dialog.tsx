"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"

interface AddSupplierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSupplierAdded: () => void
}

const initialForm = {
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  rut: "",
  address: "",
  commune: "Valdivia",
  region: "Los Ríos",
  category: "",
  website: "",
  source_url: "",
  coverage_notes: "",
  notes: "",
}

export function AddSupplierDialog({ open, onOpenChange, onSupplierAdded }: AddSupplierDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState(initialForm)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createBrowserClient()
    const { error: insertError } = await supabase.from("suppliers").insert({
      name: formData.name.trim(),
      contact_name: formData.contact_name.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      rut: formData.rut.trim() || null,
      address: formData.address.trim() || null,
      commune: formData.commune.trim() || null,
      region: formData.region.trim() || null,
      category: formData.category.trim() || null,
      website: formData.website.trim() || null,
      source_url: formData.source_url.trim() || null,
      coverage_notes: formData.coverage_notes.trim() || null,
      notes: formData.notes.trim() || null,
      rating: 0,
      is_active: false,
      approval_status: "pending",
      last_verified_at: new Date().toISOString(),
    })

    if (insertError) {
      setError(`No fue posible agregar el proveedor: ${insertError.message}`)
      setLoading(false)
      return
    }

    setFormData(initialForm)
    setLoading(false)
    onSupplierAdded()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Agregar candidato a proveedor</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">El registro quedará pendiente e inactivo hasta que un aprobador autorizado lo habilite.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Empresa" required><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></Field>
            <Field label="Categoría"><Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></Field>
            <Field label="Contacto"><Input value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} /></Field>
            <Field label="RUT"><Input value={formData.rut} onChange={(e) => setFormData({ ...formData, rut: e.target.value })} /></Field>
            <Field label="Correo"><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></Field>
            <Field label="Teléfono"><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></Field>
            <Field label="Comuna"><Input value={formData.commune} onChange={(e) => setFormData({ ...formData, commune: e.target.value })} /></Field>
            <Field label="Región"><Input value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Dirección"><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></Field></div>
            <Field label="Sitio web"><Input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} /></Field>
            <Field label="Fuente de verificación"><Input type="url" value={formData.source_url} onChange={(e) => setFormData({ ...formData, source_url: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Cobertura y capacidad"><Textarea value={formData.coverage_notes} onChange={(e) => setFormData({ ...formData, coverage_notes: e.target.value })} rows={3} /></Field></div>
            <div className="sm:col-span-2"><Field label="Notas para aprobación"><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} /></Field></div>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Agregar como pendiente"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-sm font-medium">{label}{required ? " *" : ""}</label>{children}</div>
}
