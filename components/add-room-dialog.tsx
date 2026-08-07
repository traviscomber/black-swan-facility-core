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
import { useLanguage } from "@/lib/hooks/use-language"
import { roomDialogTranslations } from "@/lib/translations/room-dialogs"

interface AddRoomDialogProps { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void; locationId?: string }

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
  const { language } = useLanguage()
  const copy = roomDialogTranslations[language]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const amenitiesArray = amenities.split(",").map((a) => a.trim()).filter((a) => a)
    const roomData: any = { room_number: roomNumber, room_type: roomType, capacity: Number.parseInt(capacity) || 1, rate_per_night: Number.parseFloat(ratePerNight) || 0, status, location, amenities: amenitiesArray, notes, floor }
    if (locationId) roomData.location_id = locationId
    const { error } = await supabase.from("rooms").insert(roomData)
    setSubmitting(false)
    if (!error) { onSuccess(); onOpenChange(false); resetForm() }
    else { console.error("[v0] Error adding room:", error.message); alert(copy.createError.replace("{error}", error.message)) }
  }

  function resetForm() { setRoomNumber(""); setRoomType(""); setCapacity(""); setRatePerNight(""); setStatus("available"); setLocation(""); setAmenities(""); setNotes(""); setFloor("") }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]"><DialogHeader><DialogTitle>{copy.addRoom}</DialogTitle></DialogHeader><form onSubmit={handleSubmit} className="space-y-4">
    <div><Label htmlFor="room-number">{copy.roomNumber} *</Label><Input id="room-number" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder={copy.roomPlaceholder} required /></div>
    <div><Label htmlFor="room-type">{copy.roomType} *</Label><Input id="room-type" value={roomType} onChange={(e) => setRoomType(e.target.value)} placeholder={copy.typePlaceholder} required /></div>
    <div className="grid grid-cols-2 gap-4"><div><Label htmlFor="capacity">{copy.capacity} *</Label><Input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="2" required /></div><div><Label htmlFor="rate">{copy.rate} *</Label><Input id="rate" type="number" step="0.01" value={ratePerNight} onChange={(e) => setRatePerNight(e.target.value)} placeholder="150.00" required /></div></div>
    <div className="grid grid-cols-2 gap-4"><div><Label htmlFor="status">{copy.status}</Label><Select value={status} onValueChange={setStatus}><SelectTrigger id="status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="available">{copy.available}</SelectItem><SelectItem value="occupied">{copy.occupied}</SelectItem><SelectItem value="maintenance">{copy.maintenance}</SelectItem><SelectItem value="unavailable">{copy.unavailable}</SelectItem></SelectContent></Select></div><div><Label htmlFor="floor">{copy.floor}</Label><Input id="floor" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder={copy.floorPlaceholder} /></div></div>
    <div><Label htmlFor="location">{copy.location}</Label><Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={copy.locationPlaceholder} /></div>
    <div><Label htmlFor="amenities">{copy.amenities}</Label><Input id="amenities" value={amenities} onChange={(e) => setAmenities(e.target.value)} placeholder={copy.amenitiesPlaceholder} /></div>
    <div><Label htmlFor="notes">{copy.notes}</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={copy.notesPlaceholder} rows={3} /></div>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{copy.cancel}</Button><Button type="submit" disabled={submitting}>{submitting ? copy.creating : copy.createRoom}</Button></div>
  </form></DialogContent></Dialog>
}
