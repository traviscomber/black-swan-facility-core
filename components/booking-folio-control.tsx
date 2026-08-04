"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CreditCard, ReceiptText, RefreshCw, Scale } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Reservation = {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  payment_status: string | null
}

type FolioSummary = {
  lodging: number
  servicesSubtotal: number
  servicesTax: number
  servicesTotal: number
  fees: number
  discounts: number
  credits: number
  refunds: number
  grossTotal: number
  payments: number
  balance: number
  paymentStatus: string
}

type Folio = {
  reservation: {
    id: string
    guestName: string
    checkIn: string
    checkOut: string
    status: string
    paymentStatus: string
  }
  summary: FolioSummary
  services: Array<{ id: string; name: string; quantity: number; total_amount: number | null; service_status: string; created_at: string }>
  adjustments: Array<{ id: string; adjustment_type: string; description: string; amount: number; created_at: string; voided_at: string | null }>
  payments: Array<{ id: string; amount: number; payment_method: string | null; payment_status: string | null; paid_at: string | null; reversed_at: string | null }>
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  partial: "Pago parcial",
  paid: "Pagado",
  not_required: "Sin cobro",
}

const ADJUSTMENT_LABELS: Record<string, string> = {
  discount: "Descuento",
  credit: "Crédito",
  fee: "Cargo adicional",
  refund: "Reembolso",
}

