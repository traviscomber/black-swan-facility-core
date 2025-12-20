"use client"

import { useState } from "react"
import { Plus, Anchor, Ship, Trash2, Edit2, Filter } from "lucide-react"
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
      name: "Embarcadero Rebelin",
      type: "port",
      location: "Rebelin",
      capacity: "4 boats",
      status: "operational",
      description: "Primary docking facility",
      lastMaintenance: "2024-12-14",
    },
    {
      id: "2",
      name: "Corovado",
      type: "boat",
      location: "Rebelin",
      capacity: "10 meters",
      status: "operational",
      description: "Corovado vessel",
      lastMaintenance: "2024-12-19",
    },
    {
      id: "3",
      name: "Embarcadero Puerto Claro",
      type: "port",
      location: "Puerto Claro",
      capacity: "8 boats",
      status: "operational",
      description: "Secondary port facility",
      lastMaintenance: "2024-12-14",
    },
    {
      id: "4",
      name: "Nativa",
      type: "boat",
      location: "Rebelin",
      capacity: "15 meters",
      status: "operational",
      description: "Nativa vessel",
      lastMaintenance: "2024-12-19",
    },
  ])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<PortBoat>>({
    type: "boat",
    status: "operational",
  })
  const [filterType, setFilterType] = useState<"all" | "port" | "boat">("all")

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
        return "bg-green-500/20 text-green-400 border border-green-500/30"
      case "maintenance":
        return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
      case "inactive":
        return "bg-gray-500/20 text-gray-400 border border-gray-500/30"
      default:
        return "bg-gray-500/20 text-gray-400 border border-gray-500/30"
    }
  }

  const getTypeIcon = (type: string) => {
    return type === "port" ? <Anchor className="h-5 w-5 text-blue-400" /> : <Ship className="h-5 w-5 text-orange-400" />
  }

  const getCardBorderColor = (type: string) => {
    return type === "port" ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-orange-500"
  }

  const filteredBoats = boats.filter((boat) => {
    if (filterType === "all") return true
    return boat.type === filterType
  })

  const ports = filteredBoats.filter((b) => b.type === "port")
  const vessels = filteredBoats.filter((b) => b.type === "boat")

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Anchor className="h-8 w-8 text-primary" />
                Ports & Boats
              </h1>
              <p className="text-muted-foreground mt-1">Manage your port facilities and boat fleet</p>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingId(null)
                    setFormData({ type: "boat", status: "operational" })
                  }}
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

          {/* Filter Tabs */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                filterType === "all"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Filter className="h-4 w-4 inline mr-2" />
              All ({boats.length})
            </button>
            <button
              onClick={() => setFilterType("port")}
              className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                filterType === "port"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Anchor className="h-4 w-4" />
              Ports ({ports.length})
            </button>
            <button
              onClick={() => setFilterType("boat")}
              className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                filterType === "boat"
                  ? "text-orange-400 border-b-2 border-orange-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Ship className="h-4 w-4" />
              Boats ({vessels.length})
            </button>
          </div>
        </div>

        {/* Port Facilities Section */}
        {filterType === "all" || filterType === "port" ? (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-1 bg-blue-500 rounded"></div>
              <h2 className="text-2xl font-bold text-foreground">Port Facilities</h2>
              <span className="text-sm text-muted-foreground ml-auto">({ports.length})</span>
            </div>
            {ports.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ports.map((port) => (
                  <Card
                    key={port.id}
                    className={`overflow-hidden hover:shadow-lg transition-all bg-card border-border ${getCardBorderColor(port.type)}`}
                  >
                    <div className="p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getTypeIcon(port.type)}
                          <div>
                            <h3 className="font-semibold text-card-foreground">{port.name}</h3>
                            <p className="text-sm text-muted-foreground">{port.location}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(port.status)}`}>
                          {port.status}
                        </span>
                      </div>

                      {port.capacity && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-card-foreground">Capacity:</span> {port.capacity}
                        </p>
                      )}

                      {port.description && (
                        <p className="text-sm text-card-foreground line-clamp-2">{port.description}</p>
                      )}

                      {port.lastMaintenance && (
                        <p className="text-xs text-muted-foreground">
                          Last maintained: {new Date(port.lastMaintenance).toLocaleDateString()}
                        </p>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button variant="ghost" size="sm" className="flex-1" onClick={() => handleEdit(port)}>
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(port.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Anchor className="h-12 w-12 text-muted mx-auto mb-2" />
                <p>No port facilities registered yet</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Boat Fleet Section */}
        {filterType === "all" || filterType === "boat" ? (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-1 bg-orange-500 rounded"></div>
              <h2 className="text-2xl font-bold text-foreground">Boat Fleet</h2>
              <span className="text-sm text-muted-foreground ml-auto">({vessels.length})</span>
            </div>
            {vessels.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vessels.map((boat) => (
                  <Card
                    key={boat.id}
                    className={`overflow-hidden hover:shadow-lg transition-all bg-card border-border ${getCardBorderColor(boat.type)}`}
                  >
                    <div className="p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getTypeIcon(boat.type)}
                          <div>
                            <h3 className="font-semibold text-card-foreground">{boat.name}</h3>
                            <p className="text-sm text-muted-foreground">{boat.location}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(boat.status)}`}>
                          {boat.status}
                        </span>
                      </div>

                      {boat.capacity && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-card-foreground">Size:</span> {boat.capacity}
                        </p>
                      )}

                      {boat.description && (
                        <p className="text-sm text-card-foreground line-clamp-2">{boat.description}</p>
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
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Ship className="h-12 w-12 text-muted mx-auto mb-2" />
                <p>No boats registered yet</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
