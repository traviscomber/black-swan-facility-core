"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { enUS, es, de } from "date-fns/locale"
import { ArrowLeft, CircleDollarSign, CreditCard, Plus, Search, WalletCards } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"
import { paymentsCopy } from "@/lib/translations/payments"
import { formatClp } from "@/lib/money"
import { PermissionGate } from "@/components/access/access-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const localize = (href: string) => `/${language}${href}`
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

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    const { data, error: queryError } = await supabase.from("reservations").select(`id, guest_name, guest_email, check_in, check_out, status, payment_status, total_amount, payments(id, reservation_id, amount, payment_method, payment_status, transaction_id, paid_at, created_at)`).neq("status", "cancelled").order("check_in", { ascending: false })
    if (queryError) setError(copy.loadFailed ?? copy.error ?? "Unable to load payments"); else setReservations((data ?? []) as Reservation[])
    setLoading(false)
  }, [copy, supabase])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => {
    const channel = supabase.channel("bookings-payments").on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => void loadData()).on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadData()).subscribe()
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

  const metrics = useMemo(() => rows.reduce((acc, row) => ({ total: acc.total + row.total, paid: acc.paid + row.paid, balance: acc.balance + row.balance, overdue: acc.overdue + (row.balance > 0 && new Date(row.reservation.check_out) < new Date() ? row.balance : 0) }), { total: 0, paid: 0, balance: 0, overdue: 0 }), [rows])

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
    setSaving(false); setSelected(null); setAmount(""); setTransactionId(""); await loadData()
  }

  return <div className="min-h-screen bg-background p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1><p className="text-sm text-muted-foreground">{copy.subtitle}</p></div><div className="flex gap-2"><Button variant="outline" asChild><Link href={localize("/bookings")}><ArrowLeft className="mr-2 h-4 w-4" />{copy.calendar}</Link></Button><Button variant="outline" asChild><Link href={localize("/bookings/activities")}>{copy.operations}</Link></Button></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title={copy.bookedValue} value={money(metrics.total)} icon={<CircleDollarSign className="h-4 w-4" />} /><Metric title={copy.paid} value={money(metrics.paid)} icon={<CreditCard className="h-4 w-4" />} /><Metric title={copy.pendingBalance} value={money(metrics.balance)} icon={<WalletCards className="h-4 w-4" />} /><Metric title={copy.overdueBalance} value={money(metrics.overdue)} icon={<CircleDollarSign className="h-4 w-4" />} /></div>
    <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder={copy.search} /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.allStatuses}</SelectItem><SelectItem value="pending">{copy.noPayment}</SelectItem><SelectItem value="partial">{copy.partial}</SelectItem><SelectItem value="paid">{copy.paid}</SelectItem></SelectContent></Select></CardContent></Card>
    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}
    <Card><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-sm"><thead className="border-b bg-muted/40 text-left"><tr><th className="px-4 py-3">{copy.guest}</th><th className="px-4 py-3">{copy.stay}</th><th className="px-4 py-3 text-right">{copy.total}</th><th className="px-4 py-3 text-right">{copy.paid}</th><th className="px-4 py-3 text-right">{copy.balance}</th><th className="px-4 py-3">{copy.status}</th><th className="px-4 py-3 text-right">{copy.action}</th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">{copy.loading}</td></tr> : visibleRows.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">{copy.noRows}</td></tr> : visibleRows.map((row) => <tr key={row.reservation.id} className="border-b last:border-0"><td className="px-4 py-3"><div className="font-medium">{row.reservation.guest_name}</div><div className="text-xs text-muted-foreground">{row.reservation.guest_email || "—"}</div></td><td className="px-4 py-3">{format(new Date(`${row.reservation.check_in}T00:00:00`), "dd MMM", { locale: dateLocale })} — {format(new Date(`${row.reservation.check_out}T00:00:00`), "dd MMM yyyy", { locale: dateLocale })}</td><td className="px-4 py-3 text-right">{money(row.total)}</td><td className="px-4 py-3 text-right text-emerald-600">{money(row.paid)}</td><td className="px-4 py-3 text-right font-semibold">{money(row.balance)}</td><td className="px-4 py-3"><PaymentBadge status={row.status} copy={copy} /></td><td className="px-4 py-3 text-right"><PermissionGate action="payments.record" department="finance"><Button size="sm" onClick={() => openPayment(row.reservation, row.balance)} disabled={row.balance <= 0}><Plus className="mr-2 h-4 w-4" />{copy.recordPayment}</Button></PermissionGate></td></tr>)}</tbody></table></CardContent></Card>
  </div>
  <Dialog open={!!selected && canRecordPayment} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{copy.recordPayment}</DialogTitle></DialogHeader>{selected && <div className="space-y-4"><div><p className="text-xs text-muted-foreground">{copy.reservation}</p><p className="font-medium">{selected.guest_name}</p></div><div className="space-y-2"><Label>{copy.amount}</Label><Input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="space-y-2"><Label>{copy.method}</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="transfer">{copy.transfer}</SelectItem><SelectItem value="cash">{copy.cash}</SelectItem><SelectItem value="card">{copy.card}</SelectItem><SelectItem value="other">{copy.other}</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>{copy.reference}</Label><Input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder={copy.referencePlaceholder} /></div></div>}<DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>{copy.cancel}</Button><Button onClick={registerPayment} disabled={saving || !canRecordPayment}>{saving ? copy.saving : copy.recordPayment}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card> }
function PaymentBadge({ status, copy }: { status: string; copy: Record<string, string> }) { if (status === "paid") return <Badge className="bg-emerald-600">{copy.paid}</Badge>; if (status === "partial") return <Badge className="bg-amber-500">{copy.partial}</Badge>; return <Badge variant="secondary">{copy.pending}</Badge> }
