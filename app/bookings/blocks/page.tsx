"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/hooks/use-language"
import { blocksCopy } from "@/lib/translations/blocks"

interface Room { id: string; room_number: string; location: string | null; status: string | null }
interface RoomBlock { id: string; room_id: string; start_date: string; end_date: string; block_type: string; reason: string; notes: string | null; status: string; created_at: string; rooms: Room | Room[] | null }
function roomOf(block: RoomBlock) { return Array.isArray(block.rooms) ? block.rooms[0] : block.rooms }

export default function RoomBlocksPage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = blocksCopy[language]
  const typeLabels: Record<string, string> = { maintenance: copy.maintenance, owner_use: copy.ownerUse, out_of_service: copy.outOfService, other: copy.other }
  const [rooms, setRooms] = useState<Room[]>([])
  const [blocks, setBlocks] = useState<RoomBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("active")
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ room_id: "", start_date: "", end_date: "", block_type: "maintenance", reason: "", notes: "" })

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    const [{ data: roomData, error: roomError }, { data: blockData, error: blockError }] = await Promise.all([
      supabase.from("rooms").select("id, room_number, location, status").order("room_number"),
      supabase.from("room_blocks").select("id, room_id, start_date, end_date, block_type, reason, notes, status, created_at, rooms(id, room_number, location, status)").order("start_date", { ascending: true }),
    ])
    if (roomError || blockError) setError(roomError?.message || blockError?.message || copy.loadFailed)
    setRooms((roomData || []) as Room[]); setBlocks((blockData || []) as RoomBlock[]); setLoading(false)
  }, [copy.loadFailed, supabase])

  useEffect(() => { void loadData(); const channel = supabase.channel("room-blocks-live").on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, () => void loadData()).subscribe(); return () => { void supabase.removeChannel(channel) } }, [loadData, supabase])

  const filtered = useMemo(() => blocks.filter((block) => { const room = roomOf(block); const text = `${room?.room_number || ""} ${room?.location || ""} ${block.reason} ${block.notes || ""}`.toLowerCase(); return (statusFilter === "all" || block.status === statusFilter) && text.includes(search.toLowerCase()) }), [blocks, search, statusFilter])

  async function createBlock() {
    if (!form.room_id || !form.start_date || !form.end_date || !form.reason.trim()) return
    setSaving(true); setError(null)
    const { data: auth } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from("room_blocks").insert({ ...form, notes: form.notes || null, created_by: auth.user?.id || null })
    if (insertError) setError(insertError.message)
    else { setOpen(false); setForm({ room_id: "", start_date: "", end_date: "", block_type: "maintenance", reason: "", notes: "" }); await loadData() }
    setSaving(false)
  }

  async function updateStatus(id: string, status: string) {
    const { error: updateError } = await supabase.from("room_blocks").update({ status, updated_at: new Date().toISOString() }).eq("id", id)
    if (updateError) setError(updateError.message); else await loadData()
  }

  return <div className="min-h-screen bg-[#111213] text-foreground">
    <header className="flex min-h-[58px] flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5"><div><h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1><p className="text-xs text-muted-foreground">{copy.subtitle}</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="h-8 rounded-[5px] bg-emerald-600 px-3 text-xs hover:bg-emerald-500"><Plus className="mr-1.5 h-3.5 w-3.5" />{copy.newBlock}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{copy.createBlock}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>{copy.room}</Label><Select value={form.room_id} onValueChange={(value) => setForm({ ...form, room_id: value })}><SelectTrigger><SelectValue placeholder={copy.select} /></SelectTrigger><SelectContent>{rooms.map((room) => <SelectItem key={room.id} value={room.id}>{room.room_number}{room.location ? ` · ${room.location}` : ""}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div><Label>{copy.from}</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div><div><Label>{copy.to}</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div></div><div><Label>{copy.type}</Label><Select value={form.block_type} onValueChange={(value) => setForm({ ...form, block_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label>{copy.reason}</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div><div><Label>{copy.notes}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><Button className="w-full" onClick={createBlock} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{copy.save}</Button></div></DialogContent></Dialog></header>
    <div className="flex min-h-[40px] flex-col gap-2 border-b border-white/10 bg-[#151718] px-4 py-1.5 md:flex-row md:items-center md:px-5"><div className="relative w-full md:max-w-md"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-8 rounded-[4px] border-white/10 bg-[#111314] pl-8 text-xs" placeholder={copy.search} value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-8 rounded-[4px] border-white/10 bg-[#111314] text-xs md:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{copy.active}</SelectItem><SelectItem value="completed">{copy.completed}</SelectItem><SelectItem value="cancelled">{copy.cancelled}</SelectItem><SelectItem value="all">{copy.all}</SelectItem></SelectContent></Select><span className="ml-auto text-xs text-muted-foreground">{filtered.length} {copy.title.toLowerCase()}</span></div>
    {error && <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">{error}</div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-xs"><thead className="bg-[#17191a] text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-2.5">{copy.room}</th><th className="px-4 py-2.5">{copy.type}</th><th className="px-4 py-2.5">{copy.from}</th><th className="px-4 py-2.5">{copy.to}</th><th className="px-4 py-2.5">{copy.reason}</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{copy.loading}</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{copy.none}</td></tr> : filtered.map((block) => { const room = roomOf(block); return <tr key={block.id} className="bg-[#111213] hover:bg-white/[0.025]"><td className="px-4 py-2.5 font-medium">{room?.room_number || "—"}<div className="text-[11px] font-normal text-muted-foreground">{room?.location || "—"}</div></td><td className="px-4 py-2.5">{typeLabels[block.block_type] || block.block_type}</td><td className="px-4 py-2.5 text-muted-foreground">{block.start_date}</td><td className="px-4 py-2.5 text-muted-foreground">{block.end_date}</td><td className="max-w-md px-4 py-2.5"><div>{block.reason}</div>{block.notes && <div className="line-clamp-1 text-[11px] text-muted-foreground">{block.notes}</div>}</td><td className="px-4 py-2.5"><Badge variant="outline" className="h-5 rounded-[3px] px-1.5 text-[10px]">{block.status}</Badge></td><td className="px-4 py-2.5"><div className="flex justify-end gap-1">{block.status === "active" && <><Button size="sm" variant="outline" className="h-7 rounded-[3px] px-2 text-[11px]" onClick={() => void updateStatus(block.id, "completed")}>{copy.complete}</Button><Button size="sm" variant="ghost" className="h-7 rounded-[3px] px-2 text-[11px]" onClick={() => void updateStatus(block.id, "cancelled")}>{copy.cancel}</Button></>}</div></td></tr> })}</tbody></table></div>
  </div>
}
