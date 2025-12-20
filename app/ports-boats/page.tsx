"use client"

import { useState } from "react"
import { Plus, Anchor, Ship, Trash2, Edit2, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
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
import { createBrowserClient } from "@supabase/ssr"

interface PortBoat {
  id: string
  name: string
  type: "port" | "boat"
  location: string
  capacity?: string
  status: "operational" | "maintenance" | "inactive"
  description: string
  last_maintenance?: string
}

const MOCK_DATA: PortBoat[] = [
  {
    id: "1",
    name: "Embarcadero Rebelin",
    type: "port",
    location: "Rebelin",
    capacity: "4 boats",
    status: "operational",
    description: "Primary docking facility",
    last_maintenance: "14-12-2024",
  },
  {
    id: "2",
    name: "Corovado",
    type: "boat",
    location: "Rebelin",
    capacity: "10 meters",
    status: "operational",
    description: "Main transport vessel",
    last_maintenance: "10-12-2024",
  },
  {
    id: "3",
    name: "Embarcadero Puerto Claro",
    type: "port",
    location: "Puerto Claro",
    capacity: "6 boats",
    status: "operational",
    description: "Secondary port facility",
    last_maintenance: "12-12-2024",
  },
  {
    id: "4",
    name: "Nativa",
    type: "boat",
    location: "Rebelin",
    capacity: "15 meters",
    status: "operational",
    description: "Secondary transport vessel",
    last_maintenance: "08-12-2024",
  },
]

function PortsBoatsContent({
  boats,
  setBoats,
  isOpen,
  setIsOpen,
  editingId,
  setEditingId,
  formData,
  setFormData,
  filterType,
  setFilterType,
  handleAddOrEdit,
  handleEdit,
  handleDelete,
  getStatusColor,
  getTypeIcon,
  getCardBorderColor,
}) {
  const filteredBoats = boats.filter((boat) => {
    if (filterType === "all") return true
    return boat.type === filterType
  })

  const portCount = boats.filter((b) => b.type === "port").length
  const boatCount = boats.filter((b) => b.type === "boat").length

  return (
    <div className="space-y-8">
      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filterType === "all" ? "default" : "outline"}
          onClick={() => setFilterType("all")}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          All Items ({boats.length})
        </Button>
        <Button
          variant={filterType === "port" ? "default" : "outline"}
          onClick={() => setFilterType("port")}
          className="gap-2"
        >
          <Anchor className="h-4 w-4" />
          Ports ({portCount})
        </Button>
        <Button
          variant={filterType === "boat" ? "default" : "outline"}
          onClick={() => setFilterType("boat")}
          className="gap-2"
        >
          <Ship className="h-4 w-4" />
          Boats ({boatCount})
        </Button>
      </div>

      {/* Ports Section */}
      {(filterType === "all" || filterType === "port") && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-[#726658]"></div>
            <h2 className="text-xl font-semibold">Ports</h2>
            <span className="text-sm text-muted-foreground">({boats.filter((b) => b.type === "port").length})</span>
          </div>

          {boats.filter((b) => b.type === "port").length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {boats
                .filter((b) => b.type === "port")
                .map((port) => (
                  <Card key={port.id} className={`p-6 ${getCardBorderColor(port.type)}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-[#726658]">{getTypeIcon(port.type)}</div>
                        <div>
                          <h3 className="font-semibold text-foreground">{port.name}</h3>
                          <p className="text-xs text-muted-foreground">{port.location}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(port.status)}`}>
                        {port.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Capacity</p>
                        <p className="text-sm font-medium">{port.capacity}</p>
                      </div>
                      {port.last_maintenance && (
                        <div>
                          <p className="text-xs text-muted-foreground">Last maintenance</p>
                          <p className="text-sm font-medium">{port.last_maintenance}</p>
                        </div>
                      )}
                      {port.description && (
                        <div>
                          <p className="text-xs text-muted-foreground">Description</p>
                          <p className="text-sm">{port.description}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(port)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(port.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </Card>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Anchor className="h-12 w-12 text-muted mx-auto mb-2" />
              <p>No ports registered yet</p>
            </div>
          )}
        </div>
      )}

      {/* Boats Section */}
      {(filterType === "all" || filterType === "boat") && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-[#726658]"></div>
            <h2 className="text-xl font-semibold">Boats</h2>
            <span className="text-sm text-muted-foreground">({boats.filter((b) => b.type === "boat").length})</span>
          </div>

          {boats.filter((b) => b.type === "boat").length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {boats
                .filter((b) => b.type === "boat")
                .map((boat) => (
                  <Card key={boat.id} className={`p-6 ${getCardBorderColor(boat.type)}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-[#726658]">{getTypeIcon(boat.type)}</div>
                        <div>
                          <h3 className="font-semibold text-foreground">{boat.name}</h3>
                          <p className="text-xs text-muted-foreground">{boat.location}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(boat.status)}`}>
                        {boat.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Size</p>
                        <p className="text-sm font-medium">{boat.capacity}</p>
                      </div>
                      {boat.last_maintenance && (
                        <div>
                          <p className="text-xs text-muted-foreground">Last maintenance</p>
                          <p className="text-sm font-medium">{boat.last_maintenance}</p>
                        </div>
                      )}
                      {boat.description && (
                        <div>
                          <p className="text-xs text-muted-foreground">Description</p>
                          <p className="text-sm">{boat.description}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(boat)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(boat.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
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
      )}
    </div>
  )
}

export default function PortsBoatsPage() {
  const [supabase] = useState(() =>
    createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
  )

  const [boats, setBoats] = useState<PortBoat[]>(MOCK_DATA)
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<PortBoat>>({
    type: "boat",
    status: "operational",
  })
  const [filterType, setFilterType] = useState<"all" | "port" | "boat">("all")

  // When the database table is created, uncomment this useEffect to enable database integration

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
        last_maintenance: formData.last_maintenance,
      }
      setBoats([newBoat, ...boats])
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
        return "bg-emerald-500/10 text-emerald-600"
      case "maintenance":
        return "bg-amber-500/10 text-amber-600"
      case "inactive":
        return "bg-slate-500/10 text-slate-600"
      default:
        return "bg-slate-500/10 text-slate-600"
    }
  }

  const getTypeIcon = (type: string) =>
    type === "port" ? <Anchor className="h-5 w-5" /> : <Ship className="h-5 w-5" />

  const getCardBorderColor = (type: string) => "border-l-4 border-l-[#726658]"

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Ports & Boats"
          description="Manage your port facilities and boat fleet"
          icon={<Anchor className="h-6 w-6" />}
        />

        {/* Add Port/Boat Dialog */}
        <div className="flex justify-end">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData({ type: "boat", status: "operational" })} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Port or Boat
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit" : "Add"} Port or Boat</DialogTitle>
                <DialogDescription>
                  {editingId ? "Update the details" : "Fill in the details for the new"} port or boat
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="port">Port</SelectItem>
                      <SelectItem value="boat">Boat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Port or boat name"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Location"
                    value={formData.location || ""}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="capacity">{formData.type === "port" ? "Capacity (boats)" : "Size (meters)"}</Label>
                  <Input
                    id="capacity"
                    placeholder={formData.type === "port" ? "4 boats" : "15 meters"}
                    value={formData.capacity || ""}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
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
                    placeholder="Description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="lastMaintenance">Last Maintenance</Label>
                  <Input
                    id="lastMaintenance"
                    placeholder="DD-MM-YYYY"
                    value={formData.last_maintenance || ""}
                    onChange={(e) => setFormData({ ...formData, last_maintenance: e.target.value })}
                  />
                </div>

                <Button onClick={handleAddOrEdit} className="w-full">
                  {editingId ? "Update" : "Add"} {formData.type === "port" ? "Port" : "Boat"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Content */}
        <PortsBoatsContent
          boats={boats}
          setBoats={setBoats}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          editingId={editingId}
          setEditingId={setEditingId}
          formData={formData}
          setFormData={setFormData}
          filterType={filterType}
          setFilterType={setFilterType}
          handleAddOrEdit={handleAddOrEdit}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          getStatusColor={getStatusColor}
          getTypeIcon={getTypeIcon}
          getCardBorderColor={getCardBorderColor}
        />
      </div>
    </AppLayout>
  )
}
