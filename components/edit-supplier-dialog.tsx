"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"

interface Supplier {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  rut: string | null
  address: string | null
  commune: string | null
  region: string | null
  category: string | null
  website: string | null
  source_url: string | null
  coverage_notes: string | null
  notes: string | null
  rating: number
}

interface EditSupplierDialogProps {
  supplier: Supplier
  open: boolean
  onOpenChange: (open: boolean) => void
  onSupplierUpdated: () => void
}

export function EditSupplierDialog({ supplier, open, onOpenChange, onSupplierUpdated }: EditSupplierDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: supplier.name,
    contact_name: supplier.contact_name ?? "",
    email: supplier.email ?? "",
    phone: supplier.phone ?? "",
    rut: supplier.rut ?? "",
    address: supplier.address ?? "",
    commune: supplier.commune ?? "",
    region: supplier.region ?? "",
    category: supplier.category ?? "",
    website: supplier.website ?? "",
    source_url: supplier.source_url ?? "",
    coverage_notes: supplier.coverage_notes ?? "",
    notes: supplier.notes ?? "",
    rating: supplier.rating ?? 0,
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createBrowserClient()
    const { error: updateError } = await supabase.from("suppliers").update({
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
      rating: Number.isFinite(formData.rating) ? formData.rating : 0,
      updated_at: new Date().toISOString(),
    }).eq("id", supplier.id)

    if (updateError) {
      setError(`No fue posible actualizar el proveedor: ${updateError.message}`)
      setLoading(false)
      return
    }

    setLoading(false)
    onSupplierUpdated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Editar proveedor</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Field label="Evaluación registrada"><Input type="number" min="0" max="5" step="0.1" value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })} /></Field>
            <div className="sm:col-span-2"><Field label="Cobertura y capacidad"><Textarea value={formData.coverage_notes} onChange={(e) => setFormData({ ...formData, coverage_notes: e.target.value })} rows={3} /></Field></div>
            <div className="sm:col-span-2"><Field label="Notas internas"><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} /></Field></div>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar cambios"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-sm font-medium">{label}{required ? " *" : ""}</label>{children}</div>
}
