"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BedIcon, Home, Pencil, Plus, Trash2 } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface Location {
  id: string
  name: string
  description: string | null
}

interface Room {
  id: string
  room_number: string
  room_type: string
  capacity: number
  rate_per_night: number
  status: string
  floor: string | null
  amenities: string[] | null
  notes: string | null
}

interface Bed {
  id: string
  bed_number: string
  bed_type: string
  room_id: string
  is_available: boolean
  notes: string | null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error"
}

function parseAmenities(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function LocationDetailPage() {
  const params = useParams<{ id: string }>()
  const locationId = params.id
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()

  const [location, setLocation] = useState<Location | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [loading, setLoading] = useState(true)

  const [isAddRoomDialogOpen, setIsAddRoomDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [selectedRoomForBed, setSelectedRoomForBed] = useState<string | null>(null)
  const [editingBed, setEditingBed] = useState<Bed | null>(null)

  const loadLocationData = useCallback(async () => {
    setLoading(true)
    const [locationResult, roomsResult] = await Promise.all([
      supabase.from("locations").select("id,name,description").eq("id", locationId).single(),
      supabase.from("rooms").select("id,room_number,room_type,capacity,rate_per_night,status,floor,amenities,notes").eq("location_id", locationId).order("room_number"),
    ])

    if (locationResult.error) {
      toast({ variant: "destructive", title: "No fue posible cargar la instalación", description: locationResult.error.message })
      setLocation(null)
      setRooms([])
      setBeds([])
      setLoading(false)
      return
    }

    setLocation(locationResult.data)
    if (roomsResult.error) {
      toast({ variant: "destructive", title: "No fue posible cargar las habitaciones", description: roomsResult.error.message })
      setRooms([])
      setBeds([])
      setLoading(false)
      return
    }

    const nextRooms = roomsResult.data ?? []
    setRooms(nextRooms)
    if (nextRooms.length === 0) {
      setBeds([])
      setLoading(false)
      return
    }

    const { data: bedData, error: bedError } = await supabase
      .from("beds")
      .select("id,bed_number,bed_type,room_id,is_available,notes")
      .in("room_id", nextRooms.map((room) => room.id))
      .order("bed_number")

    if (bedError) {
      toast({ variant: "destructive", title: "No fue posible cargar las camas", description: bedError.message })
      setBeds([])
    } else {
      setBeds(bedData ?? [])
    }
    setLoading(false)
  }, [locationId, supabase, toast])

  useEffect(() => { void loadLocationData() }, [loadLocationData])

  async function handleAddRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const roomNumber = String(formData.get("room_number") ?? "").trim()
    const roomType = String(formData.get("room_type") ?? "").trim()
    if (!roomNumber || !roomType) return

    try {
      const { data: existingRoom, error: checkError } = await supabase
        .from("rooms")
        .select("id")
        .eq("location_id", locationId)
        .eq("room_number", roomNumber)
        .maybeSingle()
      if (checkError) throw checkError
      if (existingRoom) {
        toast({ variant: "destructive", title: "Habitación duplicada", description: "Ya existe una habitación con ese número o nombre en esta instalación." })
        return
      }

      const { error } = await supabase.from("rooms").insert({
        location_id: locationId,
        room_number: roomNumber,
        room_type: roomType,
        capacity: Number(formData.get("capacity") ?? 1),
        rate_per_night: Number(formData.get("rate_per_night") ?? 0),
        status: String(formData.get("status") ?? "available"),
        floor: String(formData.get("floor") ?? "").trim() || null,
        amenities: parseAmenities(formData.get("amenities")),
        notes: String(formData.get("notes") ?? "").trim() || null,
      })
      if (error) throw error
      setIsAddRoomDialogOpen(false)
      toast({ title: "Habitación creada", description: `${roomNumber} quedó registrada en ${location?.name ?? "la instalación"}.` })
      await loadLocationData()
    } catch (error) {
      toast({ variant: "destructive", title: "No fue posible crear la habitación", description: errorMessage(error) })
    }
  }

  async function handleEditRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingRoom) return
    const formData = new FormData(event.currentTarget)
    const roomNumber = String(formData.get("room_number") ?? "").trim()

    const { data: duplicate, error: duplicateError } = await supabase
      .from("rooms")
      .select("id")
      .eq("location_id", locationId)
      .eq("room_number", roomNumber)
      .neq("id", editingRoom.id)
      .maybeSingle()
    if (duplicateError) {
      toast({ variant: "destructive", title: "No fue posible validar la habitación", description: duplicateError.message })
      return
    }
    if (duplicate) {
      toast({ variant: "destructive", title: "Habitación duplicada", description: "Ya existe una habitación con ese número o nombre en esta instalación." })
      return
    }

    const { error } = await supabase
      .from("rooms")
      .update({
        room_number: roomNumber,
        room_type: String(formData.get("room_type") ?? ""),
        capacity: Number(formData.get("capacity") ?? 1),
        rate_per_night: Number(formData.get("rate_per_night") ?? 0),
        status: String(formData.get("status") ?? "available"),
        floor: String(formData.get("floor") ?? "").trim() || null,
        amenities: parseAmenities(formData.get("amenities")),
        notes: String(formData.get("notes") ?? "").trim() || null,
      })
      .eq("id", editingRoom.id)

    if (error) {
      toast({ variant: "destructive", title: "No fue posible actualizar la habitación", description: error.message })
      return
    }
    setEditingRoom(null)
    toast({ title: "Habitación actualizada" })
    await loadLocationData()
  }

  async function handleDeleteRoom(room: Room) {
    if (beds.some((bed) => bed.room_id === room.id)) {
      toast({ variant: "destructive", title: "No se puede eliminar", description: "La habitación todavía contiene camas. Retíralas primero." })
      return
    }
    if (!window.confirm(`¿Eliminar ${room.room_number}?`)) return
    const { error } = await supabase.from("rooms").delete().eq("id", room.id)
    if (error) {
      toast({ variant: "destructive", title: "No fue posible eliminar la habitación", description: error.message })
      return
    }
    await loadLocationData()
  }

  async function handleAddBed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRoomForBed) return
    const formData = new FormData(event.currentTarget)
    const bedNumber = String(formData.get("bed_number") ?? "").trim()
    const bedType = String(formData.get("bed_type") ?? "").trim()
    if (!bedNumber || !bedType) return

    const { data: duplicate, error: duplicateError } = await supabase.from("beds").select("id").eq("room_id", selectedRoomForBed).eq("bed_number", bedNumber).maybeSingle()
    if (duplicateError) {
      toast({ variant: "destructive", title: "No fue posible validar la cama", description: duplicateError.message })
      return
    }
    if (duplicate) {
      toast({ variant: "destructive", title: "Cama duplicada", description: "Ya existe una cama con ese nombre o número en la habitación." })
      return
    }

    const { error } = await supabase.from("beds").insert({ room_id: selectedRoomForBed, bed_number: bedNumber, bed_type: bedType, is_available: true, notes: String(formData.get("notes") ?? "").trim() || null })
    if (error) {
      toast({ variant: "destructive", title: "No fue posible agregar la cama", description: error.message })
      return
    }
    setSelectedRoomForBed(null)
    toast({ title: "Cama agregada" })
    await loadLocationData()
  }

  async function handleEditBed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingBed) return
    const formData = new FormData(event.currentTarget)
    const bedNumber = String(formData.get("bed_number") ?? "").trim()
    const { data: duplicate, error: duplicateError } = await supabase.from("beds").select("id").eq("room_id", editingBed.room_id).eq("bed_number", bedNumber).neq("id", editingBed.id).maybeSingle()
    if (duplicateError) {
      toast({ variant: "destructive", title: "No fue posible validar la cama", description: duplicateError.message })
      return
    }
    if (duplicate) {
      toast({ variant: "destructive", title: "Cama duplicada", description: "Ya existe una cama con ese nombre o número en la habitación." })
      return
    }

    const { error } = await supabase.from("beds").update({ bed_number: bedNumber, bed_type: String(formData.get("bed_type") ?? ""), notes: String(formData.get("notes") ?? "").trim() || null }).eq("id", editingBed.id)
    if (error) {
      toast({ variant: "destructive", title: "No fue posible actualizar la cama", description: error.message })
      return
    }
    setEditingBed(null)
    toast({ title: "Cama actualizada" })
    await loadLocationData()
  }

  async function handleDeleteBed(bed: Bed) {
    if (!window.confirm(`¿Eliminar ${bed.bed_number}?`)) return
    const { error } = await supabase.from("beds").delete().eq("id", bed.id)
    if (error) {
      toast({ variant: "destructive", title: "No fue posible eliminar la cama", description: error.message })
      return
    }
    await loadLocationData()
  }

  if (loading) return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Cargando instalación…</div>
  if (!location) return <div className="space-y-4 p-6 text-center"><p>No se encontró la instalación.</p><Button variant="outline" asChild><Link href="/bookings/locations">Volver a instalaciones</Link></Button></div>

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" asChild><Link href="/bookings/locations"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div><h1 className="text-2xl font-bold sm:text-3xl">{location.name}</h1><p className="mt-1 text-muted-foreground">{location.description || "Habitaciones y camas disponibles en esta instalación."}</p></div>
          </div>
          <Button onClick={() => setIsAddRoomDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Agregar habitación</Button>
        </div>

        {rooms.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12"><Home className="mb-4 h-10 w-10 text-muted-foreground" /><h3 className="font-semibold">Sin habitaciones</h3><p className="mb-4 mt-1 text-sm text-muted-foreground">Registra la primera unidad alojable de esta instalación.</p><Button onClick={() => setIsAddRoomDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Agregar habitación</Button></CardContent></Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => {
              const roomBeds = beds.filter((bed) => bed.room_id === room.id)
              return (
                <Card key={room.id}>
                  <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-primary" />{room.room_number}</CardTitle><CardDescription>{room.room_type} · capacidad {room.capacity}</CardDescription></div><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => setEditingRoom(room)} aria-label={`Editar ${room.room_number}`}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => void handleDeleteRoom(room)} aria-label={`Eliminar ${room.room_number}`}><Trash2 className="h-4 w-4" /></Button></div></div></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm"><Info label="Tarifa" value={new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(room.rate_per_night)} /><Info label="Estado" value={room.status} /><Info label="Piso" value={room.floor || "No registrado"} /><Info label="Camas" value={String(roomBeds.length)} /></div>
                    {room.amenities?.length ? <p className="text-xs text-muted-foreground">{room.amenities.join(" · ")}</p> : null}
                    <div className="border-t pt-4"><div className="mb-3 flex items-center justify-between"><h4 className="flex items-center gap-2 font-semibold"><BedIcon className="h-4 w-4" />Camas</h4><Button size="sm" variant="outline" onClick={() => setSelectedRoomForBed(room.id)}><Plus className="h-3.5 w-3.5" /></Button></div>{roomBeds.length === 0 ? <p className="py-2 text-center text-sm text-muted-foreground">Sin camas registradas.</p> : <div className="space-y-2">{roomBeds.map((bed) => <div key={bed.id} className="flex items-center justify-between rounded-md bg-muted/40 p-2"><div><p className="text-sm font-medium">{bed.bed_number}</p><p className="text-xs text-muted-foreground">{bed.bed_type}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingBed(bed)}><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void handleDeleteBed(bed)}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>)}</div>}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <RoomDialog open={isAddRoomDialogOpen} onOpenChange={setIsAddRoomDialogOpen} title={`Agregar habitación a ${location.name}`} onSubmit={handleAddRoom} />
      <RoomDialog open={Boolean(editingRoom)} onOpenChange={(open) => !open && setEditingRoom(null)} title="Editar habitación" room={editingRoom} onSubmit={handleEditRoom} />
      <BedDialog open={Boolean(selectedRoomForBed)} onOpenChange={(open) => !open && setSelectedRoomForBed(null)} title="Agregar cama" onSubmit={handleAddBed} />
      <BedDialog open={Boolean(editingBed)} onOpenChange={(open) => !open && setEditingBed(null)} title="Editar cama" bed={editingBed} onSubmit={handleEditBed} />
    </div>
  )
}

