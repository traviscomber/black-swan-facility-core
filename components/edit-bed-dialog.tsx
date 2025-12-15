"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBrowserClient } from "@/lib/supabase/client"

interface Bed {
  id: string
  room_id: string
  bed_number: string
  bed_type: string
  is_available: boolean
  room?: {
    id: string
    room_number: string
    room_type: string
  }
}

interface Room {
  id: string
  room_number: string
  room_type: string
}

interface EditBedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bed: Bed
  room?: Room
  onSuccess: () => void
}

export function EditBedDialog({ open, onOpenChange, bed, room, onSuccess }: EditBedDialogProps) {
  const [bedNumber, setBedNumber] = useState(bed.bed_number)
  const [bedType, setBedType] = useState(bed.bed_type)
  const [isAvailable, setIsAvailable] = useState(bed.is_available)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient()

  const roomData = room || bed.room
  const roomName = roomData?.room_number || "Unknown Room"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from("beds")
      .update({
        bed_number: bedNumber,
        bed_type: bedType,
        is_available: isAvailable,
      })
      .eq("id", bed.id)

    if (error) {
      console.error("Error updating bed:", error)
      alert("Error updating bed")
    } else {
      onSuccess()
      onOpenChange(false)
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Bed</DialogTitle>
          <DialogDescription>Update bed details for {roomName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bed_number">Bed Name/Number</Label>
              <Input
                id="bed_number"
                value={bedNumber}
                onChange={(e) => setBedNumber(e.target.value)}
                placeholder="e.g., Cama Doble, Litera Superior"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bed_type">Bed Type</Label>
              <select
                id="bed_type"
                value={bedType}
                onChange={(e) => setBedType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="bunk_top">Bunk (Top)</option>
                <option value="bunk_bottom">Bunk (Bottom)</option>
                <option value="queen">Queen</option>
                <option value="king">King</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_available"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_available" className="cursor-pointer">
                Available for booking
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
