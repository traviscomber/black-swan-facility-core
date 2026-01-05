"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface ScheduleDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  schedule?: {
    id: string
    vessel_id: string
    departure_time?: string
    arrival_time?: string
    status: string
    notes?: string
  } | null
  vessels: Array<{ id: string; name: string }>
  onSave: (data: any) => Promise<void>
}

export function ScheduleDialog({ isOpen, onOpenChange, schedule, vessels, onSave }: ScheduleDialogProps) {
  const [formData, setFormData] = useState(
    schedule || {
      vessel_id: "",
      departure_time: "",
      arrival_time: "",
      status: "scheduled",
      notes: "",
    },
  )
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      await onSave(formData)
      onOpenChange(false)
      setFormData({
        vessel_id: "",
        departure_time: "",
        arrival_time: "",
        status: "scheduled",
        notes: "",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{schedule ? "Edit" : "Add"} Schedule</DialogTitle>
          <DialogDescription>
            {schedule ? "Update the vessel schedule details" : "Create a new vessel schedule"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="vessel_id">Vessel</Label>
            <Select
              value={formData.vessel_id}
              onValueChange={(value) => setFormData({ ...formData, vessel_id: value })}
            >
              <SelectTrigger id="vessel_id">
                <SelectValue placeholder="Select a vessel" />
              </SelectTrigger>
              <SelectContent>
                {vessels.map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="departure_time">Departure Time</Label>
            <Input
              id="departure_time"
              type="time"
              value={formData.departure_time || ""}
              onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="arrival_time">Arrival Time</Label>
            <Input
              id="arrival_time"
              type="time"
              value={formData.arrival_time || ""}
              onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="departed">Departed</SelectItem>
                <SelectItem value="arrived">Arrived</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes..."
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Schedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
