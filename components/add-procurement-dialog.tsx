"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createBrowserClient } from "@/lib/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AddProcurementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suppliers: Array<{ id: string; name: string }>
  onItemAdded: () => void
}

export function AddProcurementDialog({ open, onOpenChange, suppliers, onItemAdded }: AddProcurementDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    item_name: "",
    category: "Equipment",
    supplier_id: "",
    unit_price: "",
    quantity: "1",
    status: "pending",
    priority: "normal",
    expected_delivery: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createBrowserClient()
    const total_cost = Number.parseFloat(formData.unit_price) * Number.parseInt(formData.quantity)

    const { error } = await supabase.from("procurement_items").insert({
      ...formData,
      unit_price: Number.parseFloat(formData.unit_price),
      quantity: Number.parseInt(formData.quantity),
      total_cost,
    })

    if (!error) {
      onItemAdded()
      setFormData({
        item_name: "",
        category: "Equipment",
        supplier_id: "",
        unit_price: "",
        quantity: "1",
        status: "pending",
        priority: "normal",
        expected_delivery: "",
      })
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white">Item Name</label>
            <Input
              required
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              placeholder="e.g., Office Chairs"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white">Category</label>
            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Equipment">Equipment</SelectItem>
                <SelectItem value="Supplies">Supplies</SelectItem>
                <SelectItem value="Services">Services</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-white">Supplier</label>
            <Select value={formData.supplier_id} onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-white">Unit Price</label>
              <Input
                required
                type="number"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white">Quantity</label>
              <Input
                required
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white">Priority</label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-white">Expected Delivery</label>
            <Input
              type="date"
              value={formData.expected_delivery}
              onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
