"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Edit, Eye, Plus, Trash2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { InvoiceEditorModal } from "@/components/invoice-editor-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/hooks/use-language"
import { formatClp } from "@/lib/money"

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
  const { t } = useLanguage()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    void loadInvoices()
  }, [])

  async function loadInvoices() {
    setLoading(true)
    try {
      const response = await fetch("/api/bookings/invoices")
      const data = await response.json()
      setInvoices(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("[invoices] Error loading invoices:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    if (!confirm(t("invoices.delete_confirmation"))) return

    try {
      const response = await fetch(`/api/bookings/invoices/${invoiceId}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("No se pudo eliminar la factura")
      setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceId))
    } catch (error) {
      console.error("[invoices] Error deleting invoice:", error)
    }
  }

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  function getStatusColor(status: string) {
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
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("invoices.management")}</h1>
            <p className="text-muted-foreground">{t("invoices.create_edit_manage")}</p>
          </div>
          <Button
            onClick={() => {
              setSelectedInvoice(null)
              setEditorOpen(true)
            }}
            size="lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("invoices.new_invoice")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("invoices.search_invoices")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder={t("invoices.search_placeholder")}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("invoices.all_invoices")} ({filteredInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">{t("invoices.loading")}</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">{t("invoices.no_invoices")}</div>
            ) : (
              <div className="space-y-4">
                {filteredInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{invoice.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">{invoice.customer_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(`${invoice.invoice_date}T00:00:00`), "dd MMM yyyy")}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold">{formatClp(invoice.total_amount)}</div>
                        <Badge className={getStatusColor(invoice.payment_status)}>
                          {t(`invoices.${invoice.payment_status.toLowerCase()}`)}
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedInvoice(invoice)
                            setEditorOpen(true)
                          }}
                          aria-label={`Ver ${invoice.invoice_number}`}
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
                          aria-label={`Editar ${invoice.invoice_number}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          aria-label={`Eliminar ${invoice.invoice_number}`}
                        >
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

        <InvoiceEditorModal
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open)
            if (!open) setSelectedInvoice(null)
          }}
          invoice={selectedInvoice}
          onSave={() => {
            void loadInvoices()
            setSelectedInvoice(null)
          }}
        />
      </div>
    </AppLayout>
  )
}
