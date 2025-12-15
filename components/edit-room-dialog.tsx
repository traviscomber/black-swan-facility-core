"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
}

interface EditRoomDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  room: Room
  onSuccess: () => void
}

export function EditRoomDialog({ open, onOpenChange, room, onSuccess }: EditRoomDialogProps) {
  const [roomNumber, setRoomNumber] = useState(room.room_number)
  const [roomType, setRoomType] = useState(room.room_type)
  const [capacity, setCapacity] = useState(room.capacity.toString())
  const [ratePerNight, setRatePerNight] = useState(room.rate_per_night.toString())
  const [status, setStatus] = useState(room.status)
  const [location, setLocation] = useState(room.location || "")
  const [amenities, setAmenities] = useState(room.amenities?.join(", ") || "")
  const [notes, setNotes] = useState(room.notes || "")
  const [floor, setFloor] = useState(room.floor || "")
  const [submitting, setSubmitting] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    setRoomNumber(room.room_number)
    setRoomType(room.room_type)
    setCapacity(room.capacity.toString())
    setRatePerNight(room.rate_per_night.toString())
    setStatus(room.status)
    setLocation(room.location || "")
    setAmenities(room.amenities?.join(", ") || "")
    setNotes(room.notes || "")
    setFloor(room.floor || "")
  }, [room])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const amenitiesArray = amenities
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a)

    const { error } = await supabase
      .from("rooms")
      .update({
        room_number: roomNumber,
        room_type: roomType,
        capacity: Number.parseInt(capacity) || 1,
        rate_per_night: Number.parseFloat(ratePerNight) || 0,
        status,
        location,
        amenities: amenitiesArray,
        notes,
        floor,
      })
      .eq("id", room.id)

    setSubmitting(false)

    if (!error) {
      onSuccess()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="room-number">Room Number *</Label>
            <Input id="room-number" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="room-type">Room Type *</Label>
            <Input id="room-type" value={roomType} onChange={(e) => setRoomType(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="capacity">Capacity *</Label>
              <Input
                id="capacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="rate">Rate/Night *</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={ratePerNight}
                onChange={(e) => setRatePerNight(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="floor">Floor</Label>
              <Input id="floor" value={floor} onChange={(e) => setFloor(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="amenities">Amenities (comma separated)</Label>
            <Input id="amenities" value={amenities} onChange={(e) => setAmenities(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
