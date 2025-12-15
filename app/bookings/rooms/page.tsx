"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, DollarSign, Users, MapPin, Pencil, Trash2, BedDouble } from "lucide-react"
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

interface Room {
  id: string
  room_number: string
  room_type: string
  capacity: number
  rate_per_night: number
  status: string
  location: string
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

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false)
  const [isEditRoomOpen, setIsEditRoomOpen] = useState(false)
  const [isAddBedOpen, setIsAddBedOpen] = useState(false)
  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null)
  const [selectedRoomForBed, setSelectedRoomForBed] = useState<Room | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: "room" | "bed"; id: string } | null>(null)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: roomsData } = await supabase.from("rooms").select("*").order("room_number")
    const { data: bedsData } = await supabase.from("beds").select("*").order("bed_number")

    setRooms(roomsData || [])
    setBeds(bedsData || [])
    setLoading(false)
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "available":
        return "bg-green-500"
      case "occupied":
        return "bg-blue-500"
      case "maintenance":
        return "bg-yellow-500"
      case "unavailable":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  function getBedCountForRoom(roomId: string) {
    return beds.filter((bed) => bed.room_id === roomId).length
  }

  async function handleDeleteRoom(roomId: string) {
    // Check if room has beds
    const roomBeds = beds.filter((bed) => bed.room_id === roomId)
    if (roomBeds.length > 0) {
      alert("Cannot delete room with assigned beds. Please delete all beds first.")
      return
    }

    const { error } = await supabase.from("rooms").delete().eq("id", roomId)
    if (!error) {
      setRooms(rooms.filter((r) => r.id !== roomId))
    }
    setDeleteDialogOpen(false)
  }

  async function handleDeleteBed(bedId: string) {
    const { error } = await supabase.from("beds").delete().eq("id", bedId)
    if (!error) {
      setBeds(beds.filter((b) => b.id !== bedId))
    }
    setDeleteDialogOpen(false)
  }

  function confirmDelete(type: "room" | "bed", id: string) {
    setItemToDelete({ type, id })
    setDeleteDialogOpen(true)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">Room & Bed Management</h1>
          <p className="text-sm text-muted-foreground">Manage rental units and bed inventory</p>
        </div>
        <Button className="gap-2" onClick={() => setIsAddRoomOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Room
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading rooms...</div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rooms.map((room) => {
              const roomBeds = beds.filter((bed) => bed.room_id === room.id)
              return (
                <Card key={room.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{room.room_number}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setRoomToEdit(room)
                            setIsEditRoomOpen(true)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => confirmDelete("room", room.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">{room.room_type}</p>
                      <Badge className={getStatusColor(room.status)} variant="secondary">
                        {room.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Up to {room.capacity || room.max_guests || 2} guests</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">${room.rate_per_night}</span>
                      <span className="text-muted-foreground">/ night</span>
                    </div>

                    {room.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{room.location}</span>
                      </div>
                    )}

                    {room.amenities && room.amenities.length > 0 && (
                      <div className="border-t pt-3">
                        <div className="flex flex-wrap gap-1">
                          {room.amenities.slice(0, 3).map((amenity, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                          {room.amenities.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{room.amenities.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">Beds ({roomBeds.length})</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 px-2"
                          onClick={() => {
                            setSelectedRoomForBed(room)
                            setIsAddBedOpen(true)
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          Add Bed
                        </Button>
                      </div>
                      {roomBeds.length > 0 ? (
                        <div className="space-y-1.5">
                          {roomBeds.map((bed) => (
                            <div
                              key={bed.id}
                              className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <BedDouble className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium">{bed.bed_number}</span>
                                <span className="text-muted-foreground">({bed.bed_type})</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-destructive"
                                onClick={() => confirmDelete("bed", bed.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No beds added yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <AddRoomDialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen} onSuccess={loadData} />

      {roomToEdit && (
        <EditRoomDialog open={isEditRoomOpen} onOpenChange={setIsEditRoomOpen} room={roomToEdit} onSuccess={loadData} />
      )}

      {selectedRoomForBed && (
        <AddBedDialog
          open={isAddBedOpen}
          onOpenChange={setIsAddBedOpen}
          room={selectedRoomForBed}
          onSuccess={loadData}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {itemToDelete?.type}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToDelete) {
                  if (itemToDelete.type === "room") {
                    handleDeleteRoom(itemToDelete.id)
                  } else {
                    handleDeleteBed(itemToDelete.id)
                  }
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
