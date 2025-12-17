"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Plus, Pencil, Trash2, ArrowLeft, Home, BedIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

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

export default function LocationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locationId = params.id as string
  const { toast } = useToast()

  const [location, setLocation] = useState<Location | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [beds, setBeds] = useState<Bed[]>([])

  const [isAddRoomDialogOpen, setIsAddRoomDialogOpen] = useState(false)
  const [isEditRoomDialogOpen, setIsEditRoomDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)

  const [isAddBedDialogOpen, setIsAddBedDialogOpen] = useState(false)
  const [selectedRoomForBed, setSelectedRoomForBed] = useState<string | null>(null)
  const [isEditBedDialogOpen, setIsEditBedDialogOpen] = useState(false)
  const [editingBed, setEditingBed] = useState<Bed | null>(null)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadLocationData()
  }, [locationId])

  async function loadLocationData() {
    // Load location details
    const { data: locationData, error: locationError } = await supabase
      .from("locations")
      .select("*")
      .eq("id", locationId)
      .single()

    if (locationError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load location details",
      })
      return
    }

    setLocation(locationData)

    const { data: roomsData, error: roomsError } = await supabase
      .from("rooms")
      .select("*")
      .eq("location_id", locationId)
      .order("room_number")

    if (roomsError) {
      console.error("Error loading rooms:", roomsError)
    } else {
      setRooms(roomsData || [])

      // Load all beds for these rooms
      if (roomsData && roomsData.length > 0) {
        const roomIds = roomsData.map((r) => r.id)
        const { data: bedsData, error: bedsError } = await supabase
          .from("beds")
          .select("*")
          .in("room_id", roomIds)
          .order("bed_number")

        if (bedsError) {
          console.error("Error loading beds:", bedsError)
        } else {
          setBeds(bedsData || [])
        }
      }
    }
  }

  async function handleAddRoom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const { error } = await supabase.from("rooms").insert({
      room_number: formData.get("room_number") as string,
      room_type: formData.get("room_type") as string,
      capacity: Number(formData.get("capacity")),
      rate_per_night: Number(formData.get("rate_per_night")),
      status: formData.get("status") as string,
      location_id: locationId,
      floor: formData.get("floor") as string,
      amenities: formData.get("amenities") ? (formData.get("amenities") as string).split(",").map((a) => a.trim()) : [],
      notes: formData.get("notes") as string,
    })

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add room",
      })
    } else {
      toast({
        title: "Success",
        description: "Room added successfully",
      })
      setIsAddRoomDialogOpen(false)
      loadLocationData()
    }
  }

  async function handleEditRoom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingRoom) return

    const formData = new FormData(e.currentTarget)

    const { error } = await supabase
      .from("rooms")
      .update({
        room_number: formData.get("room_number") as string,
        room_type: formData.get("room_type") as string,
        capacity: Number(formData.get("capacity")),
        rate_per_night: Number(formData.get("rate_per_night")),
        status: formData.get("status") as string,
        floor: formData.get("floor") as string,
        amenities: formData.get("amenities")
          ? (formData.get("amenities") as string).split(",").map((a) => a.trim())
          : [],
        notes: formData.get("notes") as string,
      })
      .eq("id", editingRoom.id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update room",
      })
    } else {
      toast({
        title: "Success",
        description: "Room updated successfully",
      })
      setIsEditRoomDialogOpen(false)
      setEditingRoom(null)
      loadLocationData()
    }
  }

  async function handleDeleteRoom(roomId: string) {
    const roomBeds = beds.filter((b) => b.room_id === roomId)
    if (roomBeds.length > 0) {
      toast({
        variant: "destructive",
        title: "Cannot Delete",
        description: "Please delete all beds in this room first",
      })
      return
    }

    if (!confirm("Are you sure you want to delete this room?")) return

    const { error } = await supabase.from("rooms").delete().eq("id", roomId)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete room",
      })
    } else {
      toast({
        title: "Success",
        description: "Room deleted successfully",
      })
      loadLocationData()
    }
  }

  async function handleAddBed(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedRoomForBed) return

    const formData = new FormData(e.currentTarget)

    const { error } = await supabase.from("beds").insert({
      room_id: selectedRoomForBed,
      bed_number: formData.get("bed_number") as string,
      bed_type: formData.get("bed_type") as string,
      is_available: true,
      notes: formData.get("notes") as string,
    })

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add bed",
      })
    } else {
      toast({
        title: "Success",
        description: "Bed added successfully",
      })
      setIsAddBedDialogOpen(false)
      setSelectedRoomForBed(null)
      loadLocationData()
    }
  }

  async function handleEditBed(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingBed) return

    const formData = new FormData(e.currentTarget)

    const { error } = await supabase
      .from("beds")
      .update({
        bed_number: formData.get("bed_number") as string,
        bed_type: formData.get("bed_type") as string,
        notes: formData.get("notes") as string,
      })
      .eq("id", editingBed.id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update bed",
      })
    } else {
      toast({
        title: "Success",
        description: "Bed updated successfully",
      })
      setIsEditBedDialogOpen(false)
      setEditingBed(null)
      loadLocationData()
    }
  }

  async function handleDeleteBed(bedId: string) {
    if (!confirm("Are you sure you want to delete this bed?")) return

    const { error } = await supabase.from("beds").delete().eq("id", bedId)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete bed",
      })
    } else {
      toast({
        title: "Success",
        description: "Bed deleted successfully",
      })
      loadLocationData()
    }
  }

  if (!location) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/bookings/locations">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{location.name}</h1>
              <p className="text-muted-foreground">
                {location.description || "Manage rooms and beds for this location"}
              </p>
            </div>
          </div>
          <Button onClick={() => setIsAddRoomDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Room
          </Button>
        </div>

        {/* Rooms Grid */}
        {rooms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Home className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Rooms Yet</h3>
              <p className="text-muted-foreground mb-4">Add your first room to get started</p>
              <Button onClick={() => setIsAddRoomDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Room
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const roomBeds = beds.filter((b) => b.room_id === room.id)

              return (
                <Card key={room.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Home className="h-5 w-5 text-primary" />
                          {room.room_number}
                        </CardTitle>
                        <CardDescription>
                          {room.room_type} • {room.capacity} guests
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingRoom(room)
                            setIsEditRoomDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteRoom(room.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Room Details */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rate:</span>
                        <span className="font-medium">${room.rate_per_night}/night</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={room.status === "available" ? "text-green-600" : "text-orange-600"}>
                          {room.status}
                        </span>
                      </div>
                      {room.floor && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Floor:</span>
                          <span>{room.floor}</span>
                        </div>
                      )}
                    </div>

                    {/* Beds Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <BedIcon className="h-4 w-4" />
                          Beds ({roomBeds.length})
                        </h4>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRoomForBed(room.id)
                            setIsAddBedDialogOpen(true)
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {roomBeds.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">No beds added yet</p>
                      ) : (
                        <div className="space-y-2">
                          {roomBeds.map((bed) => (
                            <div key={bed.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{bed.bed_number}</div>
                                <div className="text-xs text-muted-foreground">{bed.bed_type}</div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setEditingBed(bed)
                                    setIsEditBedDialogOpen(true)
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => handleDeleteBed(bed.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Add Room Dialog */}
        <Dialog open={isAddRoomDialogOpen} onOpenChange={setIsAddRoomDialogOpen}>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleAddRoom}>
              <DialogHeader>
                <DialogTitle>Add Room to {location.name}</DialogTitle>
                <DialogDescription>Create a new room unit in this location</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="room_number">Room Number/Name *</Label>
                    <Input id="room_number" name="room_number" placeholder="e.g., Room 101, Suite A" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room_type">Room Type *</Label>
                    <Select name="room_type" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="suite">Suite</SelectItem>
                        <SelectItem value="cabin">Cabin</SelectItem>
                        <SelectItem value="bungalow">Bungalow</SelectItem>
                        <SelectItem value="dorm">Dorm</SelectItem>
                        <SelectItem value="studio">Studio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Max Guests *</Label>
                    <Input id="capacity" name="capacity" type="number" min="1" defaultValue="2" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate_per_night">Rate/Night ($) *</Label>
                    <Input
                      id="rate_per_night"
                      name="rate_per_night"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue="100"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor">Floor</Label>
                    <Input id="floor" name="floor" placeholder="e.g., 1st, 2nd" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select name="status" defaultValue="available">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amenities">Amenities (comma-separated)</Label>
                  <Input id="amenities" name="amenities" placeholder="WiFi, AC, Private Bath, Kitchen" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={2} placeholder="Additional information" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddRoomDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Room</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Room Dialog */}
        <Dialog open={isEditRoomDialogOpen} onOpenChange={setIsEditRoomDialogOpen}>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleEditRoom}>
              <DialogHeader>
                <DialogTitle>Edit Room</DialogTitle>
                <DialogDescription>Update room details</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_room_number">Room Number/Name *</Label>
                    <Input id="edit_room_number" name="room_number" defaultValue={editingRoom?.room_number} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_room_type">Room Type *</Label>
                    <Select name="room_type" defaultValue={editingRoom?.room_type}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="suite">Suite</SelectItem>
                        <SelectItem value="cabin">Cabin</SelectItem>
                        <SelectItem value="bungalow">Bungalow</SelectItem>
                        <SelectItem value="dorm">Dorm</SelectItem>
                        <SelectItem value="studio">Studio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_capacity">Max Guests *</Label>
                    <Input
                      id="edit_capacity"
                      name="capacity"
                      type="number"
                      min="1"
                      defaultValue={editingRoom?.capacity}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_rate">Rate/Night ($) *</Label>
                    <Input
                      id="edit_rate"
                      name="rate_per_night"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editingRoom?.rate_per_night}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_floor">Floor</Label>
                    <Input id="edit_floor" name="floor" defaultValue={editingRoom?.floor || ""} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_status">Status *</Label>
                  <Select name="status" defaultValue={editingRoom?.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_amenities">Amenities (comma-separated)</Label>
                  <Input id="edit_amenities" name="amenities" defaultValue={editingRoom?.amenities?.join(", ") || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_notes">Notes</Label>
                  <Textarea id="edit_notes" name="notes" rows={2} defaultValue={editingRoom?.notes || ""} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditRoomDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Bed Dialog */}
        <Dialog open={isAddBedDialogOpen} onOpenChange={setIsAddBedDialogOpen}>
          <DialogContent>
            <form onSubmit={handleAddBed}>
              <DialogHeader>
                <DialogTitle>Add Bed</DialogTitle>
                <DialogDescription>Add a new bed to this room</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="bed_number">Bed Name/Number *</Label>
                  <Input id="bed_number" name="bed_number" placeholder="e.g., Cama 1, Litera Superior" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bed_type">Bed Type *</Label>
                  <Select name="bed_type" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bed type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Double">Double</SelectItem>
                      <SelectItem value="Queen">Queen</SelectItem>
                      <SelectItem value="King">King</SelectItem>
                      <SelectItem value="Bunk_top">Bunk (Top)</SelectItem>
                      <SelectItem value="Bunk_bottom">Bunk (Bottom)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bed_notes">Notes</Label>
                  <Textarea id="bed_notes" name="notes" rows={2} placeholder="Optional notes" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddBedDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Bed</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Bed Dialog */}
        <Dialog open={isEditBedDialogOpen} onOpenChange={setIsEditBedDialogOpen}>
          <DialogContent>
            <form onSubmit={handleEditBed}>
              <DialogHeader>
                <DialogTitle>Edit Bed</DialogTitle>
                <DialogDescription>Update bed details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_bed_number">Bed Name/Number *</Label>
                  <Input id="edit_bed_number" name="bed_number" defaultValue={editingBed?.bed_number} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_bed_type">Bed Type *</Label>
                  <Select name="bed_type" defaultValue={editingBed?.bed_type}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Double">Double</SelectItem>
                      <SelectItem value="Queen">Queen</SelectItem>
                      <SelectItem value="King">King</SelectItem>
                      <SelectItem value="Bunk_top">Bunk (Top)</SelectItem>
                      <SelectItem value="Bunk_bottom">Bunk (Bottom)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_bed_notes">Notes</Label>
                  <Textarea id="edit_bed_notes" name="notes" rows={2} defaultValue={editingBed?.notes || ""} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditBedDialogOpen(false)}>
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
