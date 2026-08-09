"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, DollarSign, Users, Pencil, Trash2, BedDouble, MapPin } from "lucide-react"
import { AddRoomDialog } from "@/components/add-room-dialog"
import { EditRoomDialog } from "@/components/edit-room-dialog"
import { AddBedDialog } from "@/components/add-bed-dialog"
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
import { AppLayout } from "@/components/app-layout"
import { useLanguage } from "@/lib/hooks/use-language"
import { roomsTranslations } from "@/lib/translations/rooms"

interface Room {
  id: string
  room_number: string
  room_type: string
  capacity: number
  rate_per_night: number
  status: string
  location: string
  location_id?: string
  locationName?: string
  amenities: string[]
  notes?: string
  floor?: string
  bed_type?: string
  max_guests?: number
}

interface Bed {
  id: string
  room_id: string
  bed_number: string
  bed_type: string
  is_available: boolean
  notes?: string
}

interface Location { id: string; name: string }

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false)
  const [isEditRoomOpen, setIsEditRoomOpen] = useState(false)
  const [isAddBedOpen, setIsAddBedOpen] = useState(false)
  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null)
  const [selectedRoomForBed, setSelectedRoomForBed] = useState<Room | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: "room" | "bed"; id: string } | null>(null)

  const supabase = createBrowserClient()
  const { language } = useLanguage()
  const copy = roomsTranslations[language]

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: locationsData } = await supabase.from("locations").select("id, name").order("name")
    const { data: roomsData } = await supabase.from("rooms").select("*, locations!inner(name, id)").order("room_number")
    const { data: bedsData } = await supabase.from("beds").select("*").order("bed_number")
    const transformedRooms = (roomsData || []).map((room: any) => ({ ...room, locationName: room.locations?.name || room.location || copy.unknownLocation }))
    setLocations(locationsData || [])
    setRooms(transformedRooms || [])
    setBeds(bedsData || [])
    setLoading(false)
  }

  function getStatusClass(status: string) {
    switch (status) {
      case "available": return "border-primary/30 bg-primary/12 text-primary"
      case "occupied": return "border-sky-400/30 bg-sky-400/10 text-sky-200"
      case "maintenance": return "border-amber-400/30 bg-amber-400/10 text-amber-200"
      case "unavailable": return "border-white/10 bg-white/5 text-muted-foreground"
      default: return "border-white/10 bg-white/5 text-muted-foreground"
    }
  }

  function getStatusLabel(status: string) {
    if (status === "available") return copy.available
    if (status === "occupied") return copy.occupied
    if (status === "maintenance") return copy.maintenance
    if (status === "unavailable") return copy.unavailable
    return status
  }

  function getRoomTypeLabel(type: string) {
    const key = type?.toLowerCase()
    if (key === "dorm") return copy.roomTypeDorm
    if (key === "private") return copy.roomTypePrivate
    if (key === "office") return copy.roomTypeOffice
    return type
  }

  function getBedTypeLabel(type: string) {
    const key = type?.toLowerCase()
    if (key === "single") return copy.bedTypeSingle
    if (key === "double") return copy.bedTypeDouble
    if (key === "queen") return copy.bedTypeQueen
    return type
  }

  async function handleDeleteRoom(roomId: string) {
    const roomBeds = beds.filter((bed) => bed.room_id === roomId)
    if (roomBeds.length > 0) { alert(copy.roomHasBeds); return }
    const { error } = await supabase.from("rooms").delete().eq("id", roomId)
    if (!error) setRooms(rooms.filter((r) => r.id !== roomId))
    setDeleteDialogOpen(false)
  }

  async function handleDeleteBed(bedId: string) {
    const { error } = await supabase.from("beds").delete().eq("id", bedId)
    if (!error) setBeds(beds.filter((b) => b.id !== bedId))
    setDeleteDialogOpen(false)
  }

  function confirmDelete(type: "room" | "bed", id: string) {
    setItemToDelete({ type, id })
    setDeleteDialogOpen(true)
  }

  return (
    <AppLayout>
      <div className="flex h-full flex-col bg-background">
        <div className="flex flex-col gap-4 border-b border-white/10 bg-card px-6 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-primary">BFCS · Hospitality</p>
            <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
          </div>
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setIsAddRoomOpen(true)}>
            <Plus className="h-4 w-4" />{copy.addRoom}
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center p-8"><div className="text-muted-foreground">{copy.loading}</div></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rooms.map((room) => {
                const roomBeds = beds.filter((bed) => bed.room_id === room.id)
                const capacity = room.capacity || room.max_guests || 2
                return (
                  <Card key={room.id} className="border border-white/10 bg-card transition-colors hover:border-primary/30 hover:bg-card/95">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
                              <BedDouble className="h-4 w-4" />
                            </span>
                            <CardTitle className="truncate text-base font-medium text-foreground">{room.room_number}</CardTitle>
                          </div>
                          {room.locationName && (
                            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />{room.locationName}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-white/5 hover:text-foreground" onClick={() => { setRoomToEdit(room); setIsEditRoomOpen(true) }} aria-label={copy.addRoom}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => confirmDelete("room", room.id)} aria-label={copy.delete}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{getRoomTypeLabel(room.room_type)}</span>
                        <Badge variant="outline" className={getStatusClass(room.status)}>{getStatusLabel(room.status)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-foreground"><Users className="h-4 w-4 text-muted-foreground" /><span>{copy.guestsUpTo.replace("{count}", String(capacity))}</span></div>
                        <div className="flex items-center justify-end gap-1 text-foreground"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{room.rate_per_night}</span><span className="text-muted-foreground">{copy.perNight}</span></div>
                      </div>

                      {room.amenities && room.amenities.length > 0 && (
                        <div className="border-t border-white/10 pt-3">
                          <div className="flex flex-wrap gap-1">
                            {room.amenities.slice(0, 3).map((amenity, idx) => <Badge key={idx} variant="secondary" className="border border-white/10 bg-secondary text-xs text-foreground">{amenity}</Badge>)}
                            {room.amenities.length > 3 && <Badge variant="secondary" className="border border-white/10 bg-secondary text-xs text-muted-foreground">+{room.amenities.length - 3}</Badge>}
                          </div>
                        </div>
                      )}

                      <div className="border-t border-white/10 pt-3">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{copy.beds} ({roomBeds.length})</span>
                          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-primary hover:bg-primary/10" onClick={() => { setSelectedRoomForBed(room); setIsAddBedOpen(true) }}>
                            <Plus className="h-3 w-3" />{copy.addBed}
                          </Button>
                        </div>
                        {roomBeds.length > 0 ? (
                          <div className="space-y-1.5">
                            {roomBeds.map((bed) => (
                              <div key={bed.id} className="flex items-center justify-between border border-white/8 bg-background/35 px-2 py-2 text-xs text-foreground">
                                <div className="flex items-center gap-2">
                                  <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-medium">{bed.bed_number}</span>
                                  <span className="text-muted-foreground">({getBedTypeLabel(bed.bed_type)})</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => confirmDelete("bed", bed.id)} aria-label={copy.delete}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-muted-foreground">{copy.noBeds}</p>}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <AddRoomDialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen} onSuccess={loadData} />
        {roomToEdit && <EditRoomDialog open={isEditRoomOpen} onOpenChange={setIsEditRoomOpen} room={roomToEdit} onSuccess={loadData} />}
        {selectedRoomForBed && <AddBedDialog open={isAddBedOpen} onOpenChange={setIsAddBedOpen} room={selectedRoomForBed} onSuccess={loadData} />}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{itemToDelete?.type === "bed" ? copy.deleteBed : copy.deleteRoom}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>{copy.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => { if (itemToDelete) { if (itemToDelete.type === "room") handleDeleteRoom(itemToDelete.id); else handleDeleteBed(itemToDelete.id) } }}>{copy.delete}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}
