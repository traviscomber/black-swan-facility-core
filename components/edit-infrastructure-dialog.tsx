"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { Wifi, Droplet, Zap, MapPin } from "lucide-react"

interface InfrastructurePlan {
  id: string
  name: string
  category: string
  description: string | null
  latitude: number
  longitude: number
  status: string
  priority: string
  installation_date: string | null
  last_inspection: string | null
  next_inspection: string | null
  specifications: any
  notes: string | null
  location_id: string | null // Added location_id field
}

interface AssetType {
  id: string
  name: string
  category: string
  description: string | null
}

interface Location {
  id: string
  name: string
  description: string | null
}

export function EditInfrastructureDialog({
  open,
  onClose,
  onUpdate,
  infrastructure,
}: {
  open: boolean
  onClose: () => void
  onUpdate: () => void
  infrastructure: InfrastructurePlan | null
}) {
  const [formData, setFormData] = useState({
    assetTypeId: "", // separate field for selected asset type
    name: "", // now only for custom name input
    category: "internet",
    description: "",
    latitude: "",
    longitude: "",
    status: "planned",
    priority: "normal",
    notes: "",
    location_id: "",
  })
  const [loading, setLoading] = useState(false)
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [filteredAssetTypes, setFilteredAssetTypes] = useState<AssetType[]>([])
  const [locations, setLocations] = useState<Location[]>([]) // Added locations state

  useEffect(() => {
    const fetchAssetTypes = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("infrastructure_asset_types").select("*").eq("is_active", true).order("name")

      if (data) {
        setAssetTypes(data)
      }
    }
    const fetchLocations = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("locations").select("*").eq("is_active", true).order("name")

      if (data) {
        setLocations(data)
      }
    }
    fetchAssetTypes()
    fetchLocations()
  }, [])

  useEffect(() => {
    if (infrastructure) {
      setFormData({
        assetTypeId: "", // asset types are for selection, not stored
        name: infrastructure.name,
        category: infrastructure.category,
        description: infrastructure.description || "",
        latitude: infrastructure.latitude.toString(),
        longitude: infrastructure.longitude.toString(),
        status: infrastructure.status,
        priority: infrastructure.priority,
        notes: infrastructure.notes || "",
        location_id: infrastructure.location_id || "",
      })
    }
  }, [infrastructure])

  useEffect(() => {
    const filtered = assetTypes.filter((type) => type.category === formData.category)
    setFilteredAssetTypes(filtered)
  }, [formData.category, assetTypes])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!infrastructure) return

    if (!formData.name) {
      alert("Please enter a name for this infrastructure")
      return
    }

    setLoading(true)

    console.log("[v0] Updating infrastructure in Supabase:", {
      id: infrastructure.id,
      name: formData.name,
      category: formData.category,
      latitude: Number.parseFloat(formData.latitude),
      longitude: Number.parseFloat(formData.longitude),
      location_id: formData.location_id || null,
    })

    const supabase = createClient()
    const { data, error } = await supabase
      .from("infrastructure_plans")
      .update({
        name: formData.name,
        category: formData.category,
        description: formData.description || null,
        latitude: Number.parseFloat(formData.latitude),
        longitude: Number.parseFloat(formData.longitude),
        status: formData.status,
        priority: formData.priority,
        notes: formData.notes || null,
        location_id: formData.location_id || null,
      })
      .eq("id", infrastructure.id)
      .select()

    console.log("[v0] Update result:", { data, error })

    setLoading(false)

    if (!error) {
      console.log("[v0] Infrastructure successfully updated in Supabase")
      onUpdate()
      onClose()
    } else {
      console.error("[v0] Error updating infrastructure:", error)
    }
  }

  if (!infrastructure) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Edit Infrastructure
          </DialogTitle>
          <DialogDescription>
            Update the details of this infrastructure item including name, category, location, and status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="location">Location</Label>
            <Select
              value={formData.location_id || "none"}
              onValueChange={(value) => setFormData({ ...formData, location_id: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a location (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Location</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
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
            <Label htmlFor="asset-type">Asset Type (reference)</Label>
            <Select
              value={formData.assetTypeId}
              onValueChange={(value) => setFormData({ ...formData, assetTypeId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a predefined asset type" />
              </SelectTrigger>
              <SelectContent>
                {filteredAssetTypes.length > 0 ? (
                  filteredAssetTypes.map((type) => (
                    <SelectItem key={type.id} value={type.name}>
                      {type.name}
                      {type.description && <span className="text-xs text-gray-500 ml-2">- {type.description}</span>}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No asset types available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">For reference only</p>
          </div>

          <div>
            <Label htmlFor="name">Infrastructure Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Main Fiber Entry Point"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this infrastructure"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="latitude">Latitude *</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="-39.8255"
                required
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude *</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="-73.2215"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
