"use client"

import type React from "react"
import { useToast } from "@/components/ui/use-toast"
import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/lib/hooks/use-language"
import { facilitiesTranslations } from "@/lib/translations/facilities"

interface Location { id: string; name: string; description: string | null; latitude: number | null; longitude: number | null; is_active: boolean; created_at: string }

export default function LocationsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [locations, setLocations] = useState<Location[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()
  const { language } = useLanguage()
  const copy = facilitiesTranslations[language]
  const localize = (href: string) => `/${language}${href}`

  useEffect(() => { void loadLocations() }, [])

  async function loadLocations() {
    const { data, error } = await supabase.from("locations").select("*").order("name")
    if (error) toast({ variant: "destructive", title: copy.error, description: copy.loadError })
    else setLocations(data || [])
  }

  async function handleAddLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const formData = new FormData(e.currentTarget)
    const { error } = await supabase.from("locations").insert({ name: formData.get("name") as string, description: formData.get("description") as string, latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null, longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null, is_active: true })
    if (error) toast({ variant: "destructive", title: copy.error, description: copy.addError })
    else { toast({ title: copy.success, description: copy.addSuccess }); setIsAddDialogOpen(false); void loadLocations() }
  }

  async function handleEditLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!editingLocation) return
    const formData = new FormData(e.currentTarget)
    const { error } = await supabase.from("locations").update({ name: formData.get("name") as string, description: formData.get("description") as string, latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null, longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null }).eq("id", editingLocation.id)
    if (error) toast({ variant: "destructive", title: copy.error, description: copy.updateError })
    else { toast({ title: copy.success, description: copy.updateSuccess }); setIsEditDialogOpen(false); setEditingLocation(null); void loadLocations() }
  }

  async function handleDeleteLocation(id: string) {
    if (!confirm(copy.deleteConfirm)) return
    const { error } = await supabase.from("locations").delete().eq("id", id)
    if (error) toast({ variant: "destructive", title: copy.error, description: copy.deleteError })
    else { toast({ title: copy.success, description: copy.deleteSuccess }); void loadLocations() }
  }

  async function toggleActive(location: Location) {
    const { error } = await supabase.from("locations").update({ is_active: !location.is_active }).eq("id", location.id)
    if (error) toast({ variant: "destructive", title: copy.error, description: copy.statusError })
    else void loadLocations()
  }

  const filteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return locations.filter((loc) => !q || loc.name.toLowerCase().includes(q) || loc.description?.toLowerCase().includes(q))
  }, [locations, searchQuery])

  return <div className="min-h-screen bg-[#111213] text-foreground">
    <header className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#17191a] px-4 py-2">
      <div><h1 className="text-base font-medium">{copy.title}</h1><p className="text-xs text-muted-foreground">{copy.description}</p></div>
      <Button size="sm" onClick={() => setIsAddDialogOpen(true)}><Plus className="mr-2 h-3.5 w-3.5" />{copy.addLocation}</Button>
    </header>

    <div className="border-b border-white/10 bg-[#151718] p-2"><div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input placeholder={copy.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-9" /></div></div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-xs">
        <thead className="border-b border-white/10 bg-[#151718] text-left text-muted-foreground"><tr><th className="px-3 py-2 font-medium">{copy.locationName}</th><th className="px-3 py-2 font-medium">{copy.descriptionLabel}</th><th className="px-3 py-2 font-medium">{copy.coordinates}</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 text-right font-medium">Actions</th></tr></thead>
        <tbody>{filteredLocations.map((location) => <tr key={location.id} className="border-b border-white/5 hover:bg-white/[.025]"><td className="px-3 py-2 font-medium">{location.name}</td><td className="max-w-md truncate px-3 py-2 text-muted-foreground">{location.description || copy.noDescription}</td><td className="px-3 py-2 text-muted-foreground">{location.latitude != null && location.longitude != null ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : "—"}</td><td className="px-3 py-2"><button type="button" onClick={() => void toggleActive(location)} className={location.is_active ? "inline-flex items-center gap-2 text-emerald-300" : "inline-flex items-center gap-2 text-muted-foreground"}><span className={location.is_active ? "h-1.5 w-1.5 bg-emerald-400" : "h-1.5 w-1.5 bg-muted-foreground"} />{location.is_active ? copy.active : copy.inactive}</button></td><td className="px-3 py-2"><div className="flex justify-end gap-1"><Button asChild size="icon" variant="ghost" className="h-7 w-7"><Link href={localize(`/bookings/locations/${location.id}`)} aria-label={copy.manageRoomsBeds}><Eye className="h-3.5 w-3.5" /></Link></Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingLocation(location); setIsEditDialogOpen(true) }} aria-label={copy.editLocation}><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void handleDeleteLocation(location.id)} aria-label={copy.deleteConfirm}><Trash2 className="h-3.5 w-3.5" /></Button></div></td></tr>)}{filteredLocations.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">{copy.noDescription}</td></tr>}</tbody>
      </table>
    </div>

    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}><DialogContent><form onSubmit={handleAddLocation}><DialogHeader><DialogTitle>{copy.addNewLocation}</DialogTitle><DialogDescription>{copy.addNewLocationDesc}</DialogDescription></DialogHeader><div className="space-y-4 py-4"><Field label={`${copy.locationName} *`}><Input name="name" required /></Field><Field label={copy.descriptionLabel}><Textarea name="description" rows={3} /></Field><div className="grid grid-cols-2 gap-4"><Field label={copy.latitudeLabel}><Input name="latitude" type="number" step="0.00001" /></Field><Field label={copy.longitudeLabel}><Input name="longitude" type="number" step="0.00001" /></Field></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>{copy.cancel}</Button><Button type="submit">{copy.addLocationBtn}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}><DialogContent><form onSubmit={handleEditLocation}><DialogHeader><DialogTitle>{copy.editLocation}</DialogTitle><DialogDescription>{copy.editLocationDesc}</DialogDescription></DialogHeader><div className="space-y-4 py-4"><Field label={`${copy.locationName} *`}><Input name="name" defaultValue={editingLocation?.name} required /></Field><Field label={copy.descriptionLabel}><Textarea name="description" defaultValue={editingLocation?.description || ""} rows={3} /></Field><div className="grid grid-cols-2 gap-4"><Field label={copy.latitudeLabel}><Input name="latitude" type="number" step="0.00001" defaultValue={editingLocation?.latitude ?? ""} /></Field><Field label={copy.longitudeLabel}><Input name="longitude" type="number" step="0.00001" defaultValue={editingLocation?.longitude ?? ""} /></Field></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>{copy.cancel}</Button><Button type="submit">{copy.saveChanges}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
