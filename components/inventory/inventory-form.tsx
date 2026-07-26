"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, QrCodeIcon, Upload, X } from "lucide-react"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { CategorySelector } from "./category-selector"

type MetadataOption = { id: string; name: string; code?: string | null }

type InventoryAsset = {
  id: string
  asset_code: string
  name: string
  description?: string | null
  category_id?: string | null
  cost_center_id?: string | null
  serial_number?: string | null
  brand?: string | null
  model?: string | null
  purchase_date?: string | null
  purchase_price?: number | null
  status?: string | null
  location?: string | null
  assigned_to?: string | null
  notes?: string | null
  photo_url?: string | null
  qr_code_url?: string | null
  type?: string | null
}

interface InventoryFormProps {
  asset?: InventoryAsset | null
  categories: MetadataOption[]
  costCenters: MetadataOption[]
  onClose: () => void
  onSuccess: () => void
}

export function InventoryForm({ asset, categories, costCenters, onClose, onSuccess }: InventoryFormProps) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState(asset?.photo_url ?? "")
  const [qrCodeData, setQrCodeData] = useState(asset?.qr_code_url ?? "")
  const [formData, setFormData] = useState({
    asset_code: asset?.asset_code ?? "",
    name: asset?.name ?? "",
    description: asset?.description ?? "",
    category_id: asset?.category_id ?? categories[0]?.id ?? "",
    cost_center_id: asset?.cost_center_id ?? costCenters[0]?.id ?? "",
    serial_number: asset?.serial_number ?? "",
    brand: asset?.brand ?? "",
    model: asset?.model ?? "",
    purchase_date: asset?.purchase_date ?? "",
    purchase_price: asset?.purchase_price?.toString() ?? "",
    status: asset?.status ?? "active",
    location: asset?.location ?? "",
    assigned_to: asset?.assigned_to ?? "",
    notes: asset?.notes ?? "",
  })

  useEffect(() => {
    if (asset || !formData.category_id || !formData.cost_center_id) return
    let cancelled = false

    async function generateAssetCode() {
      const category = categories.find((item) => item.id === formData.category_id)
      const costCenter = costCenters.find((item) => item.id === formData.cost_center_id)
      const categoryCode = category?.code || category?.name.slice(0, 3).toUpperCase() || "ACT"
      const costCenterCode = costCenter?.code || "FC"
      const prefix = `${costCenterCode}-${categoryCode}`
      const { data, error: codeError } = await supabase
        .from("assets")
        .select("asset_code")
        .ilike("asset_code", `${prefix}-%`)
        .order("asset_code", { ascending: false })
        .limit(1)

      if (cancelled) return
      if (codeError) {
        setError(`No fue posible generar el código: ${codeError.message}`)
        return
      }

      const previous = data?.[0]?.asset_code
      const sequence = previous ? Number.parseInt(previous.split("-").at(-1) || "0", 10) + 1 : 1
      const code = `${prefix}-${String(Number.isFinite(sequence) ? sequence : 1).padStart(3, "0")}`
      setFormData((current) => ({ ...current, asset_code: code }))
    }

    void generateAssetCode()
    return () => { cancelled = true }
  }, [asset, categories, costCenters, formData.category_id, formData.cost_center_id, supabase])

  function updateField(name: string, value: string) {
    setFormData((current) => ({ ...current, [name]: value }))
  }

  function handlePhotoSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function generateQrCode() {
    if (!formData.asset_code || !formData.name.trim()) {
      setError("Completa el código y el nombre antes de generar el QR.")
      return
    }
    const qrPayload = `ASSET|${formData.asset_code}|${formData.name.trim()}`
    setQrCodeData(await QRCode.toDataURL(qrPayload, { width: 300, margin: 2 }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!formData.name.trim() || !formData.asset_code || !formData.category_id || !formData.cost_center_id) {
      setError("Código, nombre, categoría y centro de costo son obligatorios.")
      return
    }

    setLoading(true)
    setError(null)

    let photoUrl = asset?.photo_url ?? null
    if (selectedPhoto) {
      const extension = selectedPhoto.name.split(".").pop() || "jpg"
      const filePath = `assets/${formData.asset_code}-${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage.from("asset-photos").upload(filePath, selectedPhoto)
      if (uploadError) {
        setError(`No fue posible subir la fotografía: ${uploadError.message}`)
        setLoading(false)
        return
      }
      photoUrl = supabase.storage.from("asset-photos").getPublicUrl(filePath).data.publicUrl
    }

    const category = categories.find((item) => item.id === formData.category_id)
    const payload = {
      asset_code: formData.asset_code,
      name: formData.name.trim(),
      type: category?.name || asset?.type || "Activo",
      description: formData.description.trim() || null,
      category_id: formData.category_id,
      cost_center_id: formData.cost_center_id,
      serial_number: formData.serial_number.trim() || null,
      brand: formData.brand.trim() || null,
      model: formData.model.trim() || null,
      purchase_date: formData.purchase_date || null,
      purchase_price: formData.purchase_price ? Number(formData.purchase_price) : null,
      status: formData.status,
      location: formData.location.trim() || null,
      assigned_to: formData.assigned_to.trim() || null,
      notes: formData.notes.trim() || null,
      photo_url: photoUrl,
      qr_code_data: qrCodeData ? `ASSET|${formData.asset_code}|${formData.name.trim()}` : null,
      qr_code_url: qrCodeData || null,
      updated_at: new Date().toISOString(),
    }

    const result = asset
      ? await supabase.from("assets").update(payload).eq("id", asset.id)
      : await supabase.from("assets").insert(payload)

    if (result.error) {
      setError(`No fue posible guardar el activo: ${result.error.message}`)
      setLoading(false)
      return
    }

    toast({ title: asset ? "Activo actualizado" : "Activo registrado", description: `${formData.name.trim()} quedó guardado en assets.` })
    setLoading(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-card p-5">
          <div><h2 className="text-xl font-semibold">{asset ? "Editar activo" : "Registrar activo"}</h2><p className="mt-1 text-sm text-muted-foreground">Registro canónico de activos de Fundo Corcovado.</p></div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar"><X className="h-4 w-4" /></Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {error && <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código" required><Input value={formData.asset_code} disabled={!asset} onChange={(event) => updateField("asset_code", event.target.value)} /></Field>
            <Field label="Nombre" required><Input value={formData.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ej. Generador diésel" /></Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoría" required><CategorySelector categories={categories} value={formData.category_id} onChange={(value) => updateField("category_id", value)} /></Field>
            <Field label="Centro de costo" required><select value={formData.cost_center_id} onChange={(event) => updateField("cost_center_id", event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">{costCenters.map((center) => <option key={center.id} value={center.id}>{center.name}{center.code ? ` (${center.code})` : ""}</option>)}</select></Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Marca"><Input value={formData.brand} onChange={(event) => updateField("brand", event.target.value)} /></Field>
            <Field label="Modelo"><Input value={formData.model} onChange={(event) => updateField("model", event.target.value)} /></Field>
            <Field label="Número de serie"><Input value={formData.serial_number} onChange={(event) => updateField("serial_number", event.target.value)} /></Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha de compra"><Input type="date" value={formData.purchase_date} onChange={(event) => updateField("purchase_date", event.target.value)} /></Field>
            <Field label="Precio de compra registrado"><Input type="number" min="0" step="1" value={formData.purchase_price} onChange={(event) => updateField("purchase_price", event.target.value)} /></Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ubicación"><Input value={formData.location} onChange={(event) => updateField("location", event.target.value)} /></Field>
            <Field label="Estado"><select value={formData.status} onChange={(event) => updateField("status", event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="active">Activo</option><option value="inactive">Inactivo</option><option value="maintenance">En mantenimiento</option><option value="deprecated">Retirado</option></select></Field>
          </div>

          <Field label="Responsable asignado"><Input value={formData.assigned_to} onChange={(event) => updateField("assigned_to", event.target.value)} placeholder="Nombre del responsable" /></Field>
          <Field label="Descripción"><textarea rows={3} value={formData.description} onChange={(event) => updateField("description", event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
          <Field label="Notas"><textarea rows={2} value={formData.notes} onChange={(event) => updateField("notes", event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fotografía"><div className="flex items-center gap-3">{photoPreview && <img src={photoPreview} alt="Vista previa del activo" className="h-20 w-20 rounded-md border object-cover" />}<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelection} /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Seleccionar foto</Button></div></Field>
            <Field label="Código QR"><div className="flex items-center gap-3">{qrCodeData && <img src={qrCodeData} alt="Código QR del activo" className="h-20 w-20 rounded-md border p-1" />}<Button type="button" variant="outline" onClick={() => void generateQrCode()}><QrCodeIcon className="mr-2 h-4 w-4" />Generar QR</Button></div></Field>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : asset ? "Guardar cambios" : "Registrar activo"}</Button></div>
        </form>
      </Card>
    </div>
  )
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-sm font-medium">{label}{required ? " *" : ""}</label>{children}</div>
}
