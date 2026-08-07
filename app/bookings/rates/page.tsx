"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarRange, Percent, Plus, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  return <div className="min-h-screen bg-background p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-3xl font-bold">{copy.title}</h1><p className="text-sm text-muted-foreground">{copy.subtitle}</p></div><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />{copy.newRule}</Button></div>
    <div className="grid gap-3 sm:grid-cols-3"><Metric title={copy.rules} value={String(rules.length)} icon={<CalendarRange className="h-4 w-4" />} /><Metric title={copy.activeToday} value={String(activeNow)} icon={<CalendarRange className="h-4 w-4" />} /><Metric title={copy.avgMultiplier} value={`${avgMultiplier.toFixed(2)}×`} icon={<Percent className="h-4 w-4" />} /></div>
    <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.search} /></div><Select value={roomFilter} onValueChange={setRoomFilter}><SelectTrigger className="md:w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.allRooms}</SelectItem>{rooms.map((room) => <SelectItem key={room.id} value={room.id}>{copy.roomShort} {room.room_number}</SelectItem>)}</SelectContent></Select></CardContent></Card>
    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">{copy.season}</th><th className="p-3">{copy.room}</th><th className="p-3">{copy.dates}</th><th className="p-3">{copy.base}</th><th className="p-3">{copy.multiplier}</th><th className="p-3">{copy.effectivePrice}</th><th className="p-3">{copy.minimum}</th><th className="p-3"></th></tr></thead><tbody>{visible.map((rule) => { const base = Number(rule.room?.rate_per_night ?? 0); return <tr key={rule.id} className="border-b"><td className="p-3 font-medium">{rule.season_name || copy.unnamed}</td><td className="p-3">{rule.room ? `${copy.roomShort} ${rule.room.room_number}` : copy.all}</td><td className="p-3">{rule.start_date} → {rule.end_date}</td><td className="p-3">{rule.room ? money(base) : copy.byRoom}</td><td className="p-3">{Number(rule.rate_multiplier ?? 1).toFixed(2)}×</td><td className="p-3">{rule.room ? money(base * Number(rule.rate_multiplier ?? 1)) : copy.variable}</td><td className="p-3">{rule.min_stay ?? 1} {copy.nights}</td><td className="p-3 text-right"><Button size="icon" variant="ghost" onClick={() => removeRule(rule.id)}><Trash2 className="h-4 w-4" /></Button></td></tr> })}{visible.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">{copy.noRules}</td></tr>}</tbody></table></div></CardContent></Card>
  </div>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{copy.newRateRule}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.season}><Input value={form.season_name} onChange={(e) => setForm({ ...form, season_name: e.target.value })} /></Field><Field label={copy.room}><Select value={form.room_id} onValueChange={(value) => setForm({ ...form, room_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.all}</SelectItem>{rooms.map((room) => <SelectItem key={room.id} value={room.id}>{copy.roomShort} {room.room_number}</SelectItem>)}</SelectContent></Select></Field><Field label={copy.start}><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field><Field label={copy.end}><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field><Field label={copy.multiplier}><Input type="number" min="0.1" step="0.05" value={form.rate_multiplier} onChange={(e) => setForm({ ...form, rate_multiplier: e.target.value })} /></Field><Field label={copy.minStay}><Input type="number" min="1" value={form.min_stay} onChange={(e) => setForm({ ...form, min_stay: e.target.value })} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{copy.cancel}</Button><Button onClick={createRule} disabled={saving}>{saving ? copy.saving : copy.create}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
