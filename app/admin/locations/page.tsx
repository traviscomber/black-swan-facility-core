"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { Building2, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { useToast } from "@/hooks/use-toast"

interface Location {
  id: string
  name: string
  description: string | null
  latitude: number | null
  longitude: number | null
  is_active: boolean
  created_at: string
}

const copy = {
  es: {
    title: "Administración de ubicaciones",
    description: "Catálogo maestro de sectores y puntos operativos del Fundo Corcovado.",
    add: "Agregar ubicación",
    total: "ubicaciones registradas",
    georeferenced: "con coordenadas",
    loading: "Cargando ubicaciones…",
    empty: "No hay ubicaciones registradas.",
    name: "Nombre",
    descriptionLabel: "Descripción",
    coordinates: "Coordenadas",
    status: "Estado",
    actions: "Acciones",
    active: "Activa",
    inactive: "Inactiva",
    noCoordinates: "Sin coordenadas",
    addTitle: "Agregar ubicación",
    editTitle: "Editar ubicación",
    dialogDescription: "Las coordenadas son opcionales y deben corresponder a una ubicación válida del predio.",
    latitude: "Latitud",
    longitude: "Longitud",
    cancel: "Cancelar",
    save: "Guardar",
    saving: "Guardando…",
    deleteTitle: "Eliminar ubicación",
    deleteDescription: "Esta acción puede afectar activos, incidencias u otros registros relacionados. Continúe solo si la ubicación no está en uso.",
    delete: "Eliminar",
    loadError: "No fue posible cargar las ubicaciones.",
    saveSuccess: "Ubicación guardada",
    saveError: "No fue posible guardar la ubicación.",
    deleteSuccess: "Ubicación eliminada",
    deleteError: "No fue posible eliminar la ubicación. Puede estar siendo utilizada.",
    invalidCoordinates: "Las coordenadas ingresadas no son válidas.",
  },
  en: {
    title: "Location administration",
    description: "Master catalog of operational areas and points for Fundo Corcovado.",
    add: "Add location",
    total: "registered locations",
    georeferenced: "with coordinates",
    loading: "Loading locations…",
    empty: "No locations are registered.",
    name: "Name",
    descriptionLabel: "Description",
    coordinates: "Coordinates",
    status: "Status",
    actions: "Actions",
    active: "Active",
    inactive: "Inactive",
    noCoordinates: "No coordinates",
    addTitle: "Add location",
    editTitle: "Edit location",
    dialogDescription: "Coordinates are optional and must represent a valid point within the property.",
    latitude: "Latitude",
    longitude: "Longitude",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    deleteTitle: "Delete location",
    deleteDescription: "This action may affect assets, issues or other related records. Continue only when the location is not in use.",
    delete: "Delete",
    loadError: "Unable to load locations.",
    saveSuccess: "Location saved",
    saveError: "Unable to save the location.",
    deleteSuccess: "Location deleted",
    deleteError: "Unable to delete the location. It may still be in use.",
    invalidCoordinates: "The entered coordinates are invalid.",
  },
  de: {
    title: "Standortverwaltung",
    description: "Zentraler Katalog der Betriebsbereiche und Standorte auf Fundo Corcovado.",
    add: "Standort hinzufügen",
    total: "Standorte registriert",
    georeferenced: "mit Koordinaten",
    loading: "Standorte werden geladen…",
    empty: "Es sind keine Standorte registriert.",
    name: "Name",
    descriptionLabel: "Beschreibung",
    coordinates: "Koordinaten",
    status: "Status",
    actions: "Aktionen",
    active: "Aktiv",
    inactive: "Inaktiv",
    noCoordinates: "Keine Koordinaten",
    addTitle: "Standort hinzufügen",
    editTitle: "Standort bearbeiten",
    dialogDescription: "Koordinaten sind optional und müssen einen gültigen Punkt auf dem Gelände darstellen.",
    latitude: "Breitengrad",
    longitude: "Längengrad",
    cancel: "Abbrechen",
    save: "Speichern",
    saving: "Wird gespeichert…",
    deleteTitle: "Standort löschen",
    deleteDescription: "Diese Aktion kann Anlagen, Störungen oder andere verknüpfte Datensätze betreffen. Nur fortfahren, wenn der Standort nicht verwendet wird.",
    delete: "Löschen",
    loadError: "Standorte konnten nicht geladen werden.",
    saveSuccess: "Standort gespeichert",
    saveError: "Standort konnte nicht gespeichert werden.",
    deleteSuccess: "Standort gelöscht",
    deleteError: "Der Standort konnte nicht gelöscht werden. Er wird möglicherweise noch verwendet.",
    invalidCoordinates: "Die eingegebenen Koordinaten sind ungültig.",
  },
} as const

