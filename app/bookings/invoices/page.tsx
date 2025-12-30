"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Eye } from "lucide-react"
import { format } from "date-fns"
import { InvoiceEditorModal } from "@/components/invoice-editor-modal"

interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  customer_name: string
  customer_email: string
  total_amount: number
  payment_status: string
  status: string
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadInvoices()
  }, [])

  async function loadInvoices() {
    setLoading(true)
    try {
      const response = await fetch("/api/bookings/invoices")
      const data = await response.json()
      setInvoices(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("[v0] Error loading invoices:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    if (!confirm("Are you sure you want to delete this invoice?")) return

    try {
      await fetch(`/api/bookings/invoices/${invoiceId}`, {
        method: "DELETE",
      })
      setInvoices(invoices.filter((inv) => inv.id !== invoiceId))
    } catch (error) {
      console.error("[v0] Error deleting invoice:", error)
    }
  }

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "overdue":
        return "bg-red-100 text-red-800"
      case "draft":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-blue-100 text-blue-800"
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Invoices Management</h1>
          <p className="text-muted-foreground">Create, edit, and manage all invoices</p>
        </div>
        <Button onClick={() => setEditorOpen(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by invoice number or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices ({filteredInvoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No invoices found</div>
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-semibold">{invoice.invoice_number}</div>
                    <div className="text-sm text-muted-foreground">{invoice.customer_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(invoice.invoice_date), "MMM dd, yyyy")}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold">${invoice.total_amount.toFixed(2)}</div>
                      <Badge className={getStatusColor(invoice.payment_status)}>{invoice.payment_status}</Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedInvoice(invoice)
                          setPreviewOpen(true)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedInvoice(invoice)
                          setEditorOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteInvoice(invoice.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor Modal */}
      <InvoiceEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        invoice={selectedInvoice}
        onSave={() => {
          loadInvoices()
          setSelectedInvoice(null)
        }}
      />
    </div>
  )
}
