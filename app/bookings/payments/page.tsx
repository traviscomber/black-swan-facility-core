"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, CircleDollarSign, CreditCard, Plus, Search, WalletCards } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { PermissionGate } from "@/components/access/access-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Payment {
  id: string
  reservation_id: string
  amount: number
  payment_method?: string | null
  payment_status?: string | null
  transaction_id?: string | null
  paid_at?: string | null
  created_at: string
}

interface Reservation {
  id: string
  guest_name: string
  guest_email?: string | null
  check_in: string
  check_out: string
  status: string
  payment_status?: string | null
  total_amount?: number | null
  payments?: Payment[]
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

function paymentStatus(total: number, paid: number) {
  if (total <= 0 || paid <= 0) return "pending"
  if (paid >= total) return "paid"
  return "partial"
}

export default function BookingPaymentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { can, canAccessDepartment } = useEffectiveAccess()
  const canRecordPayment = can("payments.record") && canAccessDepartment("finance")
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("transfer")
  const [transactionId, setTransactionId] = useState("")
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase
      .from("reservations")
      .select(`id, guest_name, guest_email, check_in, check_out, status, payment_status, total_amount, payments(id, reservation_id, amount, payment_method, payment_status, transaction_id, paid_at, created_at)`)
      .neq("status", "cancelled")
      .order("check_in", { ascending: false })
    if (queryError) setError(queryError.message)
    else setReservations((data ?? []) as Reservation[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => {
    const channel = supabase.channel("bookings-payments")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, loadData)
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const rows = useMemo(() => reservations.map((reservation) => {
    const total = Number(reservation.total_amount ?? 0)
    const paid = (reservation.payments ?? [])
      .filter((payment) => payment.payment_status !== "cancelled" && payment.payment_status !== "failed")
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
    const balance = Math.max(0, total - paid)
    return { reservation, total, paid, balance, status: paymentStatus(total, paid) }
  }), [reservations])

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch = !term || row.reservation.guest_name.toLowerCase().includes(term) || row.reservation.guest_email?.toLowerCase().includes(term)
      return matchesSearch && (filter === "all" || row.status === filter)
    })
  }, [filter, rows, search])

  const metrics = useMemo(() => rows.reduce((acc, row) => ({
    total: acc.total + row.total,
    paid: acc.paid + row.paid,
    balance: acc.balance + row.balance,
    overdue: acc.overdue + (row.balance > 0 && new Date(row.reservation.check_out) < new Date() ? row.balance : 0),
  }), { total: 0, paid: 0, balance: 0, overdue: 0 }), [rows])

  function openPayment(reservation: Reservation, balance: number) {
    if (!canRecordPayment) {
      setError("No tienes permiso para registrar pagos en este alcance.")
      return
    }
    setSelected(reservation)
    setAmount(String(balance || ""))
  }

  async function registerPayment() {
    if (!selected || !canRecordPayment) {
      setError("No tienes permiso para registrar pagos en este alcance.")
      setSelected(null)
      return
    }
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Ingresa un monto válido.")
      return
    }

    setSaving(true)
    setError(null)
    const { error: paymentError } = await supabase.rpc("record_reservation_payment", {
      p_reservation_id: selected.id,
      p_amount: numericAmount,
      p_payment_method: method,
      p_transaction_id: transactionId || null,
      p_notes: null,
    })

    if (paymentError) {
      setError(paymentError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setSelected(null)
    setAmount("")
    setTransactionId("")
    await loadData()
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight">Pagos de reservas</h1><p className="text-sm text-muted-foreground">Cobros, abonos y saldos pendientes por estadía.</p></div>
          <div className="flex gap-2"><Button variant="outline" asChild><Link href="/bookings"><ArrowLeft className="mr-2 h-4 w-4" />Calendario</Link></Button><Button variant="outline" asChild><Link href="/bookings/activities">Centro operativo</Link></Button></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Valor reservado" value={formatClp(metrics.total)} icon={<CircleDollarSign className="h-4 w-4" />} />
          <Metric title="Pagado" value={formatClp(metrics.paid)} icon={<CreditCard className="h-4 w-4" />} />
          <Metric title="Saldo pendiente" value={formatClp(metrics.balance)} icon={<WalletCards className="h-4 w-4" />} />
          <Metric title="Saldo vencido" value={formatClp(metrics.overdue)} icon={<CircleDollarSign className="h-4 w-4" />} />
        </div>

        <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar huésped o email" /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="pending">Sin pago</SelectItem><SelectItem value="partial">Pago parcial</SelectItem><SelectItem value="paid">Pagado</SelectItem></SelectContent></Select></CardContent></Card>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}

        <Card><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-sm"><thead className="border-b bg-muted/40 text-left"><tr><th className="px-4 py-3">Huésped</th><th className="px-4 py-3">Estadía</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Pagado</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acción</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Cargando pagos...</td></tr> : visibleRows.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No hay reservas para los filtros seleccionados.</td></tr> : visibleRows.map((row) => (
            <tr key={row.reservation.id} className="border-b last:border-0"><td className="px-4 py-3"><div className="font-medium">{row.reservation.guest_name}</div><div className="text-xs text-muted-foreground">{row.reservation.guest_email || "—"}</div></td><td className="px-4 py-3">{format(new Date(`${row.reservation.check_in}T00:00:00`), "dd MMM")} — {format(new Date(`${row.reservation.check_out}T00:00:00`), "dd MMM yyyy")}</td><td className="px-4 py-3 text-right">{formatClp(row.total)}</td><td className="px-4 py-3 text-right text-emerald-600">{formatClp(row.paid)}</td><td className="px-4 py-3 text-right font-semibold">{formatClp(row.balance)}</td><td className="px-4 py-3"><PaymentBadge status={row.status} /></td><td className="px-4 py-3 text-right"><PermissionGate action="payments.record" department="finance"><Button size="sm" onClick={() => openPayment(row.reservation, row.balance)} disabled={row.balance <= 0}><Plus className="mr-2 h-4 w-4" />Registrar pago</Button></PermissionGate></td></tr>
          ))}
        </tbody></table></CardContent></Card>
      </div>

      <Dialog open={!!selected && canRecordPayment} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>{selected && <div className="space-y-4"><div><p className="text-xs text-muted-foreground">Reserva</p><p className="font-medium">{selected.guest_name}</p></div><div className="space-y-2"><Label>Monto</Label><Input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="space-y-2"><Label>Método</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="transfer">Transferencia</SelectItem><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="card">Tarjeta</SelectItem><SelectItem value="other">Otro</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Referencia</Label><Input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="N.º de operación o comprobante" /></div></div>}<DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button><Button onClick={registerPayment} disabled={saving || !canRecordPayment}>{saving ? "Guardando..." : "Registrar pago"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge className="bg-emerald-600">Pagado</Badge>
  if (status === "partial") return <Badge className="bg-amber-500">Parcial</Badge>
  return <Badge variant="secondary">Pendiente</Badge>
}