"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Percent, Plus, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/lib/hooks/use-language"
import { ratesCopy } from "@/lib/translations/rates"

interface Room { id: string; room_number: string; location: string | null; rate_per_night: number | null }
interface Rule { id: string; room_id: string | null; season_name: string | null; start_date: string; end_date: string; rate_multiplier: number | null; min_stay: number | null; room?: Room | null }
function money(value: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value) }

export default function RatesPage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = ratesCopy[language]
  const [rooms, setRooms] = useState<Room[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [search, setSearch] = useState("")
  const [roomFilter, setRoomFilter] = useState("all")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ room_id: "all", season_name: "", start_date: "", end_date: "", rate_multiplier: "1", min_stay: "1" })

  const load = useCallback(async () => {
    const [roomsResult, rulesResult] = await Promise.all([
      supabase.from("rooms").select("id, room_number, location, rate_per_night").order("room_number"),
      supabase.from("pricing_rules").select("id, room_id, season_name, start_date, end_date, rate_multiplier, min_stay, room:rooms(id, room_number, location, rate_per_night)").order("start_date"),
    ])
    const firstError = roomsResult.error || rulesResult.error
    if (firstError) setError(firstError.message)
    else { setRooms((roomsResult.data ?? []) as Room[]); setRules((rulesResult.data ?? []) as unknown as Rule[]) }
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase.channel("pricing-rules").on("postgres_changes", { event: "*", schema: "public", table: "pricing_rules" }, () => void load()).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rules.filter((rule) => {
      const matchesRoom = roomFilter === "all" || rule.room_id === roomFilter
      const haystack = `${rule.season_name ?? ""} ${rule.room?.room_number ?? copy.all} ${rule.room?.location ?? ""}`.toLowerCase()
      return matchesRoom && (!term || haystack.includes(term))
    })
  }, [copy.all, rules, roomFilter, search])

  const activeNow = rules.filter((rule) => rule.start_date <= new Date().toISOString().slice(0, 10) && rule.end_date > new Date().toISOString().slice(0, 10)).length
  const avgMultiplier = rules.length ? rules.reduce((sum, rule) => sum + Number(rule.rate_multiplier ?? 1), 0) / rules.length : 1

  async function createRule() {
    if (!form.season_name || !form.start_date || !form.end_date || form.end_date <= form.start_date) { setError(copy.invalidRange); return }
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from("pricing_rules").insert({ room_id: form.room_id === "all" ? null : form.room_id, season_name: form.season_name, start_date: form.start_date, end_date: form.end_date, rate_multiplier: Number(form.rate_multiplier), min_stay: Number(form.min_stay) })
    if (insertError) setError(insertError.message)
    else { setOpen(false); setForm({ room_id: "all", season_name: "", start_date: "", end_date: "", rate_multiplier: "1", min_stay: "1" }); await load() }
    setSaving(false)
  }

  async function removeRule(id: string) { const { error: deleteError } = await supabase.from("pricing_rules").delete().eq("id", id); if (deleteError) setError(deleteError.message); else await load() }

  return <section className="min-h-screen bg-[#111213] text-white">
    <header className="flex min-h-[58px] items-center justify-between gap-3 border-b border-white/10 bg-[#17191a] px-3"><div><h1 className="text-[15px] font-medium">{copy.title}</h1><p className="text-[11px] text-white/45">{rules.length} {copy.rules.toLowerCase()} · {activeNow} {copy.activeToday.toLowerCase()} · {avgMultiplier.toFixed(2)}×</p></div><button onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-[5px] bg-[#04b958] px-4 text-xs font-medium"><Plus className="h-4 w-4" />{copy.newRule}</button></header>
    <div className="flex min-h-[44px] gap-2 border-b border-white/10 bg-[#151718] p-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input className="h-8 w-full rounded-[3px] border border-white/10 bg-[#111314] pl-9 pr-3 text-xs outline-none placeholder:text-white/30 focus:border-[#04b958]/70" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.search} /></div><select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className="h-8 min-w-52 rounded-[3px] border border-white/10 bg-[#111314] px-2 text-xs"><option value="all">{copy.allRooms}</option>{rooms.map((room) => <option key={room.id} value={room.id}>{copy.roomShort} {room.room_number}</option>)}</select></div>
    {error && <div className="m-3 border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}
    <div className="overflow-auto"><table className="w-full min-w-[960px] border-collapse text-xs"><thead className="sticky top-0 z-10 bg-[#17191a] text-left text-[10px] uppercase tracking-[.08em] text-white/45"><tr><th className="border-b border-white/10 px-4 py-3 font-medium">{copy.season}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.room}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.dates}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.base}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.multiplier}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.effectivePrice}</th><th className="border-b border-white/10 px-3 py-3 font-medium">{copy.minimum}</th><th className="border-b border-white/10 px-4 py-3"></th></tr></thead><tbody>{visible.map((rule) => { const base = Number(rule.room?.rate_per_night ?? 0); return <tr key={rule.id} className="border-b border-white/[.06] hover:bg-white/[.025]"><td className="px-4 py-3 font-medium text-white/90">{rule.season_name || copy.unnamed}</td><td className="px-3 py-3 text-white/65">{rule.room ? `${copy.roomShort} ${rule.room.room_number}` : copy.all}</td><td className="px-3 py-3 tabular-nums text-white/55">{rule.start_date} → {rule.end_date}</td><td className="px-3 py-3 tabular-nums text-white/65">{rule.room ? money(base) : copy.byRoom}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1 text-white/75"><Percent className="h-3 w-3 text-white/35" />{Number(rule.rate_multiplier ?? 1).toFixed(2)}×</span></td><td className="px-3 py-3 tabular-nums text-white/80">{rule.room ? money(base * Number(rule.rate_multiplier ?? 1)) : copy.variable}</td><td className="px-3 py-3 text-white/60">{rule.min_stay ?? 1} {copy.nights}</td><td className="px-4 py-3 text-right"><button className="grid h-8 w-8 place-items-center rounded-[3px] border border-white/10 text-red-300/70 hover:bg-red-500/10" onClick={() => void removeRule(rule.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></td></tr> })}{visible.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-white/35">{copy.noRules}</td></tr>}</tbody></table></div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{copy.newRateRule}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.season}><Input value={form.season_name} onChange={(e) => setForm({ ...form, season_name: e.target.value })} /></Field><Field label={copy.room}><Select value={form.room_id} onValueChange={(value) => setForm({ ...form, room_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.all}</SelectItem>{rooms.map((room) => <SelectItem key={room.id} value={room.id}>{copy.roomShort} {room.room_number}</SelectItem>)}</SelectContent></Select></Field><Field label={copy.start}><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field><Field label={copy.end}><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field><Field label={copy.multiplier}><Input type="number" min="0.1" step="0.05" value={form.rate_multiplier} onChange={(e) => setForm({ ...form, rate_multiplier: e.target.value })} /></Field><Field label={copy.minStay}><Input type="number" min="1" value={form.min_stay} onChange={(e) => setForm({ ...form, min_stay: e.target.value })} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{copy.cancel}</Button><Button onClick={createRule} disabled={saving}>{saving ? copy.saving : copy.create}</Button></DialogFooter></DialogContent></Dialog>
  </section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