function RoomDialog({ open, onOpenChange, title, room, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; room?: Room | null; onSubmit: React.FormEventHandler<HTMLFormElement> }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl"><form onSubmit={onSubmit}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Define capacidad, tarifa, estado y atributos operativos.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Número o nombre"><Input name="room_number" defaultValue={room?.room_number ?? ""} required /></Field><Field label="Tipo"><Select name="room_type" defaultValue={room?.room_type ?? "suite"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="suite">Suite</SelectItem><SelectItem value="cabin">Cabin</SelectItem><SelectItem value="bungalow">Bungalow</SelectItem><SelectItem value="dorm">Dorm</SelectItem><SelectItem value="studio">Studio</SelectItem></SelectContent></Select></Field></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Capacidad"><Input name="capacity" type="number" min="1" defaultValue={room?.capacity ?? 2} required /></Field><Field label="Tarifa/noche"><Input name="rate_per_night" type="number" min="0" step="1" defaultValue={room?.rate_per_night ?? 0} required /></Field><Field label="Piso"><Input name="floor" defaultValue={room?.floor ?? ""} /></Field></div><Field label="Estado"><Select name="status" defaultValue={room?.status ?? "available"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="occupied">Occupied</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></Field><Field label="Amenities"><Input name="amenities" defaultValue={room?.amenities?.join(", ") ?? ""} placeholder="WiFi, baño privado, cocina" /></Field><Field label="Notas"><Textarea name="notes" defaultValue={room?.notes ?? ""} rows={2} /></Field></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter></form></DialogContent></Dialog>
}

function BedDialog({ open, onOpenChange, title, bed, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; bed?: Bed | null; onSubmit: React.FormEventHandler<HTMLFormElement> }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><form onSubmit={onSubmit}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Identifica la cama dentro de la habitación.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><Field label="Nombre o número"><Input name="bed_number" defaultValue={bed?.bed_number ?? ""} required /></Field><Field label="Tipo"><Select name="bed_type" defaultValue={bed?.bed_type ?? "Single"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Single">Single</SelectItem><SelectItem value="Double">Double</SelectItem><SelectItem value="Queen">Queen</SelectItem><SelectItem value="King">King</SelectItem><SelectItem value="Bunk_top">Bunk (Top)</SelectItem><SelectItem value="Bunk_bottom">Bunk (Bottom)</SelectItem></SelectContent></Select></Field><Field label="Notas"><Textarea name="notes" defaultValue={bed?.notes ?? ""} rows={2} /></Field></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter></form></DialogContent></Dialog>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div> }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div> }
