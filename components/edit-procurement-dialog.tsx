"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createBrowserClient } from "@/lib/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProcurementItem {
  id: string
  item_name: string
  category: string
  supplier_id: string
  unit_price: number
  quantity: number
  total_cost: number
  status: string
  priority: string
  expected_delivery: string
}

interface EditProcurementDialogProps {
  item: ProcurementItem
  open: boolean
  onOpenChange: (open: boolean) => void
  suppliers: Array<{ id: string; name: string }>
  onItemUpdated: () => void
}

export function EditProcurementDialog({
  item,
  open,
  onOpenChange,
  suppliers,
  onItemUpdated,
}: EditProcurementDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState(item)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createBrowserClient()
    const total_cost = formData.unit_price * formData.quantity

    const { error } = await supabase
      .from("procurement_items")
      .update({
        ...formData,
        total_cost,
      })
      .eq("id", item.id)

    if (!error) {
      onItemUpdated()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Purchase Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white">Status</label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-white">Quantity</label>
            <Input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: Number.parseInt(e.target.value) })}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white">Expected Delivery</label>
            <Input
              type="date"
              value={formData.expected_delivery || ""}
              onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
