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
import { AppLayout } from "@/components/app-layout"
import { useLanguage } from "@/lib/hooks/use-language"
import { facilitiesTranslations } from "@/lib/translations/facilities"

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
  const { language } = useLanguage()
  const copy = facilitiesTranslations[language]
  const localize = (href: string) => `/${language}${href}`

  const supabase = createBrowserClient()

  useEffect(() => {
    loadLocations()
  }, [])

  async function loadLocations() {
    const { data, error } = await supabase.from("locations").select("*").order("name")

    if (error) {
      console.error("Error loading locations:", error)
      toast({ variant: "destructive", title: copy.error, description: copy.loadError })
    } else {
      setLocations(data || [])
    }
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
      toast({ variant: "destructive", title: copy.error, description: copy.addError })
    } else {
      toast({ title: copy.success, description: copy.addSuccess })
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
      toast({ variant: "destructive", title: copy.error, description: copy.updateError })
    } else {
      toast({ title: copy.success, description: copy.updateSuccess })
      setIsEditDialogOpen(false)
      setEditingLocation(null)
      loadLocations()
    }
  }

  async function handleDeleteLocation(id: string) {
    if (!confirm(copy.deleteConfirm)) return
    const { error } = await supabase.from("locations").delete().eq("id", id)
    if (error) {
      toast({ variant: "destructive", title: copy.error, description: copy.deleteError })
    } else {
      toast({ title: copy.success, description: copy.deleteSuccess })
      loadLocations()
    }
  }

  async function toggleActive(location: Location) {
    const { error } = await supabase.from("locations").update({ is_active: !location.is_active }).eq("id", location.id)
    if (error) toast({ variant: "destructive", title: copy.error, description: copy.statusError })
    else loadLocations()
  }

  const filteredLocations = locations.filter(
    (loc) => loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || loc.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-primary">BFCS · Hospitality</p>
              <h1 className="text-3xl font-semibold text-foreground">{copy.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />{copy.addLocation}
            </Button>
          </div>

          <div className="flex gap-4">
            <Input
              placeholder={copy.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md border border-white/15 bg-secondary text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredLocations.map((location) => (
              <Card key={location.id} className="border border-white/10 bg-card transition-colors hover:border-primary/35 hover:bg-card/95">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <CardTitle className="truncate text-base font-medium text-foreground">{location.name}</CardTitle>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditingLocation(location); setIsEditDialogOpen(true) }}
                        className="text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        aria-label={copy.editLocation}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteLocation(location.id)}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={copy.deleteConfirm}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="min-h-5 text-sm text-muted-foreground">
                    {location.description || copy.noDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3 text-sm">
                    {location.latitude && location.longitude && (
                      <div className="text-xs text-muted-foreground">
                        {copy.coordinates}: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </div>
                    )}
                    <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className={location.is_active ? "inline-flex w-fit items-center gap-2 text-primary" : "inline-flex w-fit items-center gap-2 text-muted-foreground"}>
                        <span className={location.is_active ? "h-1.5 w-1.5 bg-primary" : "h-1.5 w-1.5 bg-muted-foreground"} />
                        {location.is_active ? copy.active : copy.inactive}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Link href={localize(`/bookings/locations/${location.id}`)}>
                          <Button size="sm" variant="secondary" className="border border-white/10 bg-secondary text-foreground hover:bg-accent">
                            <Eye className="mr-2 h-4 w-4" />{copy.manageRoomsBeds}
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActive(location)}
                          className="border-white/15 text-foreground hover:bg-white/5"
                        >
                          {location.is_active ? copy.deactivate : copy.activate}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent>
              <form onSubmit={handleAddLocation}>
                <DialogHeader>
                  <DialogTitle>{copy.addNewLocation}</DialogTitle>
                  <DialogDescription>{copy.addNewLocationDesc}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label htmlFor="name">{copy.locationName} *</Label><Input id="name" name="name" placeholder={copy.locationNamePlaceholder} required /></div>
                  <div className="space-y-2"><Label htmlFor="description">{copy.descriptionLabel}</Label><Textarea id="description" name="description" placeholder={copy.descriptionPlaceholder} rows={3} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="latitude">{copy.latitudeLabel}</Label><Input id="latitude" name="latitude" type="number" step="0.00001" placeholder={copy.latitudePlaceholder} /></div>
                    <div className="space-y-2"><Label htmlFor="longitude">{copy.longitudeLabel}</Label><Input id="longitude" name="longitude" type="number" step="0.00001" placeholder={copy.longitudePlaceholder} /></div>
                  </div>
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>{copy.cancel}</Button><Button type="submit">{copy.addLocationBtn}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <form onSubmit={handleEditLocation}>
                <DialogHeader>
                  <DialogTitle>{copy.editLocation}</DialogTitle>
                  <DialogDescription>{copy.editLocationDesc}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label htmlFor="edit-name">{copy.locationName} *</Label><Input id="edit-name" name="name" defaultValue={editingLocation?.name} required /></div>
                  <div className="space-y-2"><Label htmlFor="edit-description">{copy.descriptionLabel}</Label><Textarea id="edit-description" name="description" defaultValue={editingLocation?.description || ""} rows={3} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="edit-latitude">{copy.latitudeLabel}</Label><Input id="edit-latitude" name="latitude" type="number" step="0.00001" defaultValue={editingLocation?.latitude || ""} /></div>
                    <div className="space-y-2"><Label htmlFor="edit-longitude">{copy.longitudeLabel}</Label><Input id="edit-longitude" name="longitude" type="number" step="0.00001" defaultValue={editingLocation?.longitude || ""} /></div>
                  </div>
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>{copy.cancel}</Button><Button type="submit">{copy.saveChanges}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AppLayout>
  )
}
