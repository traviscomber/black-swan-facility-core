"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"

interface AddReservationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  preselectedRoom?: string
  preselectedDate?: Date
}

export function AddReservationDialog({
  open,
  onOpenChange,
  onSuccess,
  preselectedRoom,
  preselectedDate,
}: AddReservationDialogProps) {
  const [rooms, setRooms] = useState<any[]>([])
  const [guests, setGuests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    room_id: preselectedRoom || "",
    guest_id: "",
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    check_in: preselectedDate ? format(preselectedDate, "yyyy-MM-dd") : "",
    check_out: "",
    num_guests: 1,
    total_amount: 0,
    status: "confirmed",
    special_requests: "",
  })

  const supabase = createBrowserClient()

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  async function loadData() {
    const { data: roomsData } = await supabase.from("rooms").select("*").eq("status", "available").order("room_number")

    const { data: guestsData } = await supabase.from("guests").select("*").order("name")

    setRooms(roomsData || [])
    setGuests(guestsData || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      // Insert reservation
      const { error } = await supabase.from("reservations").insert([
        {
          room_id: formData.room_id,
          guest_name: formData.guest_name,
          guest_email: formData.guest_email,
          guest_phone: formData.guest_phone,
          check_in: formData.check_in,
          check_out: formData.check_out,
          num_guests: formData.num_guests,
          total_amount: formData.total_amount,
          status: formData.status,
          special_requests: formData.special_requests,
        },
      ])

      if (error) throw error

      onSuccess()
      onOpenChange(false)
      resetForm()
    } catch (error) {
      console.error("Error creating reservation:", error)
      alert("Failed to create reservation")
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      room_id: "",
      guest_id: "",
      guest_name: "",
      guest_email: "",
      guest_phone: "",
      check_in: "",
      check_out: "",
      num_guests: 1,
      total_amount: 0,
      status: "confirmed",
      special_requests: "",
    })
  }

  function handleGuestSelect(guestId: string) {
    const guest = guests.find((g) => g.id === guestId)
    if (guest) {
      setFormData({
        ...formData,
        guest_id: guestId,
        guest_name: guest.name,
        guest_email: guest.email || "",
        guest_phone: guest.phone || "",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Reservation</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="room_id">Room</Label>
              <Select value={formData.room_id} onValueChange={(value) => setFormData({ ...formData, room_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.room_number} - {room.room_type} (${room.rate_per_night}/night)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_id">Existing Guest (Optional)</Label>
              <Select value={formData.guest_id} onValueChange={handleGuestSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select guest" />
                </SelectTrigger>
                <SelectContent>
                  {guests.map((guest) => (
                    <SelectItem key={guest.id} value={guest.id}>
                      {guest.name} - {guest.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_name">Guest Name</Label>
              <Input
                id="guest_name"
                value={formData.guest_name}
                onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_email">Email</Label>
              <Input
                id="guest_email"
                type="email"
                value={formData.guest_email}
                onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_phone">Phone</Label>
              <Input
                id="guest_phone"
                value={formData.guest_phone}
                onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="num_guests">Number of Guests</Label>
              <Input
                id="num_guests"
                type="number"
                min="1"
                value={formData.num_guests}
                onChange={(e) => setFormData({ ...formData, num_guests: Number.parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_in">Check-in</Label>
              <Input
                id="check_in"
                type="date"
                value={formData.check_in}
                onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_out">Check-out</Label>
              <Input
                id="check_out"
                type="date"
                value={formData.check_out}
                onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_amount">Total Amount</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: Number.parseFloat(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="checked_out">Checked Out</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special_requests">Special Requests</Label>
            <Textarea
              id="special_requests"
              value={formData.special_requests || ""}
              onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Reservation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