export default function LocationsAdminPage() {
  const { language } = useLanguage()
  const text = copy[language]
  const { toast } = useToast()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "", latitude: "", longitude: "", is_active: true })

  const georeferencedCount = useMemo(() => locations.filter((location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude)).length, [locations])

  const fetchLocations = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from("locations").select("id,name,description,latitude,longitude,is_active,created_at").order("name")
    if (error) toast({ title: text.loadError, description: error.message, variant: "destructive" })
    setLocations((data || []) as Location[])
    setLoading(false)
  }

  useEffect(() => { void fetchLocations() }, [])

  const openForm = (location?: Location) => {
    setSelectedLocation(location || null)
    setFormData(location ? {
      name: location.name,
      description: location.description || "",
      latitude: location.latitude?.toString() || "",
      longitude: location.longitude?.toString() || "",
      is_active: location.is_active,
    } : { name: "", description: "", latitude: "", longitude: "", is_active: true })
    setDialogOpen(true)
  }

  const parsedCoordinates = () => {
    const hasLatitude = formData.latitude.trim() !== ""
    const hasLongitude = formData.longitude.trim() !== ""
    if (hasLatitude !== hasLongitude) return null
    if (!hasLatitude) return { latitude: null, longitude: null }
    const latitude = Number(formData.latitude)
    const longitude = Number(formData.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
    return { latitude, longitude }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const coordinates = parsedCoordinates()
    if (!coordinates) {
      toast({ title: text.invalidCoordinates, variant: "destructive" })
      return
    }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      is_active: formData.is_active,
    }
    const result = selectedLocation
      ? await supabase.from("locations").update(payload).eq("id", selectedLocation.id)
      : await supabase.from("locations").insert(payload)
    setSaving(false)
    if (result.error) {
      toast({ title: text.saveError, description: result.error.message, variant: "destructive" })
      return
    }
    toast({ title: text.saveSuccess })
    setDialogOpen(false)
    await fetchLocations()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const supabase = createClient()
    const { error } = await supabase.from("locations").delete().eq("id", deleteTarget.id)
    if (error) toast({ title: text.deleteError, description: error.message, variant: "destructive" })
    else toast({ title: text.deleteSuccess })
    setDeleteTarget(null)
    await fetchLocations()
  }

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description}>
        <Button onClick={() => openForm()}><Plus className="mr-2 h-4 w-4" />{text.add}</Button>
      </PageHeader>

      <div className="space-y-4 p-4 md:p-8">
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{locations.length} {text.total}</span>
          <span>·</span>
          <span>{georeferencedCount} {text.georeferenced}</span>
        </div>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{text.loading}</div>
            ) : locations.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><MapPin className="h-8 w-8" />{text.empty}</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>{text.name}</TableHead><TableHead>{text.descriptionLabel}</TableHead><TableHead>{text.coordinates}</TableHead><TableHead>{text.status}</TableHead><TableHead className="text-right">{text.actions}</TableHead></TableRow></TableHeader>
                <TableBody>{locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{location.name}</div></TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">{location.description || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{Number.isFinite(location.latitude) && Number.isFinite(location.longitude) ? `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}` : text.noCoordinates}</TableCell>
                    <TableCell><Badge variant={location.is_active ? "default" : "outline"}>{location.is_active ? text.active : text.inactive}</Badge></TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openForm(location)} aria-label={text.editTitle}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setDeleteTarget(location)} aria-label={text.deleteTitle}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{selectedLocation ? text.editTitle : text.addTitle}</DialogTitle><DialogDescription>{text.dialogDescription}</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="location-name">{text.name}</Label><Input id="location-name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required maxLength={120} /></div>
            <div className="space-y-2"><Label htmlFor="location-description">{text.descriptionLabel}</Label><Textarea id="location-description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} rows={3} maxLength={500} /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="location-latitude">{text.latitude}</Label><Input id="location-latitude" type="number" min="-90" max="90" step="any" value={formData.latitude} onChange={(event) => setFormData({ ...formData, latitude: event.target.value })} placeholder="-39.8255" /></div><div className="space-y-2"><Label htmlFor="location-longitude">{text.longitude}</Label><Input id="location-longitude" type="number" min="-180" max="180" step="any" value={formData.longitude} onChange={(event) => setFormData({ ...formData, longitude: event.target.value })} placeholder="-73.2215" /></div></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.is_active} onChange={(event) => setFormData({ ...formData, is_active: event.target.checked })} className="h-4 w-4 rounded border" />{text.active}</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>{text.cancel}</Button><Button type="submit" disabled={saving || !formData.name.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? text.saving : text.save}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{text.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{text.deleteDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{text.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => void handleDelete()}>{text.delete}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
