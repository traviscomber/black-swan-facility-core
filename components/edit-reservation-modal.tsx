"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { differenceInDays } from "date-fns"
import { Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type ReservationFormData = {
  id: string
  guest_name: string
  guest_email: string
  guest_phone: string
  check_in: string
  check_out: string
  status: string
  special_requests: string
  num_guests: number
  total_amount: number
  bed_id: string
}

interface EditReservationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: ReservationFormData | null
  onUpdate: (data: ReservationFormData) => Promise<void>
  onDelete: () => Promise<void>
  loading?: boolean
}

const EMPTY_FORM: ReservationFormData = {
  id: "",
  guest_name: "",
  guest_email: "",
  guest_phone: "",
  check_in: "",
  check_out: "",
  status: "pending",
  special_requests: "",
  num_guests: 1,
  total_amount: 0,
  bed_id: "",
}

export function EditReservationModal({
  open,
  onOpenChange,
  reservation,
  onUpdate,
  onDelete,
  loading = false,
}: EditReservationModalProps) {
  const [formData, setFormData] = useState<ReservationFormData>(reservation ?? EMPTY_FORM)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (reservation) setFormData(reservation)
  }, [reservation])

  if (!reservation) return null

  const nights = Math.max(0, differenceInDays(new Date(reservation.check_out), new Date(reservation.check_in)))
  const pricePerNight = nights > 0 ? reservation.total_amount / nights : 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await onUpdate(formData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Reservation - {reservation.guest_name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Guest Name</Label>
              <Input value={formData.guest_name} onChange={(event) => setFormData({ ...formData, guest_name: event.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="checked_out">Checked Out</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.guest_email} onChange={(event) => setFormData({ ...formData, guest_email: event.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formData.guest_phone} onChange={(event) => setFormData({ ...formData, guest_phone: event.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Check-in</Label>
              <Input type="date" value={formData.check_in} onChange={(event) => setFormData({ ...formData, check_in: event.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Check-out</Label>
              <Input type="date" value={formData.check_out} onChange={(event) => setFormData({ ...formData, check_out: event.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Number of Guests</Label>
              <Input type="number" min="1" value={formData.num_guests} onChange={(event) => setFormData({ ...formData, num_guests: Number.parseInt(event.target.value, 10) || 1 })} />
            </div>

            <div className="space-y-2">
              <Label>Total Amount</Label>
              <Input type="number" step="0.01" value={formData.total_amount} onChange={(event) => setFormData({ ...formData, total_amount: Number.parseFloat(event.target.value) || 0 })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Special Requests</Label>
            <Textarea value={formData.special_requests} onChange={(event) => setFormData({ ...formData, special_requests: event.target.value })} rows={3} />
          </div>

          <Card className="border-secondary bg-secondary/10">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Calculation</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Price per night:</span><span className="font-semibold">${pricePerNight.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Nights:</span><span className="font-semibold">{nights}</span></div>
              <div className="mt-1 flex justify-between border-t border-secondary pt-1"><span className="font-semibold text-accent">Total Revenue:</span><span className="font-bold text-primary">${formData.total_amount.toFixed(2)}</span></div>
            </CardContent>
          </Card>

          <DialogFooter className="gap-2">
            <Button type="button" variant="destructive" onClick={() => setShowDeleteConfirm(true)} disabled={loading} className="mr-auto">
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-primary">{loading ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </form>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="max-w-sm">
              <CardHeader><CardTitle>Delete Reservation?</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">Are you sure you want to delete this reservation for {reservation.guest_name}? This action cannot be undone.</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={loading} className="flex-1">Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await onDelete()
                      setShowDeleteConfirm(false)
                      onOpenChange(false)
                    }}
                    disabled={loading}
                    className="flex-1"
                  >Delete</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
