"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import type { Asset } from "@/lib/types"
import Link from "next/link"
import { Plus, QrCode, Pencil } from "lucide-react"
import { useEffect, useState } from "react"
import { AddAssetDialog } from "@/components/add-asset-dialog"
import { EditAssetDialog } from "@/components/edit-asset-dialog"
import { DeleteAssetButton } from "@/components/delete-asset-button"

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)

  const loadAssets = async () => {
    const supabase = createBrowserClient()
    const { data } = await supabase.from("assets").select("*").order("name")
    if (data) {
      setAssets(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAssets()
  }, [])

  const handleAssetAdded = () => {
    loadAssets()
    setShowAddDialog(false)
  }

  const handleAssetUpdated = () => {
    loadAssets()
    setEditingAsset(null)
  }

  const handleAssetDeleted = () => {
    loadAssets()
  }

  return (
    <AppLayout>
      <PageHeader
        title="Assets"
        description="Manage facility infrastructure and equipment"
        actions={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        }
      />

      <div className="p-8">
        <div className="rounded-lg border border-secondary bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Location</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">QR</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : assets && assets.length > 0 ? (
                assets.map((asset: Asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          {asset.name}
                        </Link>
                        {asset.description && (
                          <span className="text-xs text-muted-foreground">{asset.description}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">{asset.type}</TableCell>
                    <TableCell className="text-foreground">{asset.location || "-"}</TableCell>
                    <TableCell>
                      {asset.is_critical ? (
                        <Badge className="bg-red-900/30 text-red-200 border-red-700/50">Critical</Badge>
                      ) : (
                        <Badge className="bg-green-900/30 text-green-200 border-green-700/50">Normal</Badge>
                      )}
                    </TableCell>
                    <TableCell>{asset.is_critical && <QrCode className="h-4 w-4 text-primary" />}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/assets/${asset.id}`}>
                          <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80">
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingAsset(asset)}
                          className="text-accent hover:text-accent/80"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteAssetButton assetId={asset.id} assetName={asset.name} onDeleted={handleAssetDeleted} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No assets found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddAssetDialog open={showAddDialog} onOpenChange={setShowAddDialog} onAssetAdded={handleAssetAdded} />

      {editingAsset && (
        <EditAssetDialog
          asset={editingAsset}
          open={!!editingAsset}
          onOpenChange={(open) => !open && setEditingAsset(null)}
          onAssetUpdated={handleAssetUpdated}
        />
      )}
    </AppLayout>
  )
}
