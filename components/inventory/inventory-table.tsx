"use client"

import { Edit2, Trash2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"

interface Asset {
  id: string
  asset_code: string
  name: string
  category: { name: string; color: string }
  cost_center: { name: string; code: string }
  status: string
  location: string
  assigned_to: string
  photo_url: string
}

export function InventoryTable({
  assets,
  loading,
  onEdit,
  onDelete,
  onEditClick,
}: {
  assets: Asset[]
  loading: boolean
  onEdit: (asset: Asset) => void
  onDelete: (id: string) => void
  onEditClick: () => void
}) {
  if (loading) {
    return <Card className="p-8 text-center text-muted-foreground">Loading assets...</Card>
  }

  if (assets.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No assets found</p>
      </Card>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Code</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Category</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Cost Center</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Location</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id} className="border-b border-border hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3 text-sm font-mono text-primary">{asset.asset_code}</td>
              <td className="px-4 py-3 text-sm">{asset.name}</td>
              <td className="px-4 py-3 text-sm">
                <span
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: asset.category.color + "20", color: asset.category.color }}
                >
                  {asset.category.name}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                <span className="text-muted-foreground">{asset.cost_center.code}</span>
              </td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
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
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{asset.location || "-"}</td>
              <td className="px-4 py-3 text-sm">
                <div className="flex justify-end gap-2">
                  <Link href={`/inventory/${asset.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      onEdit(asset)
                      onEditClick()
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDelete(asset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
