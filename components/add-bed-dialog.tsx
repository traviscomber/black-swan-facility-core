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
import { Checkbox } from "@/components/ui/checkbox"

interface Room {
  id: string
  room_number: string
  room_type: string
}

interface AddBedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  room: Room
  onSuccess: () => void
}

export function AddBedDialog({ open, onOpenChange, room, onSuccess }: AddBedDialogProps) {
  const [bedNumber, setBedNumber] = useState("")
  const [bedType, setBedType] = useState("single")
  const [isAvailable, setIsAvailable] = useState(true)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const supabase = createBrowserClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const { error } = await supabase.from("beds").insert({
      room_id: room.id,
      bed_number: bedNumber,
      bed_type: bedType,
      is_available: isAvailable,
      notes,
    })

    setSubmitting(false)

    if (!error) {
      onSuccess()
      onOpenChange(false)
      resetForm()
    }
  }

  function resetForm() {
    setBedNumber("")
    setBedType("single")
    setIsAvailable(true)
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            Add Bed to {room.room_number} ({room.room_type})
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="bed-number">Bed Number/Name *</Label>
            <Input
              id="bed-number"
              value={bedNumber}
              onChange={(e) => setBedNumber(e.target.value)}
              placeholder="Bed A, Bunk 1 Top, etc."
              required
            />
          </div>

          <div>
            <Label htmlFor="bed-type">Bed Type *</Label>
            <Select value={bedType} onValueChange={setBedType}>
              <SelectTrigger id="bed-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="double">Double</SelectItem>
                <SelectItem value="queen">Queen</SelectItem>
                <SelectItem value="king">King</SelectItem>
                <SelectItem value="bunk">Bunk</SelectItem>
                <SelectItem value="sofa-bed">Sofa Bed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="available" checked={isAvailable} onCheckedChange={(checked) => setIsAvailable(!!checked)} />
            <Label htmlFor="available" className="cursor-pointer font-normal">
              Bed is available for booking
            </Label>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special notes about this bed..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Bed"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
