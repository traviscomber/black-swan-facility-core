"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarOff, Loader2, Plus, Search, ShieldAlert } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Room { id: string; room_number: string; location: string | null; status: string | null }
interface RoomBlock {
  id: string
  room_id: string
  start_date: string
  end_date: string
  block_type: string
  reason: string
  notes: string | null
  status: string
  created_at: string
  rooms: Room | Room[] | null
}

const typeLabels: Record<string, string> = {
  maintenance: "Mantenimiento",
  owner_use: "Uso propietario",
  out_of_service: "Fuera de servicio",
  other: "Otro",
}

function roomOf(block: RoomBlock) {
  return Array.isArray(block.rooms) ? block.rooms[0] : block.rooms
}

export default function RoomBlocksPage() {
  const supabase = useMemo(() => createClient(), [])
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
    setLoading(true)
    setError(null)
    const [{ data: roomData, error: roomError }, { data: blockData, error: blockError }] = await Promise.all([
      supabase.from("rooms").select("id, room_number, location, status").order("room_number"),
      supabase.from("room_blocks").select("id, room_id, start_date, end_date, block_type, reason, notes, status, created_at, rooms(id, room_number, location, status)").order("start_date", { ascending: true }),
    ])
    if (roomError || blockError) setError(roomError?.message || blockError?.message || "No se pudo cargar la información")
    setRooms((roomData || []) as Room[])
    setBlocks((blockData || []) as RoomBlock[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadData()
    const channel = supabase.channel("room-blocks-live").on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, () => void loadData()).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const filtered = blocks.filter((block) => {
    const room = roomOf(block)
    const text = `${room?.room_number || ""} ${room?.location || ""} ${block.reason} ${block.notes || ""}`.toLowerCase()
    return (statusFilter === "all" || block.status === statusFilter) && text.includes(search.toLowerCase())
  })

  const activeCount = blocks.filter((block) => block.status === "active").length
  const futureCount = blocks.filter((block) => block.status === "active" && block.start_date > new Date().toISOString().slice(0, 10)).length

  async function createBlock() {
    if (!form.room_id || !form.start_date || !form.end_date || !form.reason.trim()) return
    setSaving(true)
    setError(null)
    const { data: auth } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from("room_blocks").insert({ ...form, notes: form.notes || null, created_by: auth.user?.id || null })
    if (insertError) setError(insertError.message)
    else {
      setOpen(false)
      setForm({ room_id: "", start_date: "", end_date: "", block_type: "maintenance", reason: "", notes: "" })
      await loadData()
    }
    setSaving(false)
  }

  async function updateStatus(id: string, status: string) {
    const { error: updateError } = await supabase.from("room_blocks").update({ status, updated_at: new Date().toISOString() }).eq("id", id)
    if (updateError) setError(updateError.message)
    else await loadData()
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><h1 className="text-2xl font-bold">Bloqueos de habitaciones</h1><p className="text-sm text-muted-foreground">Retira inventario por mantenimiento, uso interno o indisponibilidad temporal.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nuevo bloqueo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear bloqueo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Habitación</Label><Select value={form.room_id} onValueChange={(value) => setForm({ ...form, room_id: value })}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{rooms.map((room) => <SelectItem key={room.id} value={room.id}>{room.room_number}{room.location ? ` · ${room.location}` : ""}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Desde</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div><div><Label>Hasta</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div></div>
              <div><Label>Tipo</Label><Select value={form.block_type} onValueChange={(value) => setForm({ ...form, block_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Motivo</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button className="w-full" onClick={createBlock} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar bloqueo</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Bloqueos activos</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{activeCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Programados</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{futureCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Habitaciones</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{rooms.length}</CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar habitación o motivo" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activos</SelectItem><SelectItem value="completed">Completados</SelectItem><SelectItem value="cancelled">Cancelados</SelectItem><SelectItem value="all">Todos</SelectItem></SelectContent></Select>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div> : filtered.length === 0 ? <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground"><CalendarOff className="mx-auto mb-3 h-8 w-8" />No hay bloqueos para mostrar.</div> : <div className="space-y-3">{filtered.map((block) => { const room = roomOf(block); return <Card key={block.id}><CardContent className="flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center"><div className="flex gap-3"><ShieldAlert className="mt-1 h-5 w-5 text-amber-600" /><div><div className="font-semibold">Habitación {room?.room_number || "—"} · {typeLabels[block.block_type] || block.block_type}</div><div className="text-sm text-muted-foreground">{block.start_date} → {block.end_date}{room?.location ? ` · ${room.location}` : ""}</div><div className="mt-1 text-sm">{block.reason}</div>{block.notes && <div className="text-xs text-muted-foreground">{block.notes}</div>}</div></div><div className="flex gap-2">{block.status === "active" && <><Button size="sm" variant="outline" onClick={() => updateStatus(block.id, "completed")}>Completar</Button><Button size="sm" variant="ghost" onClick={() => updateStatus(block.id, "cancelled")}>Cancelar</Button></>}</div></CardContent></Card> })}</div>}
    </div>
  )
}
