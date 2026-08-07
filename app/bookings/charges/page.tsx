"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { FileText, Minus, Plus, ReceiptText, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/lib/hooks/use-language"
import { chargesCopy, fillChargesCopy } from "@/lib/translations/charges"

interface Reservation {
  id: string
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  status: string
  total_amount: number | null
}

interface Extra {
  id: string
  name: string
  unit: string
  price: number
  tax_rate: number
  is_active: boolean
}

interface ReservationExtra {
  id: string
  reservation_id: string
  extra_id: string | null
  name: string
  unit: string
  quantity: number
  unit_price: number
  tax_rate: number
  total_amount: number
}

interface ExistingInvoice {
  id: string
  invoice_number: string
  status: string
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value)
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default function ReservationChargesPage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = chargesCopy[language]
  const localize = (href: string) => `/${language}${href}`
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [charges, setCharges] = useState<ReservationExtra[]>([])
  const [selectedReservationId, setSelectedReservationId] = useState("")
  const [selectedExtraId, setSelectedExtraId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [invoicing, setInvoicing] = useState(false)
  const [createdInvoice, setCreatedInvoice] = useState<ExistingInvoice | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [reservationsResult, extrasResult, chargesResult] = await Promise.all([
      supabase
        .from("reservations")
        .select("id, guest_name, guest_email, guest_phone, check_in, check_out, status, total_amount")
        .neq("status", "cancelled")
        .order("check_in", { ascending: false })
        .limit(200),
      supabase
        .from("booking_extras")
        .select("id, name, unit, price, tax_rate, is_active")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("reservation_extras")
        .select("id, reservation_id, extra_id, name, unit, quantity, unit_price, tax_rate, total_amount")
        .order("created_at", { ascending: false }),
    ])

    const firstError = reservationsResult.error || extrasResult.error || chargesResult.error
    if (firstError) setError(firstError.message)
    else {
      setReservations((reservationsResult.data ?? []) as Reservation[])
      setExtras((extrasResult.data ?? []) as Extra[])
      setCharges((chargesResult.data ?? []) as ReservationExtra[])
      if (!selectedReservationId && reservationsResult.data?.[0]?.id) {
        setSelectedReservationId(reservationsResult.data[0].id)
      }
    }
    setLoading(false)
  }, [selectedReservationId, supabase])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => { setCreatedInvoice(null) }, [selectedReservationId])
  useEffect(() => {
    const channel = supabase
      .channel("reservation-extra-charges")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservation_extras" }, () => void loadData())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const filteredReservations = useMemo(() => {
    const term = search.trim().toLowerCase()
    return reservations.filter((reservation) =>
      !term || reservation.guest_name.toLowerCase().includes(term) || reservation.check_in.includes(term) || reservation.check_out.includes(term),
    )
  }, [reservations, search])

  const selectedReservation = reservations.find((reservation) => reservation.id === selectedReservationId)
  const selectedCharges = charges.filter((charge) => charge.reservation_id === selectedReservationId)
  const lodgingTotal = Number(selectedReservation?.total_amount ?? 0)
  const extrasSubtotal = selectedCharges.reduce((sum, charge) => sum + Number(charge.total_amount), 0)
  const taxTotal = selectedCharges.reduce((sum, charge) => sum + Number(charge.total_amount) * (Number(charge.tax_rate) / 100), 0)
  const grandTotal = lodgingTotal + extrasSubtotal + taxTotal

  async function addCharge() {
    const extra = extras.find((item) => item.id === selectedExtraId)
    if (!selectedReservationId || !extra || quantity <= 0) return
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from("reservation_extras").insert({ reservation_id: selectedReservationId, extra_id: extra.id, name: extra.name, unit: extra.unit, quantity, unit_price: extra.price, tax_rate: extra.tax_rate })
    if (insertError) setError(insertError.message)
    else { setSelectedExtraId(""); setQuantity(1); await loadData() }
    setSaving(false)
  }

  async function changeQuantity(charge: ReservationExtra, nextQuantity: number) {
    if (nextQuantity <= 0) return
    const { error: updateError } = await supabase.from("reservation_extras").update({ quantity: nextQuantity }).eq("id", charge.id)
    if (updateError) setError(updateError.message); else await loadData()
  }

  async function removeCharge(id: string) {
    const { error: deleteError } = await supabase.from("reservation_extras").delete().eq("id", id)
    if (deleteError) setError(deleteError.message); else await loadData()
  }

  async function createInvoice() {
    if (!selectedReservation) return
    setInvoicing(true); setError(null); setCreatedInvoice(null)
    try {
      const existingResponse = await fetch(`/api/bookings/invoices?reservationId=${selectedReservation.id}`)
      if (!existingResponse.ok) throw new Error(copy.verifyInvoicesFailed)
      const existingInvoices = (await existingResponse.json()) as ExistingInvoice[]
      const reusableInvoice = existingInvoices.find((invoice) => invoice.status !== "cancelled" && invoice.status !== "void")
      if (reusableInvoice) { setCreatedInvoice(reusableInvoice); return }

      const lineItems = [
        { type: "lodging", description: `Alojamiento ${selectedReservation.check_in} → ${selectedReservation.check_out}`, quantity: 1, unit_price: lodgingTotal, tax_rate: 0, subtotal: lodgingTotal, tax_amount: 0, total: lodgingTotal },
        ...selectedCharges.map((charge) => {
          const subtotal = Number(charge.total_amount)
          const taxAmount = subtotal * (Number(charge.tax_rate) / 100)
          return { type: "extra", extra_id: charge.extra_id, description: charge.name, unit: charge.unit, quantity: Number(charge.quantity), unit_price: Number(charge.unit_price), tax_rate: Number(charge.tax_rate), subtotal, tax_amount: taxAmount, total: subtotal + taxAmount }
        }),
      ]
      const invoiceDate = new Date(); const dueDate = new Date(invoiceDate); dueDate.setDate(dueDate.getDate() + 7)
      const response = await fetch("/api/bookings/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_id: selectedReservation.id, invoice_date: toIsoDate(invoiceDate), due_date: toIsoDate(dueDate), status: "draft", customer_name: selectedReservation.guest_name, customer_email: selectedReservation.guest_email, customer_phone: selectedReservation.guest_phone, line_items: lineItems, subtotal: lodgingTotal + extrasSubtotal, discount_amount: 0, discount_percentage: 0, tax_rate: 0, tax_amount: taxTotal, additional_fees: 0, total_amount: grandTotal, payment_status: "pending", amount_paid: 0, notes: "Generada desde los cargos de la reserva." }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || copy.createInvoiceFailed)
      setCreatedInvoice(payload as ExistingInvoice)
    } catch (invoiceError) { setError(invoiceError instanceof Error ? invoiceError.message : copy.createInvoiceFailed) }
    finally { setInvoicing(false) }
  }

  return <div className="min-h-screen bg-background p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1><p className="text-sm text-muted-foreground">{copy.subtitle}</p></div><Button onClick={createInvoice} disabled={!selectedReservation || invoicing}><FileText className="mr-2 h-4 w-4" />{invoicing ? copy.generating : copy.generateInvoice}</Button></div>
    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}
    {createdInvoice && <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm md:flex-row md:items-center md:justify-between"><span>{fillChargesCopy(copy.invoiceReady, { number: createdInvoice.invoice_number, status: createdInvoice.status })}</span><Button asChild size="sm" variant="outline"><Link href={localize("/bookings/invoices")}>{copy.openInvoices}</Link></Button></div>}
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><Card><CardHeader><CardTitle>{copy.reservations}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder={copy.search} /></div><div className="max-h-[650px] space-y-2 overflow-auto">{loading ? <p className="text-sm text-muted-foreground">{copy.loading}</p> : filteredReservations.map((reservation) => <button key={reservation.id} onClick={() => setSelectedReservationId(reservation.id)} className={`w-full rounded-lg border p-3 text-left ${selectedReservationId === reservation.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}><div className="flex items-center justify-between gap-2"><span className="font-medium">{reservation.guest_name}</span><Badge variant="secondary">{reservation.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{reservation.check_in} → {reservation.check_out}</p></button>)}</div></CardContent></Card>
      <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title={copy.lodging} value={formatClp(lodgingTotal)} /><Metric title={copy.extras} value={formatClp(extrasSubtotal)} /><Metric title={copy.extraTaxes} value={formatClp(taxTotal)} /><Metric title={copy.billableTotal} value={formatClp(grandTotal)} /></div>
        <Card><CardHeader><CardTitle>{copy.addCharge}</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-[1fr_140px_auto]"><Select value={selectedExtraId} onValueChange={setSelectedExtraId}><SelectTrigger><SelectValue placeholder={copy.selectExtra} /></SelectTrigger><SelectContent>{extras.map((extra) => <SelectItem key={extra.id} value={extra.id}>{extra.name} · {formatClp(Number(extra.price))}</SelectItem>)}</SelectContent></Select><Input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /><Button onClick={addCharge} disabled={!selectedReservationId || !selectedExtraId || saving}><Plus className="mr-2 h-4 w-4" />{copy.add}</Button></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" />{copy.chargeDetails}</CardTitle>{selectedReservation && <span className="text-sm text-muted-foreground">{selectedReservation.guest_name}</span>}</CardHeader><CardContent>{selectedCharges.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{copy.noExtras}</p> : <div className="space-y-3">{selectedCharges.map((charge) => <div key={charge.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-medium">{charge.name}</p><p className="text-xs text-muted-foreground">{formatClp(Number(charge.unit_price))} · {charge.unit} · {copy.tax} {Number(charge.tax_rate)}%</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => changeQuantity(charge, Number(charge.quantity) - 1)}><Minus className="h-4 w-4" /></Button><span className="min-w-10 text-center font-medium">{Number(charge.quantity)}</span><Button variant="outline" size="icon" onClick={() => changeQuantity(charge, Number(charge.quantity) + 1)}><Plus className="h-4 w-4" /></Button><span className="min-w-28 text-right font-semibold">{formatClp(Number(charge.total_amount))}</span><Button variant="ghost" size="icon" onClick={() => removeCharge(charge.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}</CardContent></Card>
      </div></div>
  </div></div>
}

function Metric({ title, value }: { title: string; value: string }) { return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card> }
