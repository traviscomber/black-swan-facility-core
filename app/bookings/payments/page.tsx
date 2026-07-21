"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, CircleDollarSign, CreditCard, Plus, Search, WalletCards } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatClp, parseClpInput } from "@/lib/money"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface InvoicePayment {
  id: string
  amount: number
  payment_method: string | null
  transaction_id: string | null
  payment_date: string | null
}

interface Invoice {
  id: string
  reservation_id: string | null
  invoice_number: string
  customer_name: string
  customer_email: string | null
  invoice_date: string
  due_date: string
  status: string
  payment_status: string
  total_amount: number
  amount_paid: number
  invoice_payments?: InvoicePayment[]
}

export default function BookingPaymentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("transfer")
  const [transactionId, setTransactionId] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from("invoices")
      .select(`
        id,
        reservation_id,
        invoice_number,
        customer_name,
        customer_email,
        invoice_date,
        due_date,
        status,
        payment_status,
        total_amount,
        amount_paid,
        invoice_payments(id, amount, payment_method, transaction_id, payment_date)
      `)
      .not("status", "in", "(void,cancelled)")
      .order("invoice_date", { ascending: false })

    if (queryError) setError(queryError.message)
    else setInvoices((data ?? []) as Invoice[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const channel = supabase
      .channel("invoice-payment-ledger")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoice_payments" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, loadData)
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadData, supabase])

  const rows = useMemo(() => invoices.map((invoice) => {
    const total = Number(invoice.total_amount ?? 0)
    const paid = Number(invoice.amount_paid ?? 0)
    const balance = Math.max(0, total - paid)
    const status = balance <= 0 ? "paid" : paid > 0 ? "partial" : new Date(`${invoice.due_date}T23:59:59`) < new Date() ? "overdue" : "pending"
    return { invoice, total, paid, balance, status }
  }), [invoices])

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch = !term
        || row.invoice.invoice_number.toLowerCase().includes(term)
        || row.invoice.customer_name.toLowerCase().includes(term)
        || row.invoice.customer_email?.toLowerCase().includes(term)
      return matchesSearch && (filter === "all" || row.status === filter)
    })
  }, [filter, rows, search])

  const metrics = useMemo(() => rows.reduce((acc, row) => ({
    total: acc.total + row.total,
    paid: acc.paid + row.paid,
    balance: acc.balance + row.balance,
    overdue: acc.overdue + (row.status === "overdue" ? row.balance : 0),
  }), { total: 0, paid: 0, balance: 0, overdue: 0 }), [rows])

  async function registerPayment() {
    if (!selected) return
    const numericAmount = parseClpInput(amount)
    const balance = Math.max(0, Number(selected.total_amount) - Number(selected.amount_paid))

    if (numericAmount === null || numericAmount <= 0) {
      setError("Ingresa un monto CLP entero y positivo.")
      return
    }

    if (numericAmount > balance) {
      setError("El pago no puede superar el saldo pendiente.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/bookings/invoice-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: selected.id,
          amount: numericAmount,
          payment_method: method,
          transaction_id: transactionId || null,
          notes: notes || null,
          idempotency_key: crypto.randomUUID(),
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "No se pudo registrar el pago")

      setSelected(null)
      setAmount("")
      setTransactionId("")
      setNotes("")
      await loadData()
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "No se pudo registrar el pago")
    } finally {
      setSaving(false)
    }
  }

  function openPayment(invoice: Invoice) {
    const balance = Math.max(0, Number(invoice.total_amount) - Number(invoice.amount_paid))
    setSelected(invoice)
    setAmount(String(balance || ""))
    setTransactionId("")
    setNotes("")
    setError(null)
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pagos y conciliación</h1>
            <p className="text-sm text-muted-foreground">Libro de facturas, abonos y saldos pendientes.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/bookings"><ArrowLeft className="mr-2 h-4 w-4" />Calendario</Link></Button>
            <Button variant="outline" asChild><Link href="/bookings/invoices">Facturas</Link></Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Total facturado" value={formatClp(metrics.total)} icon={<CircleDollarSign className="h-4 w-4" />} />
          <Metric title="Pagado" value={formatClp(metrics.paid)} icon={<CreditCard className="h-4 w-4" />} />
          <Metric title="Saldo pendiente" value={formatClp(metrics.balance)} icon={<WalletCards className="h-4 w-4" />} />
          <Metric title="Saldo vencido" value={formatClp(metrics.overdue)} icon={<CircleDollarSign className="h-4 w-4" />} />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar factura, huésped o email" />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="partial">Pago parcial</SelectItem>
                <SelectItem value="paid">Pagados</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Pagado</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Cargando libro financiero...</td></tr>
                ) : visibleRows.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">No hay facturas para los filtros seleccionados.</td></tr>
                ) : visibleRows.map((row) => (
                  <tr key={row.invoice.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{row.invoice.invoice_number}</td>
                    <td className="px-4 py-3"><div className="font-medium">{row.invoice.customer_name}</div><div className="text-xs text-muted-foreground">{row.invoice.customer_email || "—"}</div></td>
                    <td className="px-4 py-3">{format(new Date(`${row.invoice.due_date}T00:00:00`), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3 text-right">{formatClp(row.total)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatClp(row.paid)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatClp(row.balance)}</td>
                    <td className="px-4 py-3"><PaymentBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-right"><Button size="sm" onClick={() => openPayment(row.invoice)} disabled={row.balance <= 0}><Plus className="mr-2 h-4 w-4" />Registrar pago</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4">
            <div><p className="text-xs text-muted-foreground">Factura</p><p className="font-medium">{selected.invoice_number} · {selected.customer_name}</p></div>
            <div className="space-y-2"><Label>Monto CLP</Label><Input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label>Método</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="transfer">Transferencia</SelectItem><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="card">Tarjeta</SelectItem><SelectItem value="other">Otro</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Referencia</Label><Input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="N.º de operación o comprobante" /></div>
            <div className="space-y-2"><Label>Notas</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observación opcional" /></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button><Button onClick={registerPayment} disabled={saving}>{saving ? "Guardando..." : "Registrar pago"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge className="bg-emerald-600">Pagado</Badge>
  if (status === "partial") return <Badge className="bg-amber-500">Parcial</Badge>
  if (status === "overdue") return <Badge className="bg-red-600">Vencido</Badge>
  return <Badge variant="secondary">Pendiente</Badge>
}
