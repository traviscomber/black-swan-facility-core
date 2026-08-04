"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, FileCheck2, RefreshCw, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Reservation = { id: string; guest_name: string; check_in: string; check_out: string; status: string }
type Folio = { summary: { grossTotal: number; payments: number; balance: number; paymentStatus: string } }
type FinalInvoice = { id: string; invoice_number: string; total_amount: number; amount_paid: number; balance_due: number; payment_status: string; finalized_at: string }

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(value || 0))
}

export function BookingInvoiceCloseControl() {
  const supabase = useMemo(() => createClient(), [])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationId, setReservationId] = useState("")
  const [folio, setFolio] = useState<Folio | null>(null)
  const [invoice, setInvoice] = useState<FinalInvoice | null>(null)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  const loadReservations = useCallback(async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select("id, guest_name, check_in, check_out, status")
      .not("status", "in", "(cancelled,canceled,void,voided,no_show)")
      .order("check_out")
    if (error) return toast.error(error.message)
    setReservations((data ?? []) as Reservation[])
  }, [supabase])

  const loadFinancialClose = useCallback(async (id: string) => {
    if (!id) {
      setFolio(null)
      setInvoice(null)
      return
    }
    setLoading(true)
    const [folioResult, invoiceResult] = await Promise.all([
      supabase.rpc("get_reservation_folio", { p_reservation_id: id }),
      supabase.rpc("get_reservation_final_invoice", { p_reservation_id: id }),
    ])
    setLoading(false)
    const error = folioResult.error || invoiceResult.error
    if (error) return toast.error(error.message)
    setFolio(folioResult.data as Folio)
    setInvoice((invoiceResult.data ?? null) as FinalInvoice | null)
  }, [supabase])

  useEffect(() => { void loadReservations() }, [loadReservations])
  useEffect(() => { void loadFinancialClose(reservationId) }, [loadFinancialClose, reservationId])

  async function finalizeInvoice() {
    if (!reservationId) return toast.error("Selecciona una reserva")
    setLoading(true)
    const { error } = await supabase.rpc("generate_reservation_invoice", {
      p_reservation_id: reservationId,
      p_due_date: new Date().toISOString().slice(0, 10),
      p_notes: notes || null,
    })
    setLoading(false)
    if (error) return toast.error(error.message)
    toast.success("Factura final generada")
    setNotes("")
    await loadFinancialClose(reservationId)
  }

  const canCheckout = Boolean(invoice && Number(invoice.balance_due) <= 0)

  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-4 w-4" /> Facturación y cierre de cuenta</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void loadFinancialClose(reservationId)} disabled={!reservationId || loading}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Reserva</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={reservationId} onChange={(event) => setReservationId(event.target.value)}>
              <option value="">Seleccionar reserva</option>
              {reservations.map((item) => <option key={item.id} value={item.id}>{item.guest_name} · {item.check_in} → {item.check_out}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Nota de cierre</Label>
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observación opcional para la factura" disabled={Boolean(invoice)} />
          </div>
        </div>

        {folio && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Total folio</div><div className="text-lg font-semibold">{clp(folio.summary.grossTotal)}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Pagos confirmados</div><div className="text-lg font-semibold">{clp(folio.summary.payments)}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Saldo</div><div className="text-lg font-semibold">{clp(folio.summary.balance)}</div></div>
          </div>
        )}

        {invoice ? (
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">Factura {invoice.invoice_number}</div>
                <div className="text-sm text-muted-foreground">Líneas congeladas al {new Date(invoice.finalized_at).toLocaleString("es-CL")}</div>
              </div>
              <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${canCheckout ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                {canCheckout ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                {canCheckout ? "Habilitada para check-out" : `Saldo pendiente ${clp(invoice.balance_due)}`}
              </div>
            </div>
          </div>
        ) : reservationId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
            <div>
              <div className="font-medium">Factura final pendiente</div>
              <div className="text-sm text-muted-foreground">Al generarla, alojamiento, servicios y ajustes quedan congelados para el cierre.</div>
            </div>
            <Button onClick={() => void finalizeInvoice()} disabled={loading}>{loading ? "Generando…" : "Generar factura final"}</Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
