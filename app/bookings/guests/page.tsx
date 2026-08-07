"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Building2, CalendarClock, CircleDollarSign, Edit, FileText, MessageCircle, Plus, Search, Star, Trash2, Users } from "lucide-react"
import { AddGuestDialog } from "@/components/add-guest-dialog"
import { EditGuestDialog } from "@/components/edit-guest-dialog"
import { format, isAfter, isBefore, parseISO, startOfDay } from "date-fns"
import { useLanguage } from "@/lib/hooks/use-language"
import { guestTranslations } from "@/lib/translations/guests"

interface Reservation { id: string; guest_name: string; guest_email?: string | null; guest_phone?: string | null; check_in: string; check_out: string; status: string; total_amount?: number | null; num_guests?: number | null; special_requests?: string | null }
interface Guest { id: string; name: string; email: string; phone: string; address: string; company_name: string; notes: string; vip_status: boolean; created_at: string; reservations?: Reservation[] }

function formatClp(value: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value) }
function normalizeStatus(status: string) { return status.replace("-", "_") }

export default function GuestsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const pathname = usePathname() || "/en/bookings/guests"
  const { language } = useLanguage()
  const copy = guestTranslations[language]
  const localePrefix = `/${language}`
  const localize = (href: string) => `${localePrefix}${href}`
  const [guests, setGuests] = useState<Guest[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [historyGuest, setHistoryGuest] = useState<Guest | null>(null)

  useEffect(() => { void loadGuests() }, [])
  async function loadGuests() {
    setLoading(true); setError(null)
    const { data, error: queryError } = await supabase.from("guests").select(`id, name, email, phone, address, company_name, notes, vip_status, created_at, reservations:reservations(id, guest_name, guest_email, guest_phone, check_in, check_out, status, total_amount, num_guests, special_requests)`).order("name")
    if (queryError) { setError(queryError.message); setGuests([]) } else setGuests((data ?? []) as unknown as Guest[])
    setLoading(false)
  }

  const enrichedGuests = useMemo(() => {
    const today = startOfDay(new Date())
    return guests.map((guest) => {
      const reservations = (guest.reservations ?? []).filter((reservation) => normalizeStatus(reservation.status) !== "cancelled")
      const completed = reservations.filter((reservation) => isBefore(parseISO(reservation.check_out), today) || normalizeStatus(reservation.status) === "checked_out").sort((a, b) => b.check_in.localeCompare(a.check_in))
      const upcoming = reservations.filter((reservation) => isAfter(parseISO(reservation.check_in), today)).sort((a, b) => a.check_in.localeCompare(b.check_in))
      return { ...guest, reservations, stays: completed.length, totalSpend: reservations.reduce((sum, reservation) => sum + Number(reservation.total_amount ?? 0), 0), lastStay: completed[0] ?? null, nextStay: upcoming[0] ?? null }
    })
  }, [guests])

  const filteredGuests = useMemo(() => { const query = searchQuery.trim().toLowerCase(); if (!query) return enrichedGuests; return enrichedGuests.filter((guest) => [guest.name, guest.email, guest.phone, guest.company_name].filter(Boolean).some((value) => value.toLowerCase().includes(query))) }, [enrichedGuests, searchQuery])
  const metrics = useMemo(() => ({ total: enrichedGuests.length, vip: enrichedGuests.filter((guest) => guest.vip_status).length, repeat: enrichedGuests.filter((guest) => guest.stays > 1).length, spend: enrichedGuests.reduce((sum, guest) => sum + guest.totalSpend, 0) }), [enrichedGuests])

  async function handleDeleteGuest(guestId: string) { if (!confirm(copy.deleteConfirm)) return; const { error: deleteError } = await supabase.from("guests").delete().eq("id", guestId); if (deleteError) setError(deleteError.message); else void loadGuests() }
  function handleWhatsApp(guest: Guest) { const phone = guest.phone?.replace(/\D/g, ""); if (phone) window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer") }

  return <div className="min-h-screen bg-background p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3"><Button asChild variant="outline" size="icon"><Link href={localize("/bookings")} aria-label={copy.operationalCenter}><ArrowLeft className="h-4 w-4" /></Link></Button><div><h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1><p className="text-sm text-muted-foreground">{copy.subtitle}</p></div></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={localize("/bookings/activities")}><CalendarClock className="mr-2 h-4 w-4" />{copy.operationalCenter}</Link></Button><Button onClick={() => setShowAddDialog(true)}><Plus className="mr-2 h-4 w-4" />{copy.newGuest}</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric title={copy.guests} value={String(metrics.total)} icon={<Users className="h-4 w-4" />} /><Metric title="VIP" value={String(metrics.vip)} icon={<Star className="h-4 w-4" />} /><Metric title={copy.recurring} value={String(metrics.repeat)} icon={<CalendarClock className="h-4 w-4" />} /><Metric title={copy.historicalValue} value={formatClp(metrics.spend)} icon={<CircleDollarSign className="h-4 w-4" />} /></div>
    <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder={copy.search} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></div></CardContent></Card>
    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}
    <Card><CardHeader><CardTitle className="text-base">{copy.directory}</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="border-y bg-muted/40 text-left"><tr><th className="px-4 py-3">{copy.guest}</th><th className="px-4 py-3">{copy.contact}</th><th className="px-4 py-3">{copy.stays}</th><th className="px-4 py-3">{copy.spend}</th><th className="px-4 py-3">{copy.last}</th><th className="px-4 py-3">{copy.next}</th><th className="px-4 py-3">{copy.actions}</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">{copy.loading}</td></tr> : filteredGuests.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">{copy.noResults}</td></tr> : filteredGuests.map((guest) => <tr key={guest.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3"><button className="text-left" onClick={() => setHistoryGuest(guest)}><div className="font-medium hover:underline">{guest.name}</div><div className="mt-1 flex gap-1">{guest.vip_status && <Badge className="bg-amber-500">VIP</Badge>}{guest.stays > 1 && <Badge variant="secondary">{copy.returning}</Badge>}</div></button></td><td className="px-4 py-3 text-muted-foreground"><div>{guest.email || copy.noEmail}</div><div>{guest.phone || copy.noPhone}</div>{guest.company_name && <div className="mt-1 flex items-center gap-1"><Building2 className="h-3 w-3" />{guest.company_name}</div>}</td><td className="px-4 py-3 font-medium">{guest.stays}</td><td className="px-4 py-3 font-medium">{formatClp(guest.totalSpend)}</td><td className="px-4 py-3">{guest.lastStay ? format(parseISO(guest.lastStay.check_in), "dd MMM yyyy") : "—"}</td><td className="px-4 py-3">{guest.nextStay ? format(parseISO(guest.nextStay.check_in), "dd MMM yyyy") : "—"}</td><td className="px-4 py-3"><div className="flex gap-1"><Button size="icon" variant="outline" onClick={() => { setSelectedGuest(guest); setShowEditDialog(true) }}><Edit className="h-4 w-4" /></Button><Button size="icon" variant="outline" disabled={!guest.phone} onClick={() => handleWhatsApp(guest)}><MessageCircle className="h-4 w-4" /></Button><Button asChild size="icon" variant="outline"><Link href={`${localize("/bookings/invoices")}?customer=${encodeURIComponent(guest.name)}&email=${encodeURIComponent(guest.email || "")}`}><FileText className="h-4 w-4" /></Link></Button><Button size="icon" variant="outline" onClick={() => void handleDeleteGuest(guest.id)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}
    </tbody></table></div></CardContent></Card>
  </div>
  <AddGuestDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadGuests} />{selectedGuest && <EditGuestDialog open={showEditDialog} onOpenChange={setShowEditDialog} guest={selectedGuest} onSuccess={loadGuests} />}
  <Dialog open={!!historyGuest} onOpenChange={(open) => !open && setHistoryGuest(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{copy.history}</DialogTitle></DialogHeader>{historyGuest && <div className="space-y-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{historyGuest.name}</h2><p className="text-sm text-muted-foreground">{historyGuest.email || copy.noEmail} · {historyGuest.phone || copy.noPhone}</p></div>{historyGuest.vip_status && <Badge className="bg-amber-500">VIP</Badge>}</div>{historyGuest.notes && <div className="rounded-lg border p-3 text-sm"><p className="text-xs text-muted-foreground">{copy.notes}</p><p>{historyGuest.notes}</p></div>}<div className="max-h-80 space-y-2 overflow-y-auto">{(historyGuest.reservations ?? []).length === 0 ? <p className="py-8 text-center text-muted-foreground">{copy.noReservations}</p> : (historyGuest.reservations ?? []).map((reservation) => <div key={reservation.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{format(parseISO(reservation.check_in), "dd MMM yyyy")} — {format(parseISO(reservation.check_out), "dd MMM yyyy")}</p><p className="text-xs text-muted-foreground">{reservation.num_guests ?? 1} {copy.guestCount} · {normalizeStatus(reservation.status)}</p></div><div className="font-medium">{formatClp(Number(reservation.total_amount ?? 0))}</div></div>)}</div></div>}</DialogContent></Dialog>
  </div>
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card> }
