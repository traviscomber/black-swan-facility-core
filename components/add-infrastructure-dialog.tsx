"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import {
  Wifi,
  Droplet,
  Zap,
  MapPin,
  Flame,
  Cloud,
  Leaf,
  Trash2,
  Dices as Pipes,
  Box,
  Wrench,
  Apple,
  Lock,
  AlertTriangle,
} from "lucide-react"

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

const UTILITY_SPECS: Record<string, { label: string; icon: React.ReactNode }> = {
  electricity: { label: "Electricity", icon: <Zap className="h-4 w-4" /> },
  water: { label: "Water Supply", icon: <Droplet className="h-4 w-4" /> },
  internet: { label: "Internet & Network", icon: <Wifi className="h-4 w-4" /> },
  drinking_water: { label: "Drinking Water", icon: <Cloud className="h-4 w-4" /> },
  heating: { label: "Heating System", icon: <Flame className="h-4 w-4" /> },
  gasoline: { label: "Gasoline Storage", icon: <AlertTriangle className="h-4 w-4" /> },
  gas: { label: "Gas System", icon: <Cloud className="h-4 w-4" /> },
  wood_supply: { label: "Wood Supply", icon: <Leaf className="h-4 w-4" /> },
  trash: { label: "Trash Management", icon: <Trash2 className="h-4 w-4" /> },
  sewage: { label: "Sewage System", icon: <Pipes className="h-4 w-4" /> },
  storage: { label: "Storage Systems", icon: <Box className="h-4 w-4" /> },
  equipment_inventory: { label: "Equipment", icon: <Wrench className="h-4 w-4" /> },
  food_storage: { label: "Food Storage", icon: <Apple className="h-4 w-4" /> },
  security: { label: "Security Systems", icon: <Lock className="h-4 w-4" /> },
  fire_safety: { label: "Fire Safety", icon: <AlertTriangle className="h-4 w-4" /> },
  cattle: { label: "Cattle", icon: <Wifi className="h-4 w-4" /> },
}

export function AddInfrastructureDialog({
  open,
  onClose,
  onAdd,
  initialCoordinates,
}: {
  open: boolean
  onClose: () => void
  onAdd: () => void
  initialCoordinates?: { lat: number; lng: number } | null
}) {
  const [formData, setFormData] = useState({
    name: "",
    category: "internet",
    description: "",
    latitude: "",
    longitude: "",
    status: "planned",
    priority: "normal",
    location_id: "",
  })
  const [loading, setLoading] = useState(false)
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [filteredAssetTypes, setFilteredAssetTypes] = useState<AssetType[]>([])
  const [locations, setLocations] = useState<Location[]>([])

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
    const filtered = assetTypes.filter((type) => type.category === formData.category)
    setFilteredAssetTypes(filtered)
  }, [formData.category, assetTypes])

  useEffect(() => {
    if (initialCoordinates) {
      setFormData((prev) => ({
        ...prev,
        latitude: initialCoordinates.lat.toFixed(6),
        longitude: initialCoordinates.lng.toFixed(6),
      }))
    }
  }, [initialCoordinates])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase
      .from("infrastructure_plans")
      .insert({
        name: formData.name,
        category: formData.category,
        description: formData.description || null,
        latitude: Number.parseFloat(formData.latitude),
        longitude: Number.parseFloat(formData.longitude),
        status: formData.status,
        priority: formData.priority,
        location_id: formData.location_id || null,
      })
      .select()

    setLoading(false)

    if (!error) {
      setFormData({
        name: "",
        category: "internet",
        description: "",
        latitude: "",
        longitude: "",
        status: "planned",
        priority: "normal",
        location_id: "",
      })
      onAdd()
    } else {
      console.error("[v0] Error adding infrastructure:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Add Infrastructure
          </DialogTitle>
          {initialCoordinates && (
            <p className="text-sm text-gray-600 mt-2">
              Location selected from map: {initialCoordinates.lat.toFixed(4)}, {initialCoordinates.lng.toFixed(4)}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="location">Location</Label>
            <Select
              value={formData.location_id}
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
            <p className="text-xs text-gray-500 mt-1">Group this infrastructure by location</p>
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(UTILITY_SPECS).map(([key, spec]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      {spec.icon}
                      {spec.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="asset-type">
              Asset Type *<span className="text-xs text-gray-500 ml-1">(or enter custom name below)</span>
            </Label>
            <Select value={formData.name} onValueChange={(value) => setFormData({ ...formData, name: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select an asset type or enter custom" />
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
          </div>

          <div>
            <Label htmlFor="name">Custom Name (optional if asset type selected)</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Main Fiber Entry Point"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Use asset type or enter a custom name for this infrastructure</p>
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
              <Label htmlFor="latitude">
                Latitude *
                {!initialCoordinates && <span className="text-xs text-gray-500 ml-1">(or right-click map)</span>}
              </Label>
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
              <Label htmlFor="longitude">
                Longitude *
                {!initialCoordinates && <span className="text-xs text-gray-500 ml-1">(or right-click map)</span>}
              </Label>
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

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Adding..." : "Add Infrastructure"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
