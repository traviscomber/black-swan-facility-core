"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { CreditCard, FileText, Search, ShieldX } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatClp } from "@/lib/money"

interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  customer_name: string
  customer_email: string | null
  total_amount: number
  amount_paid: number
  payment_status: string
  status: string
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function loadInvoices() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/bookings/invoices")
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar las facturas")
      setInvoices(Array.isArray(data) ? data : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las facturas")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInvoices()
  }, [])

  async function voidInvoice(invoice: Invoice) {
    if (!confirm(`¿Anular la factura ${invoice.invoice_number}? Esta acción conserva el registro.`)) return

    setError(null)
    try {
      const response = await fetch(`/api/bookings/invoices/${invoice.id}`, { method: "DELETE" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "No se pudo anular la factura")
      await loadInvoices()
    } catch (voidError) {
      setError(voidError instanceof Error ? voidError.message : "No se pudo anular la factura")
    }
  }

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return invoices.filter((invoice) =>
      !term
      || invoice.invoice_number.toLowerCase().includes(term)
      || invoice.customer_name.toLowerCase().includes(term)
      || invoice.customer_email?.toLowerCase().includes(term),
    )
  }, [invoices, searchTerm])

  const metrics = useMemo(() => filteredInvoices.reduce((acc, invoice) => {
    const total = Number(invoice.total_amount ?? 0)
    const paid = Number(invoice.amount_paid ?? 0)
    return {
      issued: acc.issued + (invoice.status === "void" || invoice.status === "cancelled" ? 0 : total),
      paid: acc.paid + paid,
      balance: acc.balance + Math.max(0, total - paid),
    }
  }, { issued: 0, paid: 0, balance: 0 }), [filteredInvoices])

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Facturas</h1>
            <p className="text-muted-foreground">Registro financiero inmutable y conciliado con pagos.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/bookings/charges"><FileText className="mr-2 h-4 w-4" />Generar desde cargos</Link></Button>
            <Button asChild><Link href="/bookings/payments"><CreditCard className="mr-2 h-4 w-4" />Pagos</Link></Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric title="Facturado" value={formatClp(metrics.issued)} />
          <Metric title="Pagado" value={formatClp(metrics.paid)} />
          <Metric title="Saldo" value={formatClp(metrics.balance)} />
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar factura, cliente o email"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}

        <Card>
          <CardHeader><CardTitle>Registro ({filteredInvoices.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[940px] text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Emisión</th>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Pagado</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Cargando facturas...</td></tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">No hay facturas registradas.</td></tr>
                ) : filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-semibold">{invoice.invoice_number}</td>
                    <td className="px-4 py-3"><div>{invoice.customer_name}</div><div className="text-xs text-muted-foreground">{invoice.customer_email || "—"}</div></td>
                    <td className="px-4 py-3">{format(new Date(`${invoice.invoice_date}T00:00:00`), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3">{format(new Date(`${invoice.due_date}T00:00:00`), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatClp(invoice.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatClp(invoice.amount_paid)}</td>
                    <td className="px-4 py-3"><InvoiceBadge invoice={invoice} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => voidInvoice(invoice)}
                        disabled={invoice.status === "void" || invoice.status === "cancelled" || Number(invoice.amount_paid) > 0}
                      >
                        <ShieldX className="mr-2 h-4 w-4" />Anular
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
}

function InvoiceBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.status === "void" || invoice.status === "cancelled") return <Badge variant="destructive">Anulada</Badge>
  if (invoice.payment_status === "paid") return <Badge className="bg-emerald-600">Pagada</Badge>
  if (invoice.payment_status === "partial") return <Badge className="bg-amber-500">Parcial</Badge>
  if (invoice.payment_status === "overdue") return <Badge className="bg-red-600">Vencida</Badge>
  return <Badge variant="secondary">Pendiente</Badge>
}
