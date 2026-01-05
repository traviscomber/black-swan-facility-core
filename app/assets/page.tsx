"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import type { Asset } from "@/lib/types"
import Link from "next/link"
import { Plus, QrCode, Pencil, Download } from "lucide-react"
import { useEffect, useState } from "react"
import { AddAssetDialog } from "@/components/add-asset-dialog"
import { EditAssetDialog } from "@/components/edit-asset-dialog"
import { DeleteAssetButton } from "@/components/delete-asset-button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [filterType, setFilterType] = useState("all")
  const [filterCritical, setFilterCritical] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [searchTerm, setSearchTerm] = useState("")

  const loadAssets = async () => {
    const supabase = createBrowserClient()
    const { data } = await supabase.from("assets").select("*").order("name")
    if (data) {
      setAssets(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    let filtered = [...assets]

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((a) => a.type === filterType)
    }

    // Filter by critical
    if (filterCritical !== "all") {
      filtered = filtered.filter((a) => (filterCritical === "critical" ? a.is_critical : !a.is_critical))
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name)
        case "type":
          return (a.type || "").localeCompare(b.type || "")
        case "last_audit":
          return new Date(b.last_audit_date || 0).getTime() - new Date(a.last_audit_date || 0).getTime()
        default:
          return 0
      }
    })

    setFilteredAssets(filtered)
  }, [assets, filterType, filterCritical, searchTerm, sortBy])

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

  const handleExport = () => {
    const headers = ["Name", "Type", "Location", "Critical", "Last Audit", "Description"]
    const rows = filteredAssets.map((asset) => [
      asset.name,
      asset.type,
      asset.location || "-",
      asset.is_critical ? "Yes" : "No",
      asset.last_audit_date ? new Date(asset.last_audit_date).toLocaleDateString() : "Never",
      asset.description || "-",
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `assets-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  return (
    <AppLayout>
      <PageHeader
        title="Assets"
        description="Manage facility infrastructure and equipment"
        actions={
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        <div className="rounded-lg border border-secondary bg-card p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Input
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-background"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Array.from(new Set(assets.map((a) => a.type))).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCritical} onValueChange={setFilterCritical}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Filter by criticality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assets</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
                <SelectItem value="non-critical">Non-Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="type">Type</SelectItem>
                <SelectItem value="last_audit">Last Audit (Newest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-secondary bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Location</TableHead>
                <TableHead className="text-muted-foreground">Last Audit</TableHead>
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
              ) : filteredAssets && filteredAssets.length > 0 ? (
                filteredAssets.map((asset: Asset) => (
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
                    <TableCell className="text-foreground">
                      {asset.last_audit_date ? (
                        new Date(asset.last_audit_date).toLocaleDateString()
                      ) : (
                        <span className="text-muted-foreground">Never</span>
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
                    {searchTerm || filterType !== "all" || filterCritical !== "all"
                      ? "No assets match your filters"
                      : "No assets found"}
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
