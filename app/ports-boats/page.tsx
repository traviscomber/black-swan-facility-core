"use client"

import { useState } from "react"
import { Plus, Anchor, Trash2, Edit2 } from "lucide-react"
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

interface PortBoat {
  id: string
  name: string
  type: "port" | "boat"
  location: string
  capacity?: string
  status: "operational" | "maintenance" | "inactive"
  description: string
  lastMaintenance?: string
}

export default function PortsBoatsPage() {
  const [boats, setBoats] = useState<PortBoat[]>([
    {
      id: "1",
      name: "Main Dock",
      type: "port",
      location: "North Harbor",
      capacity: "5 boats",
      status: "operational",
      description: "Primary docking facility",
      lastMaintenance: "2024-12-15",
    },
  ])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<PortBoat>>({
    type: "boat",
    status: "operational",
  })

  const handleAddOrEdit = () => {
    if (!formData.name || !formData.location) return

    if (editingId) {
      setBoats(boats.map((b) => (b.id === editingId ? { ...b, ...formData } : b)))
      setEditingId(null)
    } else {
      const newBoat: PortBoat = {
        id: Date.now().toString(),
        name: formData.name || "",
        type: formData.type || "boat",
        location: formData.location || "",
        capacity: formData.capacity,
        status: formData.status || "operational",
        description: formData.description || "",
        lastMaintenance: formData.lastMaintenance,
      }
      setBoats([...boats, newBoat])
    }

    setFormData({ type: "boat", status: "operational" })
    setIsOpen(false)
  }

  const handleEdit = (boat: PortBoat) => {
    setFormData(boat)
    setEditingId(boat.id)
    setIsOpen(true)
  }

  const handleDelete = (id: string) => {
    setBoats(boats.filter((b) => b.id !== id))
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

  const getTypeIcon = (type: string) => {
    return type === "port" ? "⚓" : "🚤"
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <Anchor className="h-8 w-8 text-primary" />
                Ports & Boats
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base mt-1">
                Manage your port facilities and boat fleet
              </p>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingId(null)
                    setFormData({ type: "boat", status: "operational" })
                  }}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Port or Boat
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit" : "Add"} Port or Boat</DialogTitle>
                  <DialogDescription>
                    {editingId ? "Update the port or boat details" : "Create a new port or boat entry"}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Main Dock, Yacht A"
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) => setFormData({ ...formData, type: v as "port" | "boat" })}
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="port">Port/Dock</SelectItem>
                        <SelectItem value="boat">Boat/Vessel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      placeholder="e.g., North Harbor"
                      value={formData.location || ""}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="capacity">Capacity/Size</Label>
                    <Input
                      id="capacity"
                      placeholder="e.g., 5 boats, 25 meters"
                      value={formData.capacity || ""}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as any })}
                    >
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
                      placeholder="Add details about this port or boat..."
                      value={formData.description || ""}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="maintenance">Last Maintenance</Label>
                    <Input
                      id="maintenance"
                      type="date"
                      value={formData.lastMaintenance || ""}
                      onChange={(e) => setFormData({ ...formData, lastMaintenance: e.target.value })}
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
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {boats.map((boat) => (
            <Card key={boat.id} className="overflow-hidden hover:shadow-lg transition-shadow bg-card border-border">
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getTypeIcon(boat.type)}</span>
                    <div>
                      <h3 className="font-semibold text-card-foreground text-sm sm:text-base">{boat.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{boat.location}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(boat.status)}`}>
                    {boat.status}
                  </span>
                </div>

                {boat.capacity && (
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    <span className="font-medium text-card-foreground">Capacity:</span> {boat.capacity}
                  </p>
                )}

                {boat.description && (
                  <p className="text-xs sm:text-sm text-card-foreground line-clamp-2">{boat.description}</p>
                )}

                {boat.lastMaintenance && (
                  <p className="text-xs text-muted-foreground">
                    Last maintained: {new Date(boat.lastMaintenance).toLocaleDateString()}
                  </p>
                )}

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => handleEdit(boat)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(boat.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {boats.length === 0 && (
          <div className="text-center py-12">
            <Anchor className="h-16 w-16 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No ports or boats yet</h3>
            <p className="text-muted-foreground mt-2">Start by adding your first port or boat to the system</p>
          </div>
        )}
      </div>
    </div>
  )
}
