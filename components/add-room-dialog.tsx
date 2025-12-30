"use client"

import type React from "react"

import { useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AddRoomDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  locationId?: string
}

export function AddRoomDialog({ open, onOpenChange, onSuccess, locationId }: AddRoomDialogProps) {
  const [roomNumber, setRoomNumber] = useState("")
  const [roomType, setRoomType] = useState("")
  const [capacity, setCapacity] = useState("")
  const [ratePerNight, setRatePerNight] = useState("")
  const [status, setStatus] = useState("available")
  const [location, setLocation] = useState("")
  const [amenities, setAmenities] = useState("")
  const [notes, setNotes] = useState("")
  const [floor, setFloor] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const supabase = createBrowserClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const amenitiesArray = amenities
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a)

    const roomData: any = {
      room_number: roomNumber,
      room_type: roomType,
      capacity: Number.parseInt(capacity) || 1,
      rate_per_night: Number.parseFloat(ratePerNight) || 0,
      status,
      location,
      amenities: amenitiesArray,
      notes,
      floor,
    }

    if (locationId) {
      roomData.location_id = locationId
    }

    const { error } = await supabase.from("rooms").insert(roomData)

    setSubmitting(false)

    if (!error) {
      onSuccess()
      onOpenChange(false)
      resetForm()
    } else {
      console.error("[v0] Error adding room:", error.message)
      alert(`Error creating room: ${error.message}`)
    }
  }

  function resetForm() {
    setRoomNumber("")
    setRoomType("")
    setCapacity("")
    setRatePerNight("")
    setStatus("available")
    setLocation("")
    setAmenities("")
    setNotes("")
    setFloor("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="room-number">Room Number *</Label>
            <Input
              id="room-number"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="Suite-1, Cabin-3, etc."
              required
            />
          </div>

          <div>
            <Label htmlFor="room-type">Room Type *</Label>
            <Input
              id="room-type"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              placeholder="Suite, Cabin, Bunk Room, etc."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="capacity">Capacity *</Label>
              <Input
                id="capacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="2"
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
                placeholder="150.00"
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
              <Input
                id="floor"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="1st, Ground, etc."
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Main Building, North Wing, etc."
            />
          </div>

          <div>
            <Label htmlFor="amenities">Amenities (comma separated)</Label>
            <Input
              id="amenities"
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
              placeholder="WiFi, AC, Private Bath, Ocean View"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional information..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Room"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
