"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { enUS, es, de } from "date-fns/locale"
import { Plus, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"
import { paymentsCopy } from "@/lib/translations/payments"
import { formatClp } from "@/lib/money"
import { PermissionGate } from "@/components/access/access-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Payment { id: string; reservation_id: string; amount: number; payment_method?: string | null; payment_status?: string | null; transaction_id?: string | null; paid_at?: string | null; created_at: string }
interface Reservation { id: string; guest_name: string; guest_email?: string | null; check_in: string; check_out: string; status: string; payment_status?: string | null; total_amount?: number | null; payments?: Payment[] }

const DATE_LOCALES = { en: enUS, es, de } as const
const NUMBER_LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
function paymentStatus(total: number, paid: number) { if (total <= 0 || paid <= 0) return "pending"; if (paid >= total) return "paid"; return "partial" }

export default function BookingPaymentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { can, canAccessDepartment } = useEffectiveAccess()
  const { language } = useLanguage()
  const copy = paymentsCopy[language]
  const dateLocale = DATE_LOCALES[language]
  const numberLocale = NUMBER_LOCALES[language]
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
  const money = useCallback((value: number) => formatClp(value, numberLocale), [numberLocale])

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase.from("reservations").select(`id, guest_name, guest_email, check_in, check_out, status, payment_status, total_amount, payments(id, reservation_id, amount, payment_method, payment_status, transaction_id, paid_at, created_at)`).neq("status", "cancelled").order("check_in", { ascending: false })
    if (queryError) setError(copy.loadFailed ?? copy.error ?? "Unable to load payments"); else setReservations((data ?? []) as Reservation[])
    if (showLoading) setLoading(false)
  }, [copy, supabase])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => {
    const channel = supabase.channel("bookings-payments").on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => void loadData(false)).on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadData(false)).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const rows = useMemo(() => reservations.map((reservation) => {
    const total = Number(reservation.total_amount ?? 0)
    const paid = (reservation.payments ?? []).filter((payment) => payment.payment_status !== "cancelled" && payment.payment_status !== "failed").reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
    const balance = Math.max(0, total - paid)
    return { reservation, total, paid, balance, status: paymentStatus(total, paid) }
  }), [reservations])

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(numberLocale)
    return rows.filter((row) => {
      const matchesSearch = !term || row.reservation.guest_name.toLocaleLowerCase(numberLocale).includes(term) || row.reservation.guest_email?.toLocaleLowerCase(numberLocale).includes(term)
      return matchesSearch && (filter === "all" || row.status === filter)
    })
  }, [filter, numberLocale, rows, search])

  function openPayment(reservation: Reservation, balance: number) {
    if (!canRecordPayment) { setError(copy.noPermission); return }
    setSelected(reservation); setAmount(String(balance || ""))
  }

  async function registerPayment() {
    if (!selected || !canRecordPayment) { setError(copy.noPermission); setSelected(null); return }
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError(copy.invalidAmount); return }
    setSaving(true); setError(null)
    const { error: paymentError } = await supabase.rpc("record_reservation_payment", { p_reservation_id: selected.id, p_amount: numericAmount, p_payment_method: method, p_transaction_id: transactionId || null, p_notes: null })
    if (paymentError) { setError(copy.saveFailed ?? copy.error ?? "Unable to record payment"); setSaving(false); return }
    setSaving(false); setSelected(null); setAmount(""); setTransactionId(""); await loadData(false)
  }

  return <div className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] items-center justify-between gap-3 border-b border-white/[0.07] bg-[#211e1a] px-4 py-2"><div className="min-w-0"><h1 className="truncate text-lg font-medium">{copy.title}</h1><p className="truncate text-xs text-[#b9b0a4]">{copy.subtitle}</p></div></header>
    <div className="flex min-h-10 items-center gap-2 border-b border-white/[0.07] bg-[#1c1916] px-3 py-1.5"><div className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#b9b0a4]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 rounded-none border-white/10 bg-[#171512] pl-8 text-xs" placeholder={copy.search} /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="h-8 w-44 rounded-none border-white/10 bg-[#171512] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.allStatuses}</SelectItem><SelectItem value="pending">{copy.noPayment}</SelectItem><SelectItem value="partial">{copy.partial}</SelectItem><SelectItem value="paid">{copy.paid}</SelectItem></SelectContent></Select></div>
    {error && <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">{error}</div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead className="bg-[#211e1a] text-left text-[#b9b0a4]"><tr className="border-b border-white/[0.07]"><th className="px-3 py-2 font-medium">{copy.guest}</th><th className="px-3 py-2 font-medium">{copy.stay}</th><th className="px-3 py-2 text-right font-medium">{copy.total}</th><th className="px-3 py-2 text-right font-medium">{copy.paid}</th><th className="px-3 py-2 text-right font-medium">{copy.balance}</th><th className="px-3 py-2 font-medium">{copy.status}</th><th className="px-3 py-2 text-right font-medium">{copy.action}</th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="p-10 text-center text-[#b9b0a4]">{copy.loading}</td></tr> : visibleRows.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-[#b9b0a4]">{copy.noRows}</td></tr> : visibleRows.map((row) => <tr key={row.reservation.id} className="border-b border-white/[0.05] hover:bg-white/[0.025]"><td className="px-3 py-2"><div className="font-medium">{row.reservation.guest_name}</div><div className="text-[11px] text-[#b9b0a4]">{row.reservation.guest_email || "—"}</div></td><td className="px-3 py-2">{format(new Date(`${row.reservation.check_in}T00:00:00`), "dd MMM", { locale: dateLocale })} — {format(new Date(`${row.reservation.check_out}T00:00:00`), "dd MMM yyyy", { locale: dateLocale })}</td><td className="px-3 py-2 text-right">{money(row.total)}</td><td className="px-3 py-2 text-right text-emerald-300">{money(row.paid)}</td><td className="px-3 py-2 text-right font-medium">{money(row.balance)}</td><td className="px-3 py-2"><PaymentBadge status={row.status} copy={copy} /></td><td className="px-3 py-2 text-right"><PermissionGate action="payments.record" department="finance"><Button size="sm" className="h-7 rounded-none px-2 text-[11px]" onClick={() => openPayment(row.reservation, row.balance)} disabled={row.balance <= 0}><Plus className="mr-1.5 h-3 w-3" />{copy.recordPayment}</Button></PermissionGate></td></tr>)}</tbody></table></div>

    <Dialog open={!!selected && canRecordPayment} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="rounded-none"><DialogHeader><DialogTitle>{copy.recordPayment}</DialogTitle></DialogHeader>{selected && <div className="space-y-4"><div><p className="text-xs text-muted-foreground">{copy.reservation}</p><p className="font-medium">{selected.guest_name}</p></div><div className="space-y-2"><Label>{copy.amount}</Label><Input className="rounded-none" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="space-y-2"><Label>{copy.method}</Label><Select value={method} onValueChange={setMethod}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="transfer">{copy.transfer}</SelectItem><SelectItem value="cash">{copy.cash}</SelectItem><SelectItem value="card">{copy.card}</SelectItem><SelectItem value="other">{copy.other}</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>{copy.reference}</Label><Input className="rounded-none" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder={copy.referencePlaceholder} /></div></div>}<DialogFooter><Button variant="outline" className="rounded-none" onClick={() => setSelected(null)}>{copy.cancel}</Button><Button className="rounded-none" onClick={registerPayment} disabled={saving || !canRecordPayment}>{saving ? copy.saving : copy.recordPayment}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

function PaymentBadge({ status, copy }: { status: string; copy: Record<string, string> }) { if (status === "paid") return <Badge className="rounded-none border-0 bg-emerald-500/10 text-emerald-300">{copy.paid}</Badge>; if (status === "partial") return <Badge className="rounded-none border-0 bg-amber-500/10 text-amber-300">{copy.partial}</Badge>; return <Badge variant="secondary" className="rounded-none border-0">{copy.pending}</Badge> }
