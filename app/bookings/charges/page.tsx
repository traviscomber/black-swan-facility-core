"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { FileText, Minus, Plus, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/lib/hooks/use-language"
import { chargesCopy, fillChargesCopy } from "@/lib/translations/charges"

interface Reservation { id: string; guest_name: string; guest_email: string | null; guest_phone: string | null; check_in: string; check_out: string; status: string; total_amount: number | null }
interface Extra { id: string; name: string; unit: string; price: number; tax_rate: number; is_active: boolean }
interface ReservationExtra { id: string; reservation_id: string; extra_id: string | null; name: string; unit: string; quantity: number; unit_price: number; tax_rate: number; total_amount: number }
interface ExistingInvoice { id: string; invoice_number: string; status: string }
function formatClp(value: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value) }
function toIsoDate(date: Date) { return date.toISOString().slice(0, 10) }

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
    setLoading(true); setError(null)
    const [reservationsResult, extrasResult, chargesResult] = await Promise.all([
      supabase.from("reservations").select("id, guest_name, guest_email, guest_phone, check_in, check_out, status, total_amount").neq("status", "cancelled").order("check_in", { ascending: false }).limit(200),
      supabase.from("booking_extras").select("id, name, unit, price, tax_rate, is_active").eq("is_active", true).order("name"),
      supabase.from("reservation_extras").select("id, reservation_id, extra_id, name, unit, quantity, unit_price, tax_rate, total_amount").order("created_at", { ascending: false }),
    ])
    const firstError = reservationsResult.error || extrasResult.error || chargesResult.error
    if (firstError) setError(firstError.message)
    else {
      setReservations((reservationsResult.data ?? []) as Reservation[])
      setExtras((extrasResult.data ?? []) as Extra[])
      setCharges((chargesResult.data ?? []) as ReservationExtra[])
      if (!selectedReservationId && reservationsResult.data?.[0]?.id) setSelectedReservationId(reservationsResult.data[0].id)
    }
    setLoading(false)
  }, [selectedReservationId, supabase])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => { setCreatedInvoice(null) }, [selectedReservationId])
  useEffect(() => { const channel = supabase.channel("reservation-extra-charges").on("postgres_changes", { event: "*", schema: "public", table: "reservation_extras" }, () => void loadData()).subscribe(); return () => { void supabase.removeChannel(channel) } }, [loadData, supabase])

  const filteredReservations = useMemo(() => { const term = search.trim().toLowerCase(); return reservations.filter((reservation) => !term || reservation.guest_name.toLowerCase().includes(term) || reservation.check_in.includes(term) || reservation.check_out.includes(term)) }, [reservations, search])
  const selectedReservation = reservations.find((reservation) => reservation.id === selectedReservationId)
  const selectedCharges = charges.filter((charge) => charge.reservation_id === selectedReservationId)
  const lodgingTotal = Number(selectedReservation?.total_amount ?? 0)
  const extrasSubtotal = selectedCharges.reduce((sum, charge) => sum + Number(charge.total_amount), 0)
  const taxTotal = selectedCharges.reduce((sum, charge) => sum + Number(charge.total_amount) * (Number(charge.tax_rate) / 100), 0)
  const grandTotal = lodgingTotal + extrasSubtotal + taxTotal

  async function addCharge() { const extra = extras.find((item) => item.id === selectedExtraId); if (!selectedReservationId || !extra || quantity <= 0) return; setSaving(true); setError(null); const { error: insertError } = await supabase.from("reservation_extras").insert({ reservation_id: selectedReservationId, extra_id: extra.id, name: extra.name, unit: extra.unit, quantity, unit_price: extra.price, tax_rate: extra.tax_rate }); if (insertError) setError(insertError.message); else { setSelectedExtraId(""); setQuantity(1); await loadData() } setSaving(false) }
  async function changeQuantity(charge: ReservationExtra, nextQuantity: number) { if (nextQuantity <= 0) return; const { error: updateError } = await supabase.from("reservation_extras").update({ quantity: nextQuantity }).eq("id", charge.id); if (updateError) setError(updateError.message); else await loadData() }
  async function removeCharge(id: string) { const { error: deleteError } = await supabase.from("reservation_extras").delete().eq("id", id); if (deleteError) setError(deleteError.message); else await loadData() }

  async function createInvoice() {
    if (!selectedReservation) return
    setInvoicing(true); setError(null); setCreatedInvoice(null)
    try {
      const existingResponse = await fetch(`/api/bookings/invoices?reservationId=${selectedReservation.id}`)
      if (!existingResponse.ok) throw new Error(copy.verifyInvoicesFailed)
      const existingInvoices = (await existingResponse.json()) as ExistingInvoice[]
      const reusableInvoice = existingInvoices.find((invoice) => invoice.status !== "cancelled" && invoice.status !== "void")
      if (reusableInvoice) { setCreatedInvoice(reusableInvoice); return }
      const invoiceDate = new Date(); const dueDate = new Date(invoiceDate); dueDate.setDate(dueDate.getDate() + 7)
      const response = await fetch("/api/bookings/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_id: selectedReservation.id, invoice_date: toIsoDate(invoiceDate), due_date: toIsoDate(dueDate), status: "draft", customer_name: selectedReservation.guest_name, customer_email: selectedReservation.guest_email, customer_phone: selectedReservation.guest_phone, subtotal: lodgingTotal + extrasSubtotal, tax_amount: taxTotal, total_amount: grandTotal, payment_status: "pending", amount_paid: 0, notes: "Generada desde los cargos de la reserva." }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || copy.createInvoiceFailed); setCreatedInvoice(payload as ExistingInvoice)
    } catch (invoiceError) { setError(invoiceError instanceof Error ? invoiceError.message : copy.createInvoiceFailed) } finally { setInvoicing(false) }
  }

  return <div className="min-h-screen bg-[#111213] text-foreground">
    <header className="flex min-h-[58px] flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5"><div><h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1><p className="text-xs text-muted-foreground">{copy.subtitle}</p></div><Button className="h-8 rounded-[5px] bg-emerald-600 px-3 text-xs hover:bg-emerald-500" onClick={createInvoice} disabled={!selectedReservation || invoicing}><FileText className="mr-1.5 h-3.5 w-3.5" />{invoicing ? copy.generating : copy.generateInvoice}</Button></header>
    <div className="grid min-h-[calc(100dvh-58px)] lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border-r border-white/10 bg-[#151718]"><div className="border-b border-white/10 p-2"><div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 rounded-[4px] border-white/10 bg-[#111314] pl-8 text-xs" placeholder={copy.search} /></div></div><div className="max-h-[calc(100dvh-100px)] overflow-y-auto">{loading ? <p className="p-4 text-xs text-muted-foreground">{copy.loading}</p> : filteredReservations.map((reservation) => <button key={reservation.id} onClick={() => setSelectedReservationId(reservation.id)} className={`w-full border-b border-white/[0.06] px-3 py-2.5 text-left ${selectedReservationId === reservation.id ? "bg-white/[0.06]" : "hover:bg-white/[0.025]"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{reservation.guest_name}</span><Badge variant="outline" className="h-5 rounded-[3px] px-1.5 text-[10px]">{reservation.status}</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{reservation.check_in} → {reservation.check_out}</p></button>)}</div></aside>
      <main className="min-w-0">
        {error && <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">{error}</div>}
        {createdInvoice && <div className="flex items-center justify-between border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs"><span>{fillChargesCopy(copy.invoiceReady, { number: createdInvoice.invoice_number, status: createdInvoice.status })}</span><Button asChild size="sm" variant="outline" className="h-7 rounded-[3px] text-[11px]"><Link href={localize("/bookings/invoices")}>{copy.openInvoices}</Link></Button></div>}
        <div className="flex flex-wrap items-center gap-5 border-b border-white/10 bg-[#17191a] px-4 py-2 text-xs"><span>{copy.lodging}: <b>{formatClp(lodgingTotal)}</b></span><span>{copy.extras}: <b>{formatClp(extrasSubtotal)}</b></span><span>{copy.extraTaxes}: <b>{formatClp(taxTotal)}</b></span><span className="ml-auto text-emerald-300">{copy.billableTotal}: <b>{formatClp(grandTotal)}</b></span></div>
        <div className="flex flex-col gap-2 border-b border-white/10 bg-[#151718] px-4 py-2 md:flex-row"><Select value={selectedExtraId} onValueChange={setSelectedExtraId}><SelectTrigger className="h-8 rounded-[4px] border-white/10 bg-[#111314] text-xs"><SelectValue placeholder={copy.selectExtra} /></SelectTrigger><SelectContent>{extras.map((extra) => <SelectItem key={extra.id} value={extra.id}>{extra.name} · {formatClp(Number(extra.price))}</SelectItem>)}</SelectContent></Select><Input className="h-8 w-28 rounded-[4px] border-white/10 bg-[#111314] text-xs" type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /><Button className="h-8 rounded-[4px] px-3 text-xs" onClick={addCharge} disabled={!selectedReservationId || !selectedExtraId || saving}><Plus className="mr-1 h-3 w-3" />{copy.add}</Button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead className="bg-[#17191a] text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-2.5">{copy.chargeDetails}</th><th className="px-4 py-2.5">Unit</th><th className="px-4 py-2.5">Qty</th><th className="px-4 py-2.5">{copy.tax}</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5"></th></tr></thead><tbody className="divide-y divide-white/[0.06]">{selectedCharges.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{copy.noExtras}</td></tr> : selectedCharges.map((charge) => <tr key={charge.id} className="bg-[#111213] hover:bg-white/[0.025]"><td className="px-4 py-2.5 font-medium">{charge.name}</td><td className="px-4 py-2.5 text-muted-foreground">{formatClp(Number(charge.unit_price))} · {charge.unit}</td><td className="px-4 py-2.5"><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => changeQuantity(charge, Number(charge.quantity) - 1)}><Minus className="h-3 w-3" /></Button><span className="w-6 text-center">{Number(charge.quantity)}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => changeQuantity(charge, Number(charge.quantity) + 1)}><Plus className="h-3 w-3" /></Button></div></td><td className="px-4 py-2.5 text-muted-foreground">{Number(charge.tax_rate)}%</td><td className="px-4 py-2.5 text-right font-medium">{formatClp(Number(charge.total_amount))}</td><td className="px-4 py-2.5 text-right"><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeCharge(charge.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td></tr>)}</tbody></table></div>
      </main>
    </div>
  </div>
}
