"use client"

import { useState, useEffect } from "react"
import { Plus, ChefHat, Trash2, Edit2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"

interface Kitchen {
  id: string
  name: string
  location: string
  capacity: string
  equipment: string
  status: "operational" | "maintenance" | "inactive"
  description: string
  lastCleaning?: string
}

function KitchenContent() {
  const [kitchens, setKitchens] = useState<Kitchen[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<Kitchen>>({
    status: "operational",
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadKitchens = async () => {
      try {
        const supabase = createBrowserClient()
        const { data, error } = await supabase.from("kitchens").select("*").order("name")

        if (error) {
          console.error("[v0] Error loading kitchens:", error)
        } else if (data) {
          setKitchens(data as Kitchen[])
        }
      } catch (err) {
        console.error("[v0] Error loading kitchens:", err)
      } finally {
        setLoading(false)
      }
    }

    loadKitchens()
  }, [])

  const handleAddOrEdit = () => {
    if (!formData.name || !formData.location) return

    if (editingId) {
      setKitchens(kitchens.map((k) => (k.id === editingId ? { ...k, ...formData } : k)))
      setEditingId(null)
    } else {
      const newKitchen: Kitchen = {
        id: Date.now().toString(),
        name: formData.name || "",
        location: formData.location || "",
        capacity: formData.capacity || "",
        equipment: formData.equipment || "",
        status: formData.status || "operational",
        description: formData.description || "",
        lastCleaning: formData.lastCleaning,
      }
      setKitchens([...kitchens, newKitchen])
    }

    setFormData({ status: "operational" })
    setIsOpen(false)
  }

  const handleEdit = (kitchen: Kitchen) => {
    setFormData(kitchen)
    setEditingId(kitchen.id)
    setIsOpen(true)
  }

  const handleDelete = (id: string) => {
    setKitchens(kitchens.filter((k) => k.id !== id))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-100 text-green-800"
      case "maintenance":
        return "bg-yellow-100 text-yellow-800"
      case "inactive":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Kitchen Management"
        description="Manage kitchen facilities and food preparation areas"
        icon={ChefHat}
      />

      <div className="mb-6 flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingId(null)
                setFormData({ status: "operational" })
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Kitchen
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Add"} Kitchen</DialogTitle>
              <DialogDescription>
                {editingId ? "Update kitchen details" : "Create a new kitchen entry"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Kitchen Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Main Kitchen, Prep Area"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  placeholder="e.g., Building A"
                  value={formData.location || ""}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  placeholder="e.g., 50 covers"
                  value={formData.capacity || ""}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="equipment">Equipment</Label>
                <Input
                  id="equipment"
                  placeholder="e.g., Ovens, grills, prep stations"
                  value={formData.equipment || ""}
                  onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as any })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add details about this kitchen..."
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="cleaning">Last Cleaning</Label>
                <Input
                  id="cleaning"
                  type="date"
                  value={formData.lastCleaning || ""}
                  onChange={(e) => setFormData({ ...formData, lastCleaning: e.target.value })}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddOrEdit}>{editingId ? "Update" : "Add"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {loading ? (
          <div className="text-center py-12">
            <ChefHat className="h-16 w-16 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Loading kitchens...</h3>
          </div>
        ) : kitchens.length === 0 ? (
          <div className="text-center py-12">
            <ChefHat className="h-16 w-16 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No kitchens yet</h3>
            <p className="text-muted-foreground mt-2">Start by adding your first kitchen to the system</p>
          </div>
        ) : (
          kitchens.map((kitchen) => (
            <Card key={kitchen.id} className="overflow-hidden hover:shadow-lg transition-shadow bg-card border-border">
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">👨‍🍳</span>
                    <div>
                      <h3 className="font-semibold text-card-foreground text-sm sm:text-base">{kitchen.name}</h3>
                      <p className="text-xs sm:text-sm text-foreground opacity-80">{kitchen.location}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(kitchen.status)}`}>
                    {kitchen.status}
                  </span>
                </div>

                {kitchen.capacity && (
                  <p className="text-xs sm:text-sm text-foreground">
                    <span className="font-medium text-card-foreground">Capacity:</span> {kitchen.capacity}
                  </p>
                )}

                {kitchen.equipment && (
                  <p className="text-xs sm:text-sm text-foreground">
                    <span className="font-medium text-card-foreground">Equipment:</span> {kitchen.equipment}
                  </p>
                )}

                {kitchen.description && <p className="text-xs sm:text-sm text-foreground">{kitchen.description}</p>}

                {kitchen.lastCleaning && (
                  <p className="text-xs text-foreground opacity-80">
                    Last cleaned: {new Date(kitchen.lastCleaning).toLocaleDateString()}
                  </p>
                )}

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => handleEdit(kitchen)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(kitchen.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default function KitchenPage() {
  return (
    <AppLayout>
      <KitchenContent />
    </AppLayout>
  )
}
