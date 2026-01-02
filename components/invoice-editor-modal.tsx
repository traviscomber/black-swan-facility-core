"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@supabase/ssr"
import { Plus, Trash2, ImageIcon } from "lucide-react"

interface InvoiceEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId?: string
  guestName?: string
  guestEmail?: string
  guestPhone?: string
}

export function InvoiceEditorModal({
  open,
  onOpenChange,
  invoiceId,
  guestName = "",
  guestEmail = "",
  guestPhone = "",
}: InvoiceEditorModalProps) {
  const [formData, setFormData] = useState({
    customer_name: guestName,
    customer_email: guestEmail,
    customer_phone: guestPhone,
    customer_company: "",
    customer_address: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    line_items: [{ description: "", qty: 1, unit_price: 0 }],
    discount_amount: 0,
    discount_percentage: 0,
    tax_rate: 0,
    additional_fees: 0,
    invoice_status: "draft",
    payment_status: "pending",
    notes: "",
  })

  const [lineItems, setLineItems] = useState(formData.line_items)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    if (invoiceId) {
      loadInvoice()
    }
  }, [invoiceId, open])

  const loadInvoice = async () => {
    const { data } = await supabase.from("invoices").select("*").eq("id", invoiceId).single()

    if (data) {
      setFormData(data)
      setLineItems(data.line_items || [{ description: "", qty: 1, unit_price: 0 }])
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    setLineItems(updated)
  }

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", qty: 1, unit_price: 0 }])
  }

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
  }

  const subtotal = calculateSubtotal()
  const discountAmount = formData.discount_percentage
    ? (subtotal * formData.discount_percentage) / 100
    : formData.discount_amount
  const taxAmount = ((subtotal - discountAmount) * formData.tax_rate) / 100
  const total = subtotal - discountAmount + taxAmount + formData.additional_fees

  const saveInvoice = async () => {
    const invoiceData = {
      ...formData,
      line_items: lineItems,
    }

    if (invoiceId) {
      await supabase.from("invoices").update(invoiceData).eq("id", invoiceId)
    } else {
      await supabase.from("invoices").insert([invoiceData])
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[98vw] max-h-[98vh] overflow-y-auto p-0 bg-slate-900 border-slate-700">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 px-8 py-4 z-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <ImageIcon className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">New Invoice</h1>
              <p className="text-xs text-slate-400">Black Swan Facility Management</p>
            </div>
          </div>
          <DialogClose className="text-slate-400 hover:text-white transition-colors" />
        </div>

        {/* Main Content */}
        <div className="p-8 space-y-6">
          {/* Header Section - Customer & Dates */}
          <div className="grid grid-cols-4 gap-6">
            {/* Customer Info */}
            <div className="col-span-2 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                Customer Information
              </h3>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Customer Name *</label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => handleInputChange("customer_name", e.target.value)}
                  placeholder="John Doe"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Email</label>
                <Input
                  value={formData.customer_email}
                  onChange={(e) => handleInputChange("customer_email", e.target.value)}
                  type="email"
                  placeholder="customer@example.com"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Phone</label>
                <Input
                  value={formData.customer_phone}
                  onChange={(e) => handleInputChange("customer_phone", e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Company</label>
                <Input
                  value={formData.customer_company}
                  onChange={(e) => handleInputChange("customer_company", e.target.value)}
                  placeholder="Company Name"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Address</label>
                <textarea
                  value={formData.customer_address}
                  onChange={(e) => handleInputChange("customer_address", e.target.value)}
                  placeholder="Street address, city, state"
                  className="w-full bg-slate-800 border border-slate-700 rounded text-white text-sm p-2 resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Dates & Status */}
            <div className="col-span-2 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                Invoice Details
              </h3>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Invoice Date</label>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => handleInputChange("invoice_date", e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Due Date</label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange("due_date", e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Invoice Status</label>
                <select
                  value={formData.invoice_status}
                  onChange={(e) => handleInputChange("invoice_status", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded text-white text-sm p-2"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Payment Status</label>
                <select
                  value={formData.payment_status}
                  onChange={(e) => handleInputChange("payment_status", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded text-white text-sm p-2"
                >
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
          </div>

          {/* Line Items - Full Width */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                Line Items
              </h3>
              <Button onClick={addLineItem} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>

            <div className="bg-slate-800/50 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 w-20">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 w-24">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 w-24">Total</th>
                    <th className="px-4 py-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3">
                        <Input
                          value={item.description}
                          onChange={(e) => handleLineItemChange(index, "description", e.target.value)}
                          placeholder="Item description"
                          className="bg-slate-700 border-slate-600 text-white text-sm h-8"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleLineItemChange(index, "qty", Number.parseFloat(e.target.value) || 1)}
                          className="bg-slate-700 border-slate-600 text-white text-sm h-8 text-center"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleLineItemChange(index, "unit_price", Number.parseFloat(e.target.value) || 0)
                          }
                          placeholder="0.00"
                          className="bg-slate-700 border-slate-600 text-white text-sm h-8 text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-400">
                        ${(item.qty * item.unit_price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeLineItem(index)}
                          className="text-red-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Details */}
          <div className="grid grid-cols-4 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase">Discount</h3>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Amount ($)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discount_amount}
                  onChange={(e) => handleInputChange("discount_amount", Number.parseFloat(e.target.value) || 0)}
                  className="bg-slate-800 border-slate-700 text-white text-sm h-9"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Percentage (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.discount_percentage}
                  onChange={(e) => handleInputChange("discount_percentage", Number.parseFloat(e.target.value) || 0)}
                  className="bg-slate-800 border-slate-700 text-white text-sm h-9"
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase">Tax</h3>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Tax Rate (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.tax_rate}
                  onChange={(e) => handleInputChange("tax_rate", Number.parseFloat(e.target.value) || 0)}
                  className="bg-slate-800 border-slate-700 text-white text-sm h-9"
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase">Additional Fees</h3>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Fees ($)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.additional_fees}
                  onChange={(e) => handleInputChange("additional_fees", Number.parseFloat(e.target.value) || 0)}
                  className="bg-slate-800 border-slate-700 text-white text-sm h-9"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-3 bg-slate-800/50 p-4 rounded-lg">
              <h3 className="text-xs font-semibold text-slate-400 uppercase">Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotal:</span>
                  <span className="text-white font-medium">${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-400">
                    <span>Discount:</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm text-blue-400">
                    <span>Tax:</span>
                    <span>+${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {formData.additional_fees > 0 && (
                  <div className="flex justify-between text-sm text-orange-400">
                    <span>Fees:</span>
                    <span>+${formData.additional_fees.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-700 pt-2 flex justify-between">
                  <span className="text-white font-bold">Total:</span>
                  <span className="text-amber-400 font-bold text-lg">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              Notes
            </h3>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Add any additional notes or terms..."
              className="w-full bg-slate-800 border border-slate-700 rounded text-white text-sm p-3 resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-t border-slate-800 px-8 py-4 flex justify-end gap-3">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button onClick={saveInvoice} className="bg-amber-600 hover:bg-amber-700 text-white">
            Save Invoice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
