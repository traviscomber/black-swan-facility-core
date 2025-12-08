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
import { Plus, Pencil, Trash2, AlertTriangle, Wrench, Building2, Shield } from "lucide-react"

interface IssueType {
  id: string
  name: string
  category: string
  description: string | null
  severity: string
  is_active: boolean
  is_custom: boolean
  created_at: string
}

export default function IssueTypesPage() {
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<IssueType | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    category: "infrastructure",
    description: "",
    severity: "medium",
    is_active: true,
  })

  useEffect(() => {
    fetchIssueTypes()
  }, [])

  const fetchIssueTypes = async () => {
    const supabase = createClient()
    const { data } = await supabase.from("issue_types").select("*").order("category").order("name")

    if (data) {
      setIssueTypes(data)
    }
    setLoading(false)
  }

  const handleAdd = () => {
    setEditingType(null)
    setFormData({
      name: "",
      category: "infrastructure",
      description: "",
      severity: "medium",
      is_active: true,
    })
    setDialogOpen(true)
  }

  const handleEdit = (type: IssueType) => {
    setEditingType(type)
    setFormData({
      name: type.name,
      category: type.category,
      description: type.description || "",
      severity: type.severity,
      is_active: type.is_active,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this issue type?")) return

    const supabase = createClient()
    await supabase.from("issue_types").delete().eq("id", id)
    fetchIssueTypes()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const supabase = createClient()

    if (editingType) {
      await supabase
        .from("issue_types")
        .update({
          name: formData.name,
          category: formData.category,
          description: formData.description || null,
          severity: formData.severity,
          is_active: formData.is_active,
        })
        .eq("id", editingType.id)
    } else {
      await supabase.from("issue_types").insert({
        name: formData.name,
        category: formData.category,
        description: formData.description || null,
        severity: formData.severity,
        is_active: formData.is_active,
        is_custom: true,
      })
    }

    setDialogOpen(false)
    fetchIssueTypes()
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "infrastructure":
        return <Wrench className="h-4 w-4 text-blue-600" />
      case "asset":
        return <Building2 className="h-4 w-4 text-purple-600" />
      case "facility":
        return <Building2 className="h-4 w-4 text-green-600" />
      case "safety":
        return <Shield className="h-4 w-4 text-red-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

  const getCategoryBadge = (category: string) => {
    const colors = {
      infrastructure: "bg-blue-50 text-blue-700 border-blue-200",
      asset: "bg-purple-50 text-purple-700 border-purple-200",
      facility: "bg-green-50 text-green-700 border-green-200",
      safety: "bg-red-50 text-red-700 border-red-200",
      other: "bg-gray-50 text-gray-700 border-gray-200",
    }
    return colors[category as keyof typeof colors] || ""
  }

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: "bg-green-50 text-green-700 border-green-200",
      medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
      high: "bg-orange-50 text-orange-700 border-orange-200",
      critical: "bg-red-50 text-red-700 border-red-200",
    }
    return colors[severity as keyof typeof colors] || ""
  }

  return (
    <AppLayout>
      <PageHeader title="Issue Types" description="Manage predefined and custom issue categories" />

      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-gray-600">
            {issueTypes.length} issue types configured ({issueTypes.filter((t) => t.is_custom).length} custom)
          </p>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Issue Type
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
                  <TableHead>Severity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issueTypes.map((type) => (
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
                    <TableCell>
                      <Badge variant="outline" className={getSeverityBadge(type.severity)}>
                        {type.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{type.description || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={type.is_custom ? "border-purple-200" : "border-gray-200"}>
                        {type.is_custom ? "Custom" : "Predefined"}
                      </Badge>
                    </TableCell>
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
                        {type.is_custom && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(type.id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
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
            <DialogTitle>{editingType ? "Edit Issue Type" : "Add Issue Type"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Network Outage"
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
                  <SelectItem value="infrastructure">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Infrastructure
                    </div>
                  </SelectItem>
                  <SelectItem value="asset">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Asset
                    </div>
                  </SelectItem>
                  <SelectItem value="facility">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Facility
                    </div>
                  </SelectItem>
                  <SelectItem value="safety">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Safety
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Other
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="severity">Severity *</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) => setFormData({ ...formData, severity: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this issue type"
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
                Active (visible in issue selection)
              </Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                {editingType ? "Update" : "Add"} Issue Type
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
