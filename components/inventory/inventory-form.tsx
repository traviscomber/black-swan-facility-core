"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, ChevronDown, QrCodeIcon, Upload, X } from "lucide-react"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { CategorySelector } from "./category-selector"

type MetadataOption = { id: string; name: string; code?: string | null }

type WarehouseLocation = {
  id: string
  code: string
  name: string
  warehouses?: { id: string; code: string; name: string } | null
}

type InventoryAsset = {
  id: string
  asset_code: string
  name: string
  description?: string | null
  category_id?: string | null
  cost_center_id?: string | null
  warehouse_location_id?: string | null
  asset_class?: string | null
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

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export function InventoryForm({ asset, categories, costCenters, onClose, onSuccess }: InventoryFormProps) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocation[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState(asset?.photo_url ?? "")
  const [qrCodeData, setQrCodeData] = useState(asset?.qr_code_url ?? "")
  const [formData, setFormData] = useState({
    asset_code: asset?.asset_code ?? "",
    name: asset?.name ?? "",
    asset_class: asset?.asset_class ?? "equipment",
    warehouse_location_id: asset?.warehouse_location_id ?? "",
    assigned_to: asset?.assigned_to ?? "",
    status: asset?.status ?? "active",
    category_id: asset?.category_id ?? categories[0]?.id ?? "",
    cost_center_id: asset?.cost_center_id ?? costCenters[0]?.id ?? "",
    description: asset?.description ?? "",
    serial_number: asset?.serial_number ?? "",
    brand: asset?.brand ?? "",
    model: asset?.model ?? "",
    purchase_date: asset?.purchase_date ?? "",
    purchase_price: asset?.purchase_price?.toString() ?? "",
    notes: asset?.notes ?? "",
  })

  useEffect(() => {
    void supabase
      .from("warehouse_locations")
      .select("id, code, name, warehouses(id, code, name)")
      .eq("is_active", true)
      .order("name")
      .then(({ data, error: locationsError }) => {
        if (locationsError) setError(`No fue posible cargar las bodegas: ${locationsError.message}`)
        else setWarehouseLocations((data ?? []).map((location) => ({ ...location, warehouses: firstRelation(location.warehouses) })))
      })
  }, [supabase])

  useEffect(() => {
    if (asset || !formData.category_id || !formData.cost_center_id) return
    let cancelled = false

    async function generateAssetCode() {
      const category = categories.find((item) => item.id === formData.category_id)
      const costCenter = costCenters.find((item) => item.id === formData.cost_center_id)
      const categoryCode = category?.code || category?.name.slice(0, 3).toUpperCase() || "ACT"
      const costCenterCode = costCenter?.code || "FC"
      const prefix = `${costCenterCode}-${categoryCode}`
      const { data, error: codeError } = await supabase.from("assets").select("asset_code").ilike("asset_code", `${prefix}-%`).order("asset_code", { ascending: false }).limit(1)
      if (cancelled) return
      if (codeError) return setError(`No fue posible generar el código: ${codeError.message}`)
      const previous = data?.[0]?.asset_code
      const sequence = previous ? Number.parseInt(previous.split("-").at(-1) || "0", 10) + 1 : 1
      setFormData((current) => ({ ...current, asset_code: `${prefix}-${String(Number.isFinite(sequence) ? sequence : 1).padStart(3, "0")}` }))
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
    if (!formData.asset_code || !formData.name.trim()) return setError("Completa el código y el nombre antes de generar el QR.")
    setQrCodeData(await QRCode.toDataURL(`ASSET|${formData.asset_code}|${formData.name.trim()}`, { width: 300, margin: 2 }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!formData.name.trim() || !formData.asset_code || !formData.category_id || !formData.cost_center_id || !formData.warehouse_location_id) {
      setError("Nombre, bodega, categoría y centro de costo son obligatorios.")
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

    const selectedLocation = warehouseLocations.find((location) => location.id === formData.warehouse_location_id)
    const canonicalLocation = selectedLocation ? `${selectedLocation.warehouses?.name ?? "Bodega"} · ${selectedLocation.name}` : null
    const category = categories.find((item) => item.id === formData.category_id)
    const now = new Date().toISOString()
    const payload = {
      asset_code: formData.asset_code,
      name: formData.name.trim(),
      asset_class: formData.asset_class,
      warehouse_location_id: formData.warehouse_location_id,
      location: canonicalLocation,
      assigned_to: formData.assigned_to.trim() || null,
      status: formData.status,
      type: category?.name || asset?.type || "Activo",
      category_id: formData.category_id,
      cost_center_id: formData.cost_center_id,
      description: formData.description.trim() || null,
      serial_number: formData.serial_number.trim() || null,
      brand: formData.brand.trim() || null,
      model: formData.model.trim() || null,
      purchase_date: formData.purchase_date || null,
      purchase_price: formData.purchase_price ? Number(formData.purchase_price) : null,
      notes: formData.notes.trim() || null,
      photo_url: photoUrl,
      qr_code_data: qrCodeData ? `ASSET|${formData.asset_code}|${formData.name.trim()}` : null,
      qr_code_url: qrCodeData || null,
      updated_at: now,
    }

    let assetId = asset?.id
    if (asset) {
      const { error: updateError } = await supabase.from("assets").update(payload).eq("id", asset.id)
      if (updateError) {
        setError(`No fue posible guardar el activo: ${updateError.message}`)
        setLoading(false)
        return
      }
    } else {
      const { data: inserted, error: insertError } = await supabase.from("assets").insert(payload).select("id").single()
      if (insertError) {
        setError(`No fue posible registrar el activo: ${insertError.message}`)
        setLoading(false)
        return
      }
      assetId = inserted.id
    }

    const locationChanged = !asset || asset.warehouse_location_id !== formData.warehouse_location_id
    const assignmentChanged = !asset || (asset.assigned_to ?? "") !== formData.assigned_to.trim()
    if (assetId && (locationChanged || assignmentChanged)) {
      await supabase.from("inventory_movements").insert({
        asset_id: assetId,
        movement_type: !asset ? "receipt" : assignmentChanged ? (formData.assigned_to.trim() ? "assignment" : "return") : "transfer",
        from_location_id: asset?.warehouse_location_id ?? null,
        to_location_id: formData.warehouse_location_id,
        assigned_to: formData.assigned_to.trim() || null,
        notes: !asset ? "Ingreso inicial desde registro operativo." : "Actualización desde formulario de inventario.",
        moved_at: now,
      })
    }

    toast({ title: asset ? "Registro actualizado" : "Equipo registrado", description: `${formData.name.trim()} quedó guardado con su ubicación actual.` })
    setLoading(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <Card className="max-h-[94vh] w-full max-w-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-card p-4 sm:p-5">
          <div><h2 className="text-xl font-semibold">{asset ? "Editar equipo o activo" : "Registrar equipo o activo"}</h2><p className="mt-1 text-sm text-muted-foreground">Formulario rápido para una operación de campo de 12–20 personas.</p></div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar"><X className="h-4 w-4" /></Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-5">
          {error && <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

          <Field label="Nombre del equipo o activo" required><Input autoFocus value={formData.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ej. Motosierra Stihl, notebook administración" /></Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" required><select value={formData.asset_class} onChange={(event) => updateField("asset_class", event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="equipment">Equipo</option><option value="tool">Herramienta</option><option value="infrastructure">Infraestructura fija</option><option value="vehicle">Vehículo o maquinaria</option><option value="other">Otro</option></select></Field>
            <Field label="Estado" required><select value={formData.status} onChange={(event) => updateField("status", event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="active">Operativo</option><option value="maintenance">En mantenimiento</option><option value="inactive">Fuera de servicio</option><option value="deprecated">Retirado</option></select></Field>
          </div>

          <Field label="Bodega o posición" required><select value={formData.warehouse_location_id} onChange={(event) => updateField("warehouse_location_id", event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="">Seleccionar ubicación</option>{warehouseLocations.map((location) => <option key={location.id} value={location.id}>{location.warehouses?.name ?? "Bodega"} · {location.name}</option>)}</select></Field>

          <Field label="Responsable o custodio"><Input value={formData.assigned_to} onChange={(event) => updateField("assigned_to", event.target.value)} placeholder="Dejar vacío si permanece en bodega" /></Field>

          <Field label="Fotografía"><div className="flex flex-wrap items-center gap-3">{photoPreview && <img src={photoPreview} alt="Vista previa del activo" className="h-20 w-20 rounded-md border object-cover" />}<input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelection} /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Tomar o elegir foto</Button></div></Field>

          <button type="button" onClick={() => setAdvancedOpen((current) => !current)} className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium hover:bg-muted"><span>Datos adicionales</span><ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} /></button>

          {advancedOpen && <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoría" required><CategorySelector categories={categories} value={formData.category_id} onChange={(value) => updateField("category_id", value)} /></Field>
              <Field label="Centro de costo" required><select value={formData.cost_center_id} onChange={(event) => updateField("cost_center_id", event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">{costCenters.map((center) => <option key={center.id} value={center.id}>{center.name}{center.code ? ` (${center.code})` : ""}</option>)}</select></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3"><Field label="Marca"><Input value={formData.brand} onChange={(event) => updateField("brand", event.target.value)} /></Field><Field label="Modelo"><Input value={formData.model} onChange={(event) => updateField("model", event.target.value)} /></Field><Field label="Número de serie"><Input value={formData.serial_number} onChange={(event) => updateField("serial_number", event.target.value)} /></Field></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Fecha de compra"><Input type="date" value={formData.purchase_date} onChange={(event) => updateField("purchase_date", event.target.value)} /></Field><Field label="Precio de compra registrado"><Input type="number" min="0" step="1" value={formData.purchase_price} onChange={(event) => updateField("purchase_price", event.target.value)} /></Field></div>
            <Field label="Descripción"><textarea rows={2} value={formData.description} onChange={(event) => updateField("description", event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
            <Field label="Notas"><textarea rows={2} value={formData.notes} onChange={(event) => updateField("notes", event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Código interno"><Input value={formData.asset_code} disabled={!asset} onChange={(event) => updateField("asset_code", event.target.value)} /></Field><Field label="Código QR"><div className="flex items-center gap-3">{qrCodeData && <img src={qrCodeData} alt="Código QR del activo" className="h-16 w-16 rounded-md border p-1" />}<Button type="button" variant="outline" onClick={() => void generateQrCode()}><QrCodeIcon className="mr-2 h-4 w-4" />Generar QR</Button></div></Field></div>
          </div>}

          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : asset ? "Guardar cambios" : "Registrar"}</Button></div>
        </form>
      </Card>
    </div>
  )
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-sm font-medium">{label}{required ? " *" : ""}</label>{children}</div>
}