function formatClp(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

export function BookingFolioControl() {
  const supabase = useMemo(() => createClient(), [])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationId, setReservationId] = useState("")
  const [folio, setFolio] = useState<Folio | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [transactionId, setTransactionId] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")

  const [adjustmentType, setAdjustmentType] = useState("discount")
  const [adjustmentDescription, setAdjustmentDescription] = useState("")
  const [adjustmentAmount, setAdjustmentAmount] = useState("")

  const loadReservations = useCallback(async () => {
    const [{ data: authData }, reservationsResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("reservations")
        .select("id, guest_name, check_in, check_out, status, payment_status")
        .not("status", "in", "(cancelled,canceled,void,voided,no_show)")
        .order("check_in"),
    ])
    if (reservationsResult.error) return toast.error(reservationsResult.error.message)
    const role = String(authData.user?.app_metadata?.procurement_role ?? "")
    setIsAdmin(role === "admin")
    setReservations((reservationsResult.data ?? []) as Reservation[])
  }, [supabase])

  const loadFolio = useCallback(async (id: string) => {
    if (!id) {
      setFolio(null)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc("get_reservation_folio", { p_reservation_id: id })
    setLoading(false)
    if (error) {
      setFolio(null)
      return toast.error(error.message)
    }
    setFolio(data as Folio)
  }, [supabase])

  useEffect(() => { void loadReservations() }, [loadReservations])
  useEffect(() => { void loadFolio(reservationId) }, [loadFolio, reservationId])

  async function recordPayment() {
    if (!reservationId) return toast.error("Selecciona una reserva")
    if (!paymentMethod.trim()) return toast.error("Indica el método de pago")
    if (Number(paymentAmount) <= 0) return toast.error("Ingresa un monto válido")

    setSaving(true)
    const { data, error } = await supabase.rpc("record_reservation_payment", {
      p_reservation_id: reservationId,
      p_amount: Number(paymentAmount),
      p_payment_method: paymentMethod.trim(),
      p_transaction_id: transactionId.trim() || null,
      p_notes: paymentNotes.trim() || null,
    })
    setSaving(false)
    if (error) return toast.error(error.message)

    const payload = data as { folio?: Folio }
    if (payload.folio) setFolio(payload.folio)
    else await loadFolio(reservationId)
    setPaymentAmount("")
    setTransactionId("")
    setPaymentNotes("")
    toast.success("Pago registrado")
  }

  async function addAdjustment() {
    if (!reservationId) return toast.error("Selecciona una reserva")
    if (!adjustmentDescription.trim()) return toast.error("Describe el ajuste")
    if (Number(adjustmentAmount) <= 0) return toast.error("Ingresa un monto válido")

    setSaving(true)
    const { data, error } = await supabase.rpc("add_reservation_financial_adjustment", {
      p_reservation_id: reservationId,
      p_adjustment_type: adjustmentType,
      p_description: adjustmentDescription.trim(),
      p_amount: Number(adjustmentAmount),
    })
    setSaving(false)
    if (error) return toast.error(error.message)

    const payload = data as { folio?: Folio }
    if (payload.folio) setFolio(payload.folio)
    else await loadFolio(reservationId)
    setAdjustmentDescription("")
    setAdjustmentAmount("")
    toast.success("Ajuste financiero registrado")
  }

  const summary = folio?.summary

  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="h-4 w-4" /> Folio y cuenta de la estadía
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => reservationId && void loadFolio(reservationId)} disabled={!reservationId || loading}>
            <RefreshCw className="mr-2 h-4 w-4" />Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Reserva</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={reservationId} onChange={(event) => setReservationId(event.target.value)}>
            <option value="">Seleccionar reserva</option>
            {reservations.map((item) => (
              <option key={item.id} value={item.id}>{item.guest_name} · {item.check_in} → {item.check_out}</option>
            ))}
          </select>
        </div>

        {loading && <div className="rounded-lg border p-4 text-sm text-muted-foreground">Calculando folio…</div>}

        {!loading && reservationId && summary && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Alojamiento registrado</p><p className="mt-1 text-lg font-semibold">{formatClp(summary.lodging)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Servicios con impuestos</p><p className="mt-1 text-lg font-semibold">{formatClp(summary.servicesTotal)}</p><p className="text-xs text-muted-foreground">Impuestos: {formatClp(summary.servicesTax)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Pagos confirmados</p><p className="mt-1 text-lg font-semibold">{formatClp(summary.payments)}</p></div>
              <div className="rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Saldo pendiente</p><Badge variant={summary.balance > 0 ? "destructive" : "secondary"}>{STATUS_LABELS[summary.paymentStatus] ?? summary.paymentStatus}</Badge></div><p className="mt-1 text-lg font-semibold">{formatClp(summary.balance)}</p></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Cargos adicionales</span><strong className="mt-1 block">{formatClp(summary.fees)}</strong></div>
              <div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Descuentos</span><strong className="mt-1 block">-{formatClp(summary.discounts)}</strong></div>
              <div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Créditos</span><strong className="mt-1 block">-{formatClp(summary.credits)}</strong></div>
              <div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Reembolsos</span><strong className="mt-1 block">{formatClp(summary.refunds)}</strong></div>
              <div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Total bruto</span><strong className="mt-1 block">{formatClp(summary.grossTotal)}</strong></div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 font-medium"><CreditCard className="h-4 w-4" /> Registrar pago</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Monto</Label><Input type="number" min="1" step="1" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Método</Label><Input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} placeholder="Transferencia, tarjeta, efectivo" /></div>
                  <div className="space-y-1.5"><Label>ID de transacción</Label><Input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="Opcional" /></div>
                  <div className="space-y-1.5"><Label>Notas</Label><Input value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Referencia o comprobante" /></div>
                </div>
                <div className="flex justify-end"><Button onClick={() => void recordPayment()} disabled={saving}>Registrar pago</Button></div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 font-medium"><Scale className="h-4 w-4" /> Ajuste financiero</div>
                {!isAdmin ? (
                  <p className="text-sm text-muted-foreground">Solo administración puede registrar descuentos, créditos, cargos adicionales o reembolsos.</p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label>Tipo</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value)}>{Object.entries(ADJUSTMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                      <div className="space-y-1.5"><Label>Monto</Label><Input type="number" min="1" step="1" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} /></div>
                      <div className="space-y-1.5 sm:col-span-2"><Label>Descripción</Label><Input value={adjustmentDescription} onChange={(event) => setAdjustmentDescription(event.target.value)} placeholder="Motivo obligatorio" /></div>
                    </div>
                    <div className="flex justify-end"><Button variant="outline" onClick={() => void addAdjustment()} disabled={saving}>Registrar ajuste</Button></div>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2"><h3 className="text-sm font-medium">Servicios</h3>{folio.services.length === 0 ? <p className="text-sm text-muted-foreground">Sin servicios cargados.</p> : folio.services.map((item) => <div key={item.id} className="rounded-md border p-2 text-sm"><div className="flex justify-between gap-3"><span>{item.name} × {Number(item.quantity)}</span><strong>{formatClp(item.total_amount)}</strong></div><span className="text-xs text-muted-foreground">{item.service_status}</span></div>)}</div>
              <div className="space-y-2"><h3 className="text-sm font-medium">Ajustes</h3>{folio.adjustments.length === 0 ? <p className="text-sm text-muted-foreground">Sin ajustes registrados.</p> : folio.adjustments.map((item) => <div key={item.id} className="rounded-md border p-2 text-sm"><div className="flex justify-between gap-3"><span>{ADJUSTMENT_LABELS[item.adjustment_type] ?? item.adjustment_type}</span><strong>{formatClp(item.amount)}</strong></div><p className="text-xs text-muted-foreground">{item.description}</p></div>)}</div>
              <div className="space-y-2"><h3 className="text-sm font-medium">Pagos</h3>{folio.payments.length === 0 ? <p className="text-sm text-muted-foreground">Sin pagos registrados.</p> : folio.payments.map((item) => <div key={item.id} className="rounded-md border p-2 text-sm"><div className="flex justify-between gap-3"><span>{item.payment_method || "Método no informado"}</span><strong>{formatClp(item.amount)}</strong></div><span className="text-xs text-muted-foreground">{item.reversed_at ? "Revertido" : item.payment_status ?? "Registrado"}</span></div>)}</div>
            </div>
          </>
        )}

        {!loading && !reservationId && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Selecciona una reserva para calcular su folio con datos reales.</div>}
      </CardContent>
    </Card>
  )
}
