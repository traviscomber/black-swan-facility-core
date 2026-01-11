"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Upload, X, QrCodeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import QRCode from "qrcode"

interface InventoryFormProps {
  asset?: any
  categories: any[]
  costCenters: any[]
  onClose: () => void
  onSuccess: () => void
}

export function InventoryForm({ asset, categories, costCenters, onClose, onSuccess }: InventoryFormProps) {
  const [loading, setLoading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(asset?.photo_url || "")
  const [qrCodeData, setQrCodeData] = useState(asset?.qr_code_url || "")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const supabase = createBrowserClient()

  const [formData, setFormData] = useState({
    asset_code: asset?.asset_code || "",
    name: asset?.name || "",
    description: asset?.description || "",
    category_id: asset?.category_id || categories[0]?.id || "",
    cost_center_id: asset?.cost_center_id || costCenters[0]?.id || "",
    serial_number: asset?.serial_number || "",
    brand: asset?.brand || "",
    model: asset?.model || "",
    purchase_date: asset?.purchase_date || "",
    purchase_price: asset?.purchase_price || "",
    status: asset?.status || "active",
    location: asset?.location || "",
    assigned_to: asset?.assigned_to || "",
    notes: asset?.notes || "",
  })

  useEffect(() => {
    if (!asset) {
      generateAssetCode()
    }
  }, [formData.cost_center_id, formData.category_id])

  const generateAssetCode = async (
    costCenterId: string = formData.cost_center_id,
    categoryId: string = formData.category_id,
    assetName: string = formData.name,
  ) => {
    try {
      const costCenter = costCenters.find((cc) => cc.id === costCenterId)
      const category = categories.find((cat) => cat.id === categoryId)

      if (!category) return

      const categoryCode = category.code || category.name.substring(0, 3).toUpperCase()
      const costCenterCode = costCenter?.code || costCenter?.name.substring(0, 2).toUpperCase() || "BS"

      const { data, error } = await supabase
        .from("multimedia_assets")
        .select("asset_code", { count: "exact" })
        .eq("cost_center_id", costCenterId)
        .eq("category_id", categoryId)
        .ilike("asset_code", `${costCenterCode}-${categoryCode}%`)

      if (error) throw error

      const nextSequence = (data?.length || 0) + 1
      const sequenceStr = String(nextSequence).padStart(3, "0")
      const newAssetCode = `${costCenterCode}-${categoryCode}-${sequenceStr}`

      setFormData((prev) => ({ ...prev, asset_code: newAssetCode }))
      const qrData = `ASSET|${newAssetCode}|${assetName}|${new Date().toISOString()}`
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 })
      setQrCodeData(qrDataUrl)
    } catch (error) {
      console.error("Error generating asset code:", error)
    }
  }

  const generateQRCodeWithData = async (code: string, name: string) => {
    try {
      const qrData = `ASSET|${code}|${name}|${new Date().toISOString()}`
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 })
      setQrCodeData(qrDataUrl)
    } catch (error) {
      console.error("Error generating QR:", error)
    }
  }

  const generateQRCode = async () => {
    try {
      await generateQRCodeWithData(formData.asset_code, formData.name)
      toast({ title: "Success", description: "QR code generated" })
    } catch (error) {
      console.error("Error generating QR:", error)
      toast({ title: "Error", description: "Failed to generate QR code", variant: "destructive" })
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setLoading(true)
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `multimedia/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("gis-overlays")
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: publicUrl } = supabase.storage.from("gis-overlays").getPublicUrl(filePath)

      setPhotoPreview(publicUrl.publicUrl)
    } catch (error) {
      console.error("Error uploading photo:", error)
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.asset_code || !formData.name) {
      toast({ title: "Error", description: "Asset code and name are required", variant: "destructive" })
      return
    }

    try {
      setLoading(true)
      const payload = {
        ...formData,
        photo_url: photoPreview,
        qr_code_url: qrCodeData,
      }

      if (asset) {
        const { error } = await supabase.from("multimedia_assets").update(payload).eq("id", asset.id)
        if (error) throw error
        toast({ title: "Success", description: "Asset updated successfully" })
      } else {
        const { error } = await supabase.from("multimedia_assets").insert([payload])
        if (error) throw error
        toast({ title: "Success", description: "Asset created successfully" })
      }

      onSuccess()
    } catch (error) {
      console.error("Error saving asset:", error)
      toast({ title: "Error", description: "Failed to save asset", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
          <h2 className="text-xl font-bold">{asset ? "Edit Asset" : "Add New Asset"}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Photo</label>
            <div className="flex gap-4">
              {photoPreview && (
                <img
                  src={photoPreview || "/placeholder.svg"}
                  alt="Preview"
                  className="w-24 h-24 rounded-lg object-cover border border-border"
                />
              )}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full gap-2"
                  disabled={loading}
                >
                  <Upload className="h-4 w-4" />
                  {loading ? "Uploading..." : "Upload Photo"}
                </Button>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div>
            <label className="block text-sm font-medium mb-2">QR Code</label>
            <div className="flex gap-4">
              {qrCodeData && (
                <img
                  src={qrCodeData || "/placeholder.svg"}
                  alt="QR Code"
                  className="w-24 h-24 border border-border rounded-lg p-2"
                />
              )}
              <Button type="button" variant="outline" onClick={generateQRCode} className="gap-2 bg-transparent">
                <QrCodeIcon className="h-4 w-4" />
                {qrCodeData ? "Regenerate QR Code" : "Generate QR Code"}
              </Button>
            </div>
          </div>

          {/* Asset Code and Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Asset Code*</label>
              <Input
                placeholder="Auto-generated"
                value={formData.asset_code}
                onChange={(e) => setFormData({ ...formData, asset_code: e.target.value })}
                required
                disabled={!asset}
              />
              {!asset && (
                <p className="text-xs text-muted-foreground mt-1">Auto-generated based on category and cost center</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name*</label>
              <Input
                placeholder="Asset name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Category and Cost Center */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => {
                  const newCategoryId = e.target.value
                  setFormData((prev) => ({ ...prev, category_id: newCategoryId }))
                  generateAssetCode(formData.cost_center_id, newCategoryId, formData.name)
                }}
                className="w-full px-3 py-2 bg-input border border-border rounded-md"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cost Center</label>
              <select
                value={formData.cost_center_id}
                onChange={(e) => {
                  const newCostCenterId = e.target.value
                  setFormData((prev) => ({ ...prev, cost_center_id: newCostCenterId }))
                  generateAssetCode(newCostCenterId, formData.category_id, formData.name)
                }}
                className="w-full px-3 py-2 bg-input border border-border rounded-md"
              >
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.name} ({cc.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Brand, Model, Serial */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Brand</label>
              <Input
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="e.g., Sony"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., A7R"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Serial Number</label>
              <Input
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                placeholder="SN123456"
              />
            </div>
          </div>

          {/* Purchase Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Purchase Date</label>
              <Input
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Purchase Price</label>
              <Input
                type="number"
                step="0.01"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Location and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Storage Room 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-input border border-border rounded-md"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-sm font-medium mb-1">Assigned To</label>
            <Input
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              placeholder="Employee name"
            />
          </div>

          {/* Description and Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Asset description"
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes"
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm resize-none"
              rows={2}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : asset ? "Update Asset" : "Add Asset"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
