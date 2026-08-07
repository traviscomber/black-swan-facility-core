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
import { useLanguage } from "@/lib/hooks/use-language"
import { roomDialogTranslations } from "@/lib/translations/room-dialogs"

interface Room { id: string; room_number: string; room_type: string }
interface AddBedDialogProps { open: boolean; onOpenChange: (open: boolean) => void; room: Room; onSuccess: () => void }

export function AddBedDialog({ open, onOpenChange, room, onSuccess }: AddBedDialogProps) {
  const [bedNumber, setBedNumber] = useState("")
  const [bedType, setBedType] = useState("single")
  const [isAvailable, setIsAvailable] = useState(true)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const supabase = createBrowserClient()
  const { language } = useLanguage()
  const copy = roomDialogTranslations[language]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const { error } = await supabase.from("beds").insert({ room_id: room.id, bed_number: bedNumber, bed_type: bedType, is_available: isAvailable, notes })
    setSubmitting(false)
    if (!error) { onSuccess(); onOpenChange(false); resetForm() }
  }

  function resetForm() { setBedNumber(""); setBedType("single"); setIsAvailable(true); setNotes("") }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-[450px]"><DialogHeader><DialogTitle>{copy.addBedTo.replace("{room}", `${room.room_number} (${room.room_type})`)}</DialogTitle></DialogHeader><form onSubmit={handleSubmit} className="space-y-4">
    <div><Label htmlFor="bed-number">{copy.bedNumber} *</Label><Input id="bed-number" value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} placeholder={copy.bedPlaceholder} required /></div>
    <div><Label htmlFor="bed-type">{copy.bedType} *</Label><Select value={bedType} onValueChange={setBedType}><SelectTrigger id="bed-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="single">{copy.single}</SelectItem><SelectItem value="double">{copy.double}</SelectItem><SelectItem value="queen">{copy.queen}</SelectItem><SelectItem value="king">{copy.king}</SelectItem><SelectItem value="bunk">{copy.bunk}</SelectItem><SelectItem value="sofa-bed">{copy.sofaBed}</SelectItem></SelectContent></Select></div>
    <div className="flex items-center space-x-2"><Checkbox id="available" checked={isAvailable} onCheckedChange={(checked) => setIsAvailable(!!checked)} /><Label htmlFor="available" className="cursor-pointer font-normal">{copy.bedAvailable}</Label></div>
    <div><Label htmlFor="notes">{copy.notes}</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={copy.bedNotesPlaceholder} rows={3} /></div>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{copy.cancel}</Button><Button type="submit" disabled={submitting}>{submitting ? copy.adding : copy.addBed}</Button></div>
  </form></DialogContent></Dialog>
}
