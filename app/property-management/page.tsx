"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { AppLayout } from "@/components/app-layout"
import { useLanguage } from "@/lib/use-language"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Home,
  Package,
  Droplets,
  Leaf,
  Building2,
  Zap,
  ParkingCircle,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react"

interface Location {
  id: string
  name: string
  description: string | null
  facility_type: string
  is_active: boolean
  created_at: string
}

const facilityTypeConfig = {
  rental: {
    icon: Home,
    label: "property.rental_property",
    color: "text-blue-600",
    description: "property.rental_desc",
    managePath: "/bookings/locations",
  },
  storage: {
    icon: Package,
    label: "property.storage_facility",
    color: "text-amber-600",
    description: "property.storage_desc",
    managePath: "/facilities/storage",
  },
  laundry: {
    icon: Droplets,
    label: "property.laundry_facility",
    color: "text-cyan-600",
    description: "property.laundry_desc",
    managePath: "/facilities/laundry",
  },
  garden: {
    icon: Leaf,
    label: "property.garden_grounds",
    color: "text-green-600",
    description: "property.garden_desc",
    managePath: "/facilities/garden",
  },
  office: {
    icon: Building2,
    label: "property.office_space",
    color: "text-purple-600",
    description: "property.office_desc",
    managePath: "/facilities/office",
  },
  utility: {
    icon: Zap,
    label: "property.utility_area",
    color: "text-yellow-600",
    description: "property.utility_desc",
    managePath: "/facilities/utility",
  },
  parking: {
    icon: ParkingCircle,
    label: "property.parking_area",
    color: "text-gray-600",
    description: "property.parking_desc",
    managePath: "/facilities/parking",
  },
  other: {
    icon: MoreHorizontal,
    label: "property.other_facility",
    color: "text-gray-600",
    description: "property.other_desc",
    managePath: "/facilities/other",
  },
}

export default function PropertyManagementPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  const { t } = useLanguage()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    facility_type: "rental",
  })

  const supabase = createBrowserClient()

  useEffect(() => {
    fetchLocations()
  }, [])

  async function fetchLocations() {
    try {
      const { data } = await supabase.from("locations").select("*").order("name")
      setLocations(data || [])
    } catch (error) {
      console.error("Error fetching locations:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddLocation(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const { error } = await supabase.from("locations").insert({
        name: formData.name,
        description: formData.description || null,
        facility_type: formData.facility_type,
        is_active: true,
      })

      if (error) throw error

      setFormData({ name: "", description: "", facility_type: "rental" })
      setAddDialogOpen(false)
      fetchLocations()
    } catch (error) {
      console.error("Error adding location:", error)
      alert("Failed to add location")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleEditLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLocation) return

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from("locations")
        .update({
          name: formData.name,
          description: formData.description || null,
          facility_type: formData.facility_type,
        })
        .eq("id", selectedLocation.id)

      if (error) throw error

      setEditDialogOpen(false)
      setSelectedLocation(null)
      fetchLocations()
    } catch (error) {
      console.error("Error updating location:", error)
      alert("Failed to update location")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteLocation() {
    if (!selectedLocation) return

    setIsSubmitting(true)

    try {
      const { error } = await supabase.from("locations").delete().eq("id", selectedLocation.id)

      if (error) throw error

      setDeleteDialogOpen(false)
      setSelectedLocation(null)
      fetchLocations()
    } catch (error) {
      console.error("Error deleting location:", error)
      alert(t("property.failed_delete"))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleActive(location: Location) {
    try {
      const { error } = await supabase
        .from("locations")
        .update({ is_active: !location.is_active })
        .eq("id", location.id)

      if (error) throw error
      fetchLocations()
    } catch (error) {
      console.error("Error toggling location status:", error)
    }
  }

  function openEditDialog(location: Location) {
    setSelectedLocation(location)
    setFormData({
      name: location.name,
      description: location.description || "",
      facility_type: location.facility_type || "other",
    })
    setEditDialogOpen(true)
  }

  const groupedByType = locations.reduce(
    (acc, location) => {
      const type = location.facility_type || "other"
      if (!acc[type]) acc[type] = []
      acc[type].push(location)
      return acc
    },
    {} as Record<string, Location[]>,
  )

  const filteredLocations = locations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredGrouped = Object.entries(groupedByType).reduce(
    (acc, [type, locs]) => {
      acc[type] = locs.filter(
        (loc) =>
          loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loc.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      return acc
    },
    {} as Record<string, Location[]>,
  )

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-muted-foreground">{t("property.loading")}</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 md:py-12 md:px-6 space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-accent">{t("property.title")}</h1>
            <p className="text-muted-foreground">{t("property.description")}</p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            {t("property.add_property")}
          </Button>
        </div>

        {/* Search Bar */}
        <Input
          placeholder={t("property.search_placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />

        {/* Facility Type Sections */}
        <div className="space-y-8">
          {Object.entries(facilityTypeConfig).map(([typeKey, config]) => {
            const Icon = config.icon
            const propertiesOfType = filteredGrouped[typeKey] || []

            return (
              <div key={typeKey} className="space-y-4">
                <div className="flex items-center gap-3 border-l-4 border-primary pl-4">
                  <Icon className={`h-6 w-6 ${config.color}`} />
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-accent">{t(config.label as string)}</h2>
                    <p className="text-sm text-muted-foreground">{t(config.description as string)}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{propertiesOfType.length} {t("property.properties_count")}</span>
                </div>

                {propertiesOfType.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground">
                        {t("property.no_configured").replace("{type}", t(config.label as string).toLowerCase())}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {propertiesOfType.map((location) => (
                      <Card key={location.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{location.name}</CardTitle>
                              <CardDescription>{location.description || t("property.no_description")}</CardDescription>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditDialog(location)}
                                className="h-8 w-8"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedLocation(location)
                                  setDeleteDialogOpen(true)
                                }}
                                className="h-8 w-8 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className={location.is_active ? "text-green-600 font-medium" : "text-gray-400"}>
                              {location.is_active ? "Active" : "Inactive"}
                            </span>
                            <Button
                              size="sm"
                              variant={location.is_active ? "outline" : "secondary"}
                              onClick={() => toggleActive(location)}
                            >
                              {location.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                          <Button
                            onClick={() => {
                              if (typeKey === "rental") {
                                router.push(`/bookings/locations/${location.id}`)
                              } else {
                                router.push(`/facilities/${typeKey}/${location.id}`)
                              }
                            }}
                            className="w-full"
                          >
                            Manage Details
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Property Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleAddLocation}>
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
              <DialogDescription>Create a new facility or property in your system</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Bamboo House, Storage Unit 1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facility_type">Facility Type *</Label>
                <Select
                  value={formData.facility_type}
                  onValueChange={(value) => setFormData({ ...formData, facility_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(facilityTypeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide details about this property"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Property"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Property Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleEditLocation}>
            <DialogHeader>
              <DialogTitle>Edit Property</DialogTitle>
              <DialogDescription>Update the property information</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Property Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-facility_type">Facility Type *</Label>
                <Select
                  value={formData.facility_type}
                  onValueChange={(value) => setFormData({ ...formData, facility_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(facilityTypeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Property Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedLocation?.name}"? This action cannot be undone and may affect
              related records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLocation}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
