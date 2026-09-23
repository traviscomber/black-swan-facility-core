"use client"

import Link from "next/link"
import { useMemo, useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Pencil, Trash2, BedDouble, Search } from "lucide-react"
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
interface Bed { id: string; room_id: string; bed_number: string; bed_type: string; is_available: boolean; notes?: string }
interface Location { id: string; name: string }

export default function RoomsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const copy = roomsTranslations[language]
  const [rooms, setRooms] = useState<Room[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [propertyFilter, setPropertyFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false)
  const [isEditRoomOpen, setIsEditRoomOpen] = useState(false)
  const [isAddBedOpen, setIsAddBedOpen] = useState(false)
  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null)
  const [selectedRoomForBed, setSelectedRoomForBed] = useState<Room | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: "room" | "bed"; id: string } | null>(null)

  useEffect(() => { void loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [locationsResult, roomsResult, bedsResult] = await Promise.all([
      supabase.from("locations").select("id, name").order("name"),
      supabase.from("rooms").select("*, locations!inner(name, id)").order("room_number"),
      supabase.from("beds").select("*").order("bed_number"),
    ])
    const transformedRooms = (roomsResult.data || []).map((room: any) => ({ ...room, locationName: room.locations?.name || room.location || copy.unknownLocation }))
    setLocations(locationsResult.data || [])
    setRooms(transformedRooms)
    setBeds(bedsResult.data || [])
    setLoading(false)
  }

  const properties = useMemo(() => Array.from(new Set(rooms.map((room) => room.locationName).filter(Boolean) as string[])).sort(), [rooms])
  const visibleRooms = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rooms.filter((room) => {
      if (propertyFilter !== "all" && room.locationName !== propertyFilter) return false
      if (statusFilter !== "all" && room.status !== statusFilter) return false
      return !term || `${room.room_number} ${room.locationName ?? ""} ${room.room_type ?? ""} ${room.status ?? ""}`.toLowerCase().includes(term)
    })
  }, [propertyFilter, rooms, search, statusFilter])
  const activeBeds = useMemo(() => beds.filter((bed) => bed.is_available).length, [beds])

  function statusLabel(status: string) {
    if (status === "available") return copy.available
    if (status === "occupied") return copy.occupied
    if (status === "maintenance") return copy.maintenance
    if (status === "unavailable") return copy.unavailable
    return status
  }
  function statusClass(status: string) {
    if (status === "available") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    if (status === "occupied") return "border-sky-500/30 bg-sky-500/10 text-sky-300"
    if (status === "maintenance") return "border-amber-500/30 bg-amber-500/10 text-amber-300"
    return "border-white/10 bg-white/5 text-muted-foreground"
  }
  function roomTypeLabel(type: string) {
    const key = type?.toLowerCase()
    if (key === "dorm") return copy.roomTypeDorm
    if (key === "private") return copy.roomTypePrivate
    if (key === "office") return copy.roomTypeOffice
    return type
  }

  async function handleDeleteRoom(roomId: string) {
    if (beds.some((bed) => bed.room_id === roomId)) { alert(copy.roomHasBeds); return }
    const { error } = await supabase.from("rooms").delete().eq("id", roomId)
    if (!error) setRooms((current) => current.filter((room) => room.id !== roomId))
    setDeleteDialogOpen(false)
  }
  async function handleDeleteBed(bedId: string) {
    const { error } = await supabase.from("beds").delete().eq("id", bedId)
    if (!error) setBeds((current) => current.filter((bed) => bed.id !== bedId))
    setDeleteDialogOpen(false)
  }
  function confirmDelete(type: "room" | "bed", id: string) { setItemToDelete({ type, id }); setDeleteDialogOpen(true) }

  return <div className="min-h-screen bg-[#111213] text-foreground">
    <header className="flex min-h-[58px] flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
      <div><h1 className="text-[15px] font-medium tracking-tight">{copy.title}</h1><p className="text-[11px] text-muted-foreground">{copy.description} · {rooms.length} {copy.title.toLowerCase()} · {activeBeds} {copy.activeBeds}</p></div>
      <Button className="h-8 rounded-[5px] bg-emerald-600 px-3 text-xs hover:bg-emerald-500" onClick={() => setIsAddRoomOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />{copy.addRoom}</Button>
    </header>

    <div className="flex min-h-[40px] flex-wrap items-center gap-2 border-b border-white/10 bg-[#151718] px-4 py-1 md:px-5">
      <div className="relative min-w-[240px] flex-1"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.searchPlaceholder} className="h-8 rounded-none border-white/10 bg-[#111314] pl-8 text-xs" /></div>
      <Select value={propertyFilter} onValueChange={setPropertyFilter}><SelectTrigger className="h-8 w-48 rounded-none border-white/10 bg-[#111314] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.allProperties}</SelectItem>{properties.map((property) => <SelectItem key={property} value={property}>{property}</SelectItem>)}</SelectContent></Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-8 w-40 rounded-none border-white/10 bg-[#111314] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.allStatuses}</SelectItem><SelectItem value="available">{copy.available}</SelectItem><SelectItem value="occupied">{copy.occupied}</SelectItem><SelectItem value="maintenance">{copy.maintenance}</SelectItem><SelectItem value="unavailable">{copy.unavailable}</SelectItem></SelectContent></Select>
      <span className="text-xs tabular-nums text-muted-foreground">{visibleRooms.length}/{rooms.length}</span>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-xs">
        <thead className="bg-[#17191a] text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr>
          <th className="px-3 py-2">{copy.title}</th><th className="px-3 py-2">{copy.property}</th><th className="px-3 py-2">{copy.type}</th><th className="px-3 py-2">{copy.capacity}</th><th className="px-3 py-2">{copy.beds}</th><th className="px-3 py-2">{copy.rate}</th><th className="px-3 py-2">{copy.status}</th><th className="px-3 py-2 text-right">{copy.actions}</th>
        </tr></thead>
        <tbody className="divide-y divide-white/[0.06]">
          {loading ? <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">{copy.loading}</td></tr> : visibleRooms.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">{copy.noRooms}</td></tr> : visibleRooms.map((room) => {
            const roomBeds = beds.filter((bed) => bed.room_id === room.id)
            const capacity = room.capacity || room.max_guests || 2
            return <tr key={room.id} className="bg-[#111213] hover:bg-white/[0.025]">
              <td className="px-3 py-2"><Link href={`/${language}/bookings/rooms/${room.id}`} aria-label={`${copy.title} ${room.room_number}`} className="inline-flex items-center gap-2 rounded-[2px] font-medium outline-none hover:text-emerald-300 focus-visible:ring-1 focus-visible:ring-emerald-400"><BedDouble className="h-3.5 w-3.5 text-muted-foreground" />{room.room_number}</Link></td>
              <td className="px-4 py-2.5 text-muted-foreground">{room.locationName ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{roomTypeLabel(room.room_type)}</td>
              <td className="px-4 py-2.5">{capacity}</td>
              <td className="px-4 py-2.5"><div className="flex items-center gap-1.5"><span>{roomBeds.length}</span><Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-emerald-300" onClick={() => { setSelectedRoomForBed(room); setIsAddBedOpen(true) }}><Plus className="mr-1 h-3 w-3" />{copy.addBed}</Button></div></td>
              <td className="px-4 py-2.5">{Number(room.rate_per_night || 0).toLocaleString("es-CL")}</td>
              <td className="px-4 py-2.5"><Badge variant="outline" className={`h-5 rounded-[3px] px-1.5 text-[10px] ${statusClass(room.status)}`}>{statusLabel(room.status)}</Badge></td>
              <td className="px-4 py-2.5"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setRoomToEdit(room); setIsEditRoomOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => confirmDelete("room", room.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></td>
            </tr>
          })}
        </tbody>
      </table>
    </div>

    <AddRoomDialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen} onSuccess={loadData} />
    {roomToEdit && <EditRoomDialog open={isEditRoomOpen} onOpenChange={setIsEditRoomOpen} room={roomToEdit} onSuccess={loadData} />}
    {selectedRoomForBed && <AddBedDialog open={isAddBedOpen} onOpenChange={setIsAddBedOpen} room={selectedRoomForBed} onSuccess={loadData} />}
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{itemToDelete?.type === "bed" ? copy.deleteBed : copy.deleteRoom}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{copy.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => { if (!itemToDelete) return; if (itemToDelete.type === "room") void handleDeleteRoom(itemToDelete.id); else void handleDeleteBed(itemToDelete.id) }}>{copy.delete}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}
