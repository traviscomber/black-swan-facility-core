"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Download, Printer, Mail } from "lucide-react"
import { format } from "date-fns"

interface InvoiceData {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  guest: {
    name: string
    email: string | null
    phone: string | null
  }
  reservation: {
    checkIn: string
    checkOut: string
    nights: number
    guests: number
    room: string
  }
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  tax: number
  total: number
  paymentStatus: string
  specialRequests: string | null
}

interface ReservationInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservationId: string | null
}

export function ReservationInvoiceModal({ open, onOpenChange, reservationId }: ReservationInvoiceModalProps) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && reservationId) {
      loadInvoice()
    }
  }, [open, reservationId])

  async function loadInvoice() {
    setLoading(true)
    try {
      const response = await fetch(`/api/bookings/invoice?reservationId=${reservationId}`)
      const data = await response.json()
      setInvoice(data)
    } catch (error) {
      console.error("Error loading invoice:", error)
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  function handleDownload() {
    alert("Download PDF functionality - Coming soon")
  }

  function handleEmailInvoice() {
    alert("Email invoice functionality - Coming soon")
  }

  if (!invoice || loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading invoice...</div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice {invoice.invoiceNumber}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button size="sm" onClick={handleEmailInvoice}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Card className="print:shadow-none">
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">Black Swan Facility</h2>
                <p className="text-sm text-muted-foreground">Accommodation Invoice</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Invoice Number</div>
                <div className="text-lg font-bold">{invoice.invoiceNumber}</div>
                <Badge className="mt-2" variant={invoice.paymentStatus === "paid" ? "default" : "secondary"}>
                  {invoice.paymentStatus}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Bill To:</h3>
                <div className="text-sm space-y-1">
                  <div className="font-medium">{invoice.guest.name}</div>
                  {invoice.guest.email && <div className="text-muted-foreground">{invoice.guest.email}</div>}
                  {invoice.guest.phone && <div className="text-muted-foreground">{invoice.guest.phone}</div>}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Reservation Details:</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-in:</span>
                    <span className="font-medium">{format(new Date(invoice.reservation.checkIn), "MMM dd, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-out:</span>
                    <span className="font-medium">
                      {format(new Date(invoice.reservation.checkOut), "MMM dd, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Room/Bed:</span>
                    <span className="font-medium">{invoice.reservation.room}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guests:</span>
                    <span className="font-medium">{invoice.reservation.guests}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-semibold">Description</th>
                    <th className="text-right py-2 font-semibold">Qty</th>
                    <th className="text-right py-2 font-semibold">Unit Price</th>
                    <th className="text-right py-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3">{item.description}</td>
                      <td className="text-right py-3">{item.quantity}</td>
                      <td className="text-right py-3">${item.unitPrice.toFixed(2)}</td>
                      <td className="text-right py-3">${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>${invoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>${invoice.tax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {invoice.specialRequests && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Special Requests:</h3>
                  <p className="text-sm text-muted-foreground">{invoice.specialRequests}</p>
                </div>
              </>
            )}

            <Separator />
            <div className="text-center text-sm text-muted-foreground">
              <p>Thank you for choosing Black Swan Facility</p>
              <p className="text-xs mt-1">For inquiries, contact: info@blackswanfacility.com</p>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
