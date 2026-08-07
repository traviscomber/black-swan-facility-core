"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, DollarSign, Users, Pencil, Trash2, BedDouble } from "lucide-react"
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
  const [locations, setLocations] = useState<Location[]>([])
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

  function getFacilityColor(locationId?: string) {
    if (!locationId) return FACILITY_COLORS[0]
    const index = locations.findIndex((loc) => loc.id === locationId)
    return FACILITY_COLORS[Math.max(0, index) % FACILITY_COLORS.length]
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "available": return "bg-green-500"
      case "occupied": return "bg-blue-500"
      case "maintenance": return "bg-yellow-500"
      case "unavailable": return "bg-gray-500"
      default: return "bg-gray-500"
    }
  }

  function getStatusLabel(status: string) {
    if (status === "available") return copy.available
    if (status === "occupied") return copy.occupied
    if (status === "maintenance") return copy.maintenance
    if (status === "unavailable") return copy.unavailable
    return status
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
        <div className="flex items-center justify-between border-b bg-card px-6 py-4">
          <div><h1 className="text-2xl font-bold">{copy.title}</h1><p className="text-sm text-muted-foreground">{copy.description}</p></div>
          <Button className="gap-2" onClick={() => setIsAddRoomOpen(true)}><Plus className="h-4 w-4" />{copy.addRoom}</Button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center p-8"><div className="text-muted-foreground">{copy.loading}</div></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rooms.map((room) => {
                const roomBeds = beds.filter((bed) => bed.room_id === room.id)
                const facilityColor = getFacilityColor(room.location_id)
                const capacity = room.capacity || room.max_guests || 2
                return (
                  <Card key={room.id} className={`${facilityColor.bg} ${facilityColor.border}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col"><CardTitle className={`${facilityColor.text} text-lg`}>{room.room_number}</CardTitle>{room.locationName && <p className={`${facilityColor.text}/80 mt-1 text-sm font-medium`}>{room.locationName}</p>}</div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className={`h-7 w-7 ${facilityColor.text} hover:bg-black/10`} onClick={() => { setRoomToEdit(room); setIsEditRoomOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className={`h-7 w-7 ${facilityColor.text} hover:bg-black/10`} onClick={() => confirmDelete("room", room.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-sm"><p className={`${facilityColor.text}/80`}>{room.room_type}</p><Badge className={getStatusColor(room.status)} variant="secondary">{getStatusLabel(room.status)}</Badge></div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className={`flex items-center gap-2 text-sm ${facilityColor.text}/90`}><Users className={`h-4 w-4 ${facilityColor.text}/60`} /><span>{copy.guestsUpTo.replace("{count}", String(capacity))}</span></div>
                      <div className={`flex items-center gap-2 text-sm ${facilityColor.text}/90`}><DollarSign className={`h-4 w-4 ${facilityColor.text}/60`} /><span className="font-semibold">${room.rate_per_night}</span><span className={`${facilityColor.text}/70`}>{copy.perNight}</span></div>

                      {room.amenities && room.amenities.length > 0 && (
                        <div className="border-t pt-3"><div className="flex flex-wrap gap-1">{room.amenities.slice(0, 3).map((amenity, idx) => <Badge key={idx} variant="secondary" className={`bg-black/10 text-xs ${facilityColor.text}`}>{amenity}</Badge>)}{room.amenities.length > 3 && <Badge variant="secondary" className={`bg-black/10 text-xs ${facilityColor.text}`}>+{room.amenities.length - 3}</Badge>}</div></div>
                      )}

                      <div className="border-t pt-3">
                        <div className="mb-2 flex items-center justify-between text-sm"><span className={`font-medium ${facilityColor.text}`}>{copy.beds} ({roomBeds.length})</span><Button variant="ghost" size="sm" className={`h-7 gap-1.5 px-2 ${facilityColor.text} hover:bg-black/10`} onClick={() => { setSelectedRoomForBed(room); setIsAddBedOpen(true) }}><Plus className="h-3 w-3" />{copy.addBed}</Button></div>
                        {roomBeds.length > 0 ? <div className="space-y-1.5">{roomBeds.map((bed) => <div key={bed.id} className={`flex items-center justify-between rounded-md bg-black/10 px-2 py-1.5 text-xs ${facilityColor.text}/90`}><div className="flex items-center gap-2"><BedDouble className={`h-3 w-3 ${facilityColor.text}/60`} /><span className="font-medium">{bed.bed_number}</span><span className={`${facilityColor.text}/70`}>({bed.bed_type})</span></div><Button variant="ghost" size="icon" className={`h-5 w-5 ${facilityColor.text} hover:bg-black/10`} onClick={() => confirmDelete("bed", bed.id)}><Trash2 className="h-3 w-3" /></Button></div>)}</div> : <p className={`text-xs ${facilityColor.text}/60`}>{copy.noBeds}</p>}
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
