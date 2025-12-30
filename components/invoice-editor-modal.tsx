"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2 } from "lucide-react"

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface InvoiceData {
  id?: string
  reservation_id?: string
  customer_name: string
  customer_email: string
  customer_phone: string
  invoice_date: string
  due_date: string
  line_items: LineItem[]
  subtotal: number
  discount_amount: number
  discount_percentage: number
  tax_rate: number
  tax_amount: number
  additional_fees: number
  total_amount: number
  payment_status: string
  status: string
  notes: string
}

interface InvoiceEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice?: any | null
  onSave: () => void
}

export function InvoiceEditorModal({ open, onOpenChange, invoice, onSave }: InvoiceEditorModalProps) {
  const [formData, setFormData] = useState<InvoiceData>({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    line_items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
    subtotal: 0,
    discount_amount: 0,
    discount_percentage: 0,
    tax_rate: 0,
    tax_amount: 0,
    additional_fees: 0,
    total_amount: 0,
    payment_status: "pending",
    status: "draft",
    notes: "",
  })

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (invoice && open) {
      setFormData({
        ...invoice,
        line_items: invoice.line_items || formData.line_items,
      })
    }
  }, [invoice, open])

  function calculateTotals() {
    const subtotal = formData.line_items.reduce((sum, item) => sum + item.total, 0)
    const afterDiscount =
      subtotal -
      (formData.discount_percentage > 0 ? subtotal * (formData.discount_percentage / 100) : formData.discount_amount)
    const taxAmount = afterDiscount * (formData.tax_rate / 100)
    const total = afterDiscount + taxAmount + formData.additional_fees

    setFormData((prev) => ({
      ...prev,
      subtotal,
      tax_amount: taxAmount,
      total_amount: total,
    }))
  }

  useEffect(() => {
    calculateTotals()
  }, [
    formData.line_items,
    formData.discount_amount,
    formData.discount_percentage,
    formData.tax_rate,
    formData.additional_fees,
  ])

  function updateLineItem(index: number, field: string, value: any) {
    const newItems = [...formData.line_items]
    if (field === "quantity" || field === "unitPrice") {
      newItems[index] = {
        ...newItems[index],
        [field]: Number.parseFloat(value),
      }
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      }
    }
    setFormData((prev) => ({
      ...prev,
      line_items: newItems,
    }))
  }

  async function handleSave() {
    setLoading(true)
    try {
      const url = invoice?.id ? `/api/bookings/invoices/${invoice.id}` : "/api/bookings/invoices"
      const method = invoice?.id ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error("Failed to save invoice")

      onSave()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error saving invoice:", error)
      alert("Failed to save invoice")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name *</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        customer_name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        customer_email: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.customer_phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        customer_phone: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Dates */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        invoice_date: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        due_date: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button
                size="sm"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    line_items: [...prev.line_items, { description: "", quantity: 1, unitPrice: 0, total: 0 }],
                  }))
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {formData.line_items.map((item, index) => (
                  <div key={index} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">Total</Label>
                      <Input type="number" disabled value={item.total.toFixed(2)} />
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          line_items: prev.line_items.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Financial Details */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.discount_amount}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        discount_amount: Number.parseFloat(e.target.value),
                        discount_percentage: 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Discount Percentage (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.discount_percentage}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        discount_percentage: Number.parseFloat(e.target.value),
                        discount_amount: 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Tax Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.tax_rate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        tax_rate: Number.parseFloat(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Additional Fees ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.additional_fees}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        additional_fees: Number.parseFloat(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">${formData.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({formData.tax_rate}%):</span>
                  <span className="font-semibold">${formData.tax_amount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${formData.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Status</Label>
                <Select
                  value={formData.payment_status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      payment_status: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Additional notes or terms..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading || !formData.customer_name} className="flex-1">
              {loading ? "Saving..." : "Save Invoice"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
