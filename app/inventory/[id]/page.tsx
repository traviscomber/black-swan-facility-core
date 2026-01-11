"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Download, Edit2, Trash2, ChevronLeft } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

export default function AssetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [asset, setAsset] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { toast } = useToast()

  useEffect(() => {
    loadAsset()
  }, [params.id])

  async function loadAsset() {
    try {
      const { data, error } = await supabase
        .from("assets")
        .select(
          `
          *,
          asset_categories(name, color),
          cost_centers(name, code)
        `,
        )
        .eq("id", params.id)
        .single()

      if (error) throw error
      setAsset(data)
    } catch (error) {
      console.error("Error loading asset:", error)
      toast({ title: "Error", description: "Failed to load asset", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const downloadQRCode = () => {
    if (!asset?.qr_code_url) return
    const link = document.createElement("a")
    link.href = asset.qr_code_url
    link.download = `${asset.asset_code}-qr.png`
    link.click()
  }

  if (loading)
    return (
      <AppLayout>
        <div className="p-8 text-center">Loading...</div>
      </AppLayout>
    )
  if (!asset)
    return (
      <AppLayout>
        <div className="p-8 text-center">Asset not found</div>
      </AppLayout>
    )

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-accent">{asset.name}</h1>
              <p className="text-muted-foreground">{asset.asset_code}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 bg-transparent">
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" className="gap-2 text-destructive hover:text-destructive bg-transparent">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            {/* Photo */}
            {asset.photo_url && (
              <Card className="overflow-hidden">
                <img
                  src={asset.photo_url || "/placeholder.svg"}
                  alt={asset.name}
                  className="w-full aspect-video object-cover"
                />
              </Card>
            )}

            {/* Details */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Asset Information</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Brand</p>
                  <p className="font-medium">{asset.brand || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Model</p>
                  <p className="font-medium">{asset.model || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Serial Number</p>
                  <p className="font-mono">{asset.serial_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{asset.location || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{asset.assigned_to || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Date</p>
                  <p className="font-medium">{asset.purchase_date || "-"}</p>
                </div>
              </div>
            </Card>

            {/* Description */}
            {asset.description && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground">{asset.description}</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Status</h3>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  asset.status === "active"
                    ? "bg-emerald-500/20 text-emerald-600"
                    : asset.status === "maintenance"
                      ? "bg-orange-500/20 text-orange-600"
                      : asset.status === "deprecated"
                        ? "bg-red-500/20 text-red-600"
                        : "bg-gray-500/20 text-gray-600"
                }`}
              >
                {asset.status}
              </span>
            </Card>

            {/* Category */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Category</h3>
              <span
                className="px-3 py-1 rounded text-sm font-medium inline-block"
                style={{
                  backgroundColor: asset.asset_categories.color + "20",
                  color: asset.asset_categories.color,
                }}
              >
                {asset.asset_categories.name}
              </span>
            </Card>

            {/* Cost Center */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Cost Center</h3>
              <p className="font-medium">{asset.cost_centers.name}</p>
              <p className="text-sm text-muted-foreground">{asset.cost_centers.code}</p>
            </Card>

            {/* QR Code */}
            {asset.qr_code_url && (
              <Card className="p-6">
                <h3 className="text-sm font-semibold mb-4 text-muted-foreground">QR Code</h3>
                <img
                  src={asset.qr_code_url || "/placeholder.svg"}
                  alt="QR Code"
                  className="w-full border border-border rounded-lg p-2"
                />
                <Button onClick={downloadQRCode} className="w-full mt-3 gap-2 bg-transparent" variant="outline">
                  <Download className="h-4 w-4" />
                  Download QR
                </Button>
              </Card>
            )}

            {/* Purchase Info */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Purchase Info</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="font-medium">${asset.purchase_price || "0.00"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{new Date(asset.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
