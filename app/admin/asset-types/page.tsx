"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { Plus, Pencil, Trash2, Wifi, Droplet, Zap } from "lucide-react"

interface AssetType {
  id: string
  name: string
  category: string
  description: string | null
  is_active: boolean
  created_at: string
}

export default function AssetTypesPage() {
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<AssetType | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    category: "internet",
    description: "",
    is_active: true,
  })

  useEffect(() => {
    fetchAssetTypes()
  }, [])

  const fetchAssetTypes = async () => {
    const supabase = createClient()
    const { data } = await supabase.from("infrastructure_asset_types").select("*").order("category").order("name")

    if (data) {
      setAssetTypes(data)
    }
    setLoading(false)
  }

  const handleAdd = () => {
    setEditingType(null)
    setFormData({
      name: "",
      category: "internet",
      description: "",
      is_active: true,
    })
    setDialogOpen(true)
  }

  const handleEdit = (type: AssetType) => {
    setEditingType(type)
    setFormData({
      name: type.name,
      category: type.category,
      description: type.description || "",
      is_active: type.is_active,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this asset type?")) return

    const supabase = createClient()
    await supabase.from("infrastructure_asset_types").delete().eq("id", id)
    fetchAssetTypes()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const supabase = createClient()

    if (editingType) {
      await supabase
        .from("infrastructure_asset_types")
        .update({
          name: formData.name,
          category: formData.category,
          description: formData.description || null,
          is_active: formData.is_active,
        })
        .eq("id", editingType.id)
    } else {
      await supabase.from("infrastructure_asset_types").insert({
        name: formData.name,
        category: formData.category,
        description: formData.description || null,
        is_active: formData.is_active,
      })
    }

    setDialogOpen(false)
    fetchAssetTypes()
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "internet":
        return <Wifi className="h-4 w-4 text-blue-600" />
      case "water":
        return <Droplet className="h-4 w-4 text-cyan-600" />
      case "electricity":
        return <Zap className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  const getCategoryBadge = (category: string) => {
    const colors = {
      internet: "bg-blue-50 text-blue-700 border-blue-200",
      water: "bg-cyan-50 text-cyan-700 border-cyan-200",
      electricity: "bg-yellow-50 text-yellow-700 border-yellow-200",
    }
    return colors[category as keyof typeof colors] || ""
  }

  return (
    <AppLayout>
      <PageHeader title="Infrastructure Asset Types" description="Manage predefined asset types for infrastructure" />

      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-gray-600">{assetTypes.length} asset types configured</p>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Asset Type
          </Button>
        </div>

        {loading ? (
          <p className="text-center py-8 text-gray-500">Loading...</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(type.category)}
                        <Badge variant="outline" className={getCategoryBadge(type.category)}>
                          {type.category}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{type.description || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          type.is_active
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-gray-50 text-gray-700 border-gray-200"
                        }
                      >
                        {type.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(type)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(type.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Asset Type" : "Add Asset Type"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., WiFi Access Point"
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internet">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4" />
                      Internet
                    </div>
                  </SelectItem>
                  <SelectItem value="water">
                    <div className="flex items-center gap-2">
                      <Droplet className="h-4 w-4" />
                      Water
                    </div>
                  </SelectItem>
                  <SelectItem value="electricity">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Electricity
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this asset type"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="font-normal">
                Active (visible in asset selection)
              </Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                {editingType ? "Update" : "Add"} Asset Type
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
