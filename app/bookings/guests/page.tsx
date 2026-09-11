"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Edit, FileText, MessageCircle, Plus, Search, Trash2, CalendarDays } from "lucide-react"
import { AddGuestDialog } from "@/components/add-guest-dialog"
import { EditGuestDialog } from "@/components/edit-guest-dialog"
import { format, parseISO } from "date-fns"
import { bookingDateKey } from "@/lib/booking/timezone"
import { useLanguage } from "@/lib/hooks/use-language"
import { guestTranslations } from "@/lib/translations/guests"

interface Reservation { id: string; guest_name: string; guest_email?: string | null; guest_phone?: string | null; check_in: string; check_out: string; status: string; total_amount?: number | null; num_guests?: number | null; special_requests?: string | null }
interface Guest { id: string; name: string; email: string; phone: string; address: string; company_name: string; notes: string; vip_status: boolean; created_at: string; reservations?: Reservation[] }

function formatClp(value: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value) }
function normalizeStatus(status: string) { return status.replace("-", "_") }

export default function GuestsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const copy = guestTranslations[language]
  const localize = (href: string) => `/${language}${href}`
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
    const today = bookingDateKey()
    return guests.map((guest) => {
      const reservations = (guest.reservations ?? []).filter((reservation) => normalizeStatus(reservation.status) !== "cancelled")
      const completed = reservations.filter((reservation) => reservation.check_out < today || normalizeStatus(reservation.status) === "checked_out").sort((a, b) => b.check_in.localeCompare(a.check_in))
      const upcoming = reservations.filter((reservation) => reservation.check_in > today).sort((a, b) => a.check_in.localeCompare(b.check_in))
      return { ...guest, reservations, stays: completed.length, totalSpend: reservations.reduce((sum, reservation) => sum + Number(reservation.total_amount ?? 0), 0), lastStay: completed[0] ?? null, nextStay: upcoming[0] ?? null }
    })
  }, [guests])

  const filteredGuests = useMemo(() => { const query = searchQuery.trim().toLowerCase(); if (!query) return enrichedGuests; return enrichedGuests.filter((guest) => [guest.name, guest.email, guest.phone, guest.company_name].filter(Boolean).some((value) => value.toLowerCase().includes(query))) }, [enrichedGuests, searchQuery])

  async function handleDeleteGuest(guestId: string) { if (!confirm(copy.deleteConfirm)) return; const { error: deleteError } = await supabase.from("guests").delete().eq("id", guestId); if (deleteError) setError(deleteError.message); else void loadGuests() }
  function handleWhatsApp(guest: Guest) { const phone = guest.phone?.replace(/\D/g, ""); if (phone) window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer") }

  return <section className="min-h-screen bg-[#111213] text-white">
    <header className="flex min-h-[58px] items-center justify-between gap-3 border-b border-white/10 bg-[#17191a] px-3">
      <div><h1 className="text-[15px] font-medium">{copy.title}</h1><p className="text-[11px] text-white/45">{filteredGuests.length} {copy.guests.toLowerCase()}</p></div>
      <div className="flex items-center gap-2"><Link href={localize("/bookings/calendar")} className="inline-flex h-9 items-center gap-2 rounded-[4px] border border-white/10 bg-[#111314] px-3 text-xs hover:bg-white/5"><CalendarDays className="h-4 w-4" />{copy.operationalCenter}</Link><button onClick={() => setShowAddDialog(true)} className="inline-flex h-9 items-center gap-2 rounded-[5px] bg-[#04b958] px-4 text-xs font-medium"><Plus className="h-4 w-4" />{copy.newGuest}</button></div>
    </header>

    <div className="border-b border-white/10 bg-[#151718] p-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input className="h-8 w-full rounded-[3px] border border-white/10 bg-[#111314] pl-9 pr-3 text-xs outline-none placeholder:text-white/30 focus:border-[#04b958]/70" placeholder={copy.search} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></div></div>

    {error && <div className="m-3 border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}

    <div className="overflow-auto"><table className="w-full min-w-[1040px] border-collapse text-xs"><thead className="sticky top-0 z-10 bg-[#17191a] text-left text-[10px] uppercase tracking-[.08em] text-white/45"><tr><th className="border-b border-white/10 px-4 py-3 font-medium">{copy.guest}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.contact}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.stays}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.spend}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.last}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.next}</th><th className="border-b border-white/10 px-4 py-3 text-right font-medium">{copy.actions}</th></tr></thead><tbody>
      {loading ? Array.from({ length: 7 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={7} className="border-b border-white/5 px-4 py-5"><div className="h-3 w-2/3 bg-white/5" /></td></tr>) : null}
      {!loading && filteredGuests.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-white/35">{copy.noResults}</td></tr> : null}
      {!loading && filteredGuests.map((guest) => <tr key={guest.id} className="border-b border-white/[.06] hover:bg-white/[.025]"><td className="px-4 py-3"><button className="text-left" onClick={() => setHistoryGuest(guest)}><div className="font-medium text-white/92 hover:underline">{guest.name}</div><div className="mt-1 flex gap-1">{guest.vip_status && <Badge className="rounded-[3px] bg-[#04b958] text-[9px]">VIP</Badge>}{guest.stays > 1 && <Badge variant="secondary" className="rounded-[3px] text-[9px]">{copy.returning}</Badge>}</div></button></td><td className="px-3 py-3 text-white/55"><div>{guest.email || copy.noEmail}</div><div>{guest.phone || copy.noPhone}</div>{guest.company_name && <div className="mt-1 text-[10px] text-white/30">{guest.company_name}</div>}</td><td className="px-3 py-3 tabular-nums text-white/70">{guest.stays}</td><td className="px-3 py-3 tabular-nums text-white/75">{formatClp(guest.totalSpend)}</td><td className="px-3 py-3 text-white/60">{guest.lastStay ? format(parseISO(guest.lastStay.check_in), "dd MMM yyyy") : "—"}</td><td className="px-3 py-3 text-white/60">{guest.nextStay ? format(parseISO(guest.nextStay.check_in), "dd MMM yyyy") : "—"}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button className="grid h-8 w-8 place-items-center rounded-[3px] border border-white/10 hover:bg-white/5" onClick={() => { setSelectedGuest(guest); setShowEditDialog(true) }} aria-label="Edit"><Edit className="h-3.5 w-3.5" /></button><button className="grid h-8 w-8 place-items-center rounded-[3px] border border-white/10 hover:bg-white/5 disabled:opacity-30" disabled={!guest.phone} onClick={() => handleWhatsApp(guest)} aria-label="WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></button><Link className="grid h-8 w-8 place-items-center rounded-[3px] border border-white/10 hover:bg-white/5" href={`${localize("/bookings/invoices")}?customer=${encodeURIComponent(guest.name)}&email=${encodeURIComponent(guest.email || "")}`} aria-label="Invoices"><FileText className="h-3.5 w-3.5" /></Link><button className="grid h-8 w-8 place-items-center rounded-[3px] border border-white/10 text-red-300/70 hover:bg-red-500/10" onClick={() => void handleDeleteGuest(guest.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}
    </tbody></table></div>

    <AddGuestDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadGuests} />{selectedGuest && <EditGuestDialog open={showEditDialog} onOpenChange={setShowEditDialog} guest={selectedGuest} onSuccess={loadGuests} />}
    <Dialog open={!!historyGuest} onOpenChange={(open) => !open && setHistoryGuest(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{copy.history}</DialogTitle></DialogHeader>{historyGuest && <div className="space-y-4"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">{historyGuest.name}</h2><p className="text-xs text-muted-foreground">{historyGuest.email || copy.noEmail} · {historyGuest.phone || copy.noPhone}</p></div>{historyGuest.vip_status && <Badge className="bg-[#04b958]">VIP</Badge>}</div>{historyGuest.notes && <div className="border p-3 text-xs"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{copy.notes}</p><p className="mt-1">{historyGuest.notes}</p></div>}<div className="max-h-80 space-y-1 overflow-y-auto">{(historyGuest.reservations ?? []).length === 0 ? <p className="py-8 text-center text-muted-foreground">{copy.noReservations}</p> : (historyGuest.reservations ?? []).map((reservation) => <div key={reservation.id} className="flex items-center justify-between border-b p-3"><div><p className="text-sm font-medium">{format(parseISO(reservation.check_in), "dd MMM yyyy")} — {format(parseISO(reservation.check_out), "dd MMM yyyy")}</p><p className="text-xs text-muted-foreground">{reservation.num_guests ?? 1} {copy.guestCount} · {normalizeStatus(reservation.status)}</p></div><div className="text-sm font-medium">{formatClp(Number(reservation.total_amount ?? 0))}</div></div>)}</div></div>}</DialogContent></Dialog>
  </section>
}
