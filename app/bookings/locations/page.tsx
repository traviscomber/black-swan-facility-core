"use client"

import type React from "react"
import { useToast } from "@/components/ui/use-toast"
import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Plus, Pencil, Trash2, MapPin, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const FACILITY_COLORS = [
  { bg: "bg-red-200", border: "border-l-4 border-red-400", text: "text-red-900" },
  { bg: "bg-blue-200", border: "border-l-4 border-blue-400", text: "text-blue-900" },
  { bg: "bg-emerald-200", border: "border-l-4 border-emerald-400", text: "text-emerald-900" },
  { bg: "bg-amber-200", border: "border-l-4 border-amber-400", text: "text-amber-900" },
  { bg: "bg-violet-200", border: "border-l-4 border-violet-400", text: "text-violet-900" },
  { bg: "bg-rose-200", border: "border-l-4 border-rose-400", text: "text-rose-900" },
  { bg: "bg-indigo-200", border: "border-l-4 border-indigo-400", text: "text-indigo-900" },
  { bg: "bg-teal-200", border: "border-l-4 border-teal-400", text: "text-teal-900" },
]

interface Location {
  id: string
  name: string
  description: string | null
  latitude: number | null
  longitude: number | null
  is_active: boolean
  created_at: string
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()

  const supabase = createBrowserClient()

  useEffect(() => {
    loadLocations()
  }, [])

  async function loadLocations() {
    const { data, error } = await supabase.from("locations").select("*").order("name")

    if (error) {
      console.error("Error loading locations:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load locations",
      })
    } else {
      setLocations(data || [])
    }
  }

  function getFacilityColor(index: number) {
    return FACILITY_COLORS[Math.max(0, index) % FACILITY_COLORS.length]
  }

  async function handleAddLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const { error } = await supabase.from("locations").insert({
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
      longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
      is_active: true,
    })

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add location",
      })
    } else {
      toast({
        title: "Success",
        description: "Location added successfully",
      })
      setIsAddDialogOpen(false)
      loadLocations()
    }
  }

  async function handleEditLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingLocation) return

    const formData = new FormData(e.currentTarget)

    const { error } = await supabase
      .from("locations")
      .update({
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
        longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
      })
      .eq("id", editingLocation.id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update location",
      })
    } else {
      toast({
        title: "Success",
        description: "Location updated successfully",
      })
      setIsEditDialogOpen(false)
      setEditingLocation(null)
      loadLocations()
    }
  }

  async function handleDeleteLocation(id: string) {
    if (!confirm("Are you sure you want to delete this location?")) return

    const { error } = await supabase.from("locations").delete().eq("id", id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete location. It may have associated rooms.",
      })
    } else {
      toast({
        title: "Success",
        description: "Location deleted successfully",
      })
      loadLocations()
    }
  }

  async function toggleActive(location: Location) {
    const { error } = await supabase.from("locations").update({ is_active: !location.is_active }).eq("id", location.id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update location status",
      })
    } else {
      loadLocations()
    }
  }

  const filteredLocations = locations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Property Locations</h1>
            <p className="text-muted-foreground">Manage all rental property locations</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        </div>

        <div className="flex gap-4">
          <Input
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLocations.map((location, index) => {
            const facilityColor = getFacilityColor(index)
            return (
              <Card key={location.id} className={`${facilityColor.bg} ${facilityColor.border}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className={`h-5 w-5 ${facilityColor.text}`} />
                      <CardTitle className={facilityColor.text}>{location.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingLocation(location)
                          setIsEditDialogOpen(true)
                        }}
                        className={`${facilityColor.text} hover:bg-black/10`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteLocation(location.id)}
                        className={`${facilityColor.text} hover:bg-black/10`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className={`${facilityColor.text}/70`}>
                    {location.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {location.latitude && location.longitude && (
                      <div className={`${facilityColor.text}/70`}>
                        Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className={location.is_active ? `${facilityColor.text}` : `${facilityColor.text}/60`}>
                        {location.is_active ? "Active" : "Inactive"}
                      </span>
                      <div className="flex gap-2">
                        <Link href={`/bookings/locations/${location.id}`}>
                          <Button
                            size="sm"
                            variant="secondary"
                            className={`${facilityColor.bg} ${facilityColor.text} hover:opacity-90`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Manage Rooms & Beds
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActive(location)}
                          className={`${facilityColor.text} border-current hover:bg-black/10`}
                        >
                          {location.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* ... existing dialogs ... */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <form onSubmit={handleAddLocation}>
              <DialogHeader>
                <DialogTitle>Add New Location</DialogTitle>
                <DialogDescription>Add a new rental property location to your facility</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Location Name *</Label>
                  <Input id="name" name="name" placeholder="e.g., Bamboo House, Cesar Palace" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Brief description of the property"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input id="latitude" name="latitude" type="number" step="any" placeholder="9.12345" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input id="edit-longitude" name="longitude" type="number" step="any" placeholder="-83.12345" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Location</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <form onSubmit={handleEditLocation}>
              <DialogHeader>
                <DialogTitle>Edit Location</DialogTitle>
                <DialogDescription>Update the location details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Location Name *</Label>
                  <Input id="edit-name" name="name" defaultValue={editingLocation?.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    defaultValue={editingLocation?.description || ""}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-latitude">Latitude</Label>
                    <Input
                      id="edit-latitude"
                      name="latitude"
                      type="number"
                      step="any"
                      defaultValue={editingLocation?.latitude || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-longitude">Longitude</Label>
                    <Input
                      id="edit-longitude"
                      name="longitude"
                      type="number"
                      step="any"
                      defaultValue={editingLocation?.longitude || ""}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
