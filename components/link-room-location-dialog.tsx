"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { createBrowserClient } from "@/lib/supabase/client"

interface Location {
  id: string
  name: string
  description: string | null
}

interface LinkRoomLocationDialogProps {
  room: {
    id: string
    room_number: string
    location: string | null
    location_id: string | null
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function LinkRoomLocationDialog({ room, open, onOpenChange, onSuccess }: LinkRoomLocationDialogProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>(room.location_id || "")
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    if (open) {
      loadLocations()
      setSelectedLocationId(room.location_id || "")
    }
  }, [open, room])

  async function loadLocations() {
    const { data } = await supabase.from("locations").select("*").eq("is_active", true).order("name")
    setLocations(data || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLocationId) {
      alert("Please select a location")
      return
    }

    setLoading(true)

    const { error } = await supabase.from("rooms").update({ location_id: selectedLocationId }).eq("id", room.id)

    if (error) {
      console.error("Error linking room to location:", error)
      alert("Error linking room to location")
      setLoading(false)
    } else {
      onSuccess()
      onOpenChange(false)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Room to Location</DialogTitle>
          <DialogDescription>Connect "{room.room_number}" to a real property location</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location Property</Label>
              <select
                id="location"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select a location...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Current: {room.location || "No location set"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Linking..." : "Link Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
