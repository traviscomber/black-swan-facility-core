"use client"

import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { differenceInDays } from "date-fns"

interface EditReservationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: {
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
  } | null
  onUpdate: (data: any) => Promise<void>
  onDelete: () => Promise<void>
  loading?: boolean
}

export function EditReservationModal({
  open,
  onOpenChange,
  reservation,
  onUpdate,
  onDelete,
  loading = false,
}: EditReservationModalProps) {
  const [formData, setFormData] = useState(reservation || {})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!reservation) return null

  const nights = differenceInDays(new Date(reservation.check_out), new Date(reservation.check_in))
  const pricePerNight = reservation.total_amount / nights || 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
              <Input
                value={formData.guest_name || ""}
                onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status || ""}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <Input
                type="email"
                value={formData.guest_email || ""}
                onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.guest_phone || ""}
                onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Check-in</Label>
              <Input
                type="date"
                value={formData.check_in || ""}
                onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Check-out</Label>
              <Input
                type="date"
                value={formData.check_out || ""}
                onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Number of Guests</Label>
              <Input
                type="number"
                min="1"
                value={formData.num_guests || 1}
                onChange={(e) => setFormData({ ...formData, num_guests: Number.parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Total Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.total_amount || 0}
                onChange={(e) => setFormData({ ...formData, total_amount: Number.parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Special Requests</Label>
            <Textarea
              value={formData.special_requests || ""}
              onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
              rows={3}
            />
          </div>

          {/* Revenue Summary */}
          <Card className="bg-secondary/10 border-secondary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Revenue Calculation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price per night:</span>
                <span className="font-semibold">${pricePerNight.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nights:</span>
                <span className="font-semibold">{nights}</span>
              </div>
              <div className="flex justify-between border-t border-secondary pt-1 mt-1">
                <span className="text-accent font-semibold">Total Revenue:</span>
                <span className="text-primary font-bold">${formData.total_amount?.toFixed(2) || "0.00"}</span>
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <Card className="max-w-sm">
              <CardHeader>
                <CardTitle>Delete Reservation?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Are you sure you want to delete this reservation for {reservation.guest_name}? This action cannot be
                  undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={loading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await onDelete()
                      setShowDeleteConfirm(false)
                      onOpenChange(false)
                    }}
                    disabled={loading}
                    className="flex-1"
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
