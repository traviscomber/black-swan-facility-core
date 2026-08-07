"use client"

import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/hooks/use-language"

type RoomState = {
  id: string
  room_number: string
  location: string | null
  room_type: string | null
  status: string | null
  reservation_status?: string | null
  housekeeping_status?: string | null
  guest_name?: string | null
  check_out?: string | null
}

const COPY = {
  en: { clean: "Clean", dirty: "Dirty", occupied: "Occupied", maintenance: "Maint.", available: "Available", blocked: "Blocked", noRooms: "No rooms to display.", noLocation: "No location", hkReady: "HK ready", hkProgress: "HK in progress", hkPending: "HK pending" },
  es: { clean: "Limpia", dirty: "Sucia", occupied: "Ocupada", maintenance: "Mant.", available: "Libre", blocked: "Bloqueada", noRooms: "Sin habitaciones para mostrar.", noLocation: "Sin ubicación", hkReady: "HK lista", hkProgress: "HK en curso", hkPending: "HK pendiente" },
  de: { clean: "Sauber", dirty: "Schmutzig", occupied: "Belegt", maintenance: "Wartung", available: "Frei", blocked: "Gesperrt", noRooms: "Keine Zimmer verfügbar.", noLocation: "Ohne Standort", hkReady: "HK bereit", hkProgress: "HK in Arbeit", hkPending: "HK ausstehend" },
} as const

export function RoomStateMatrix({ rooms }: { rooms: RoomState[] }) {
  const { language } = useLanguage()
  const copy = COPY[language]
  const roomStatusConfig: Record<string, { label: string; bg: string; border: string; dot: string }> = {
    clean: { label: copy.clean, bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-500" },
    dirty: { label: copy.dirty, bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-500" },
    occupied: { label: copy.occupied, bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-500" },
    maintenance: { label: copy.maintenance, bg: "bg-rose-500/10", border: "border-rose-500/30", dot: "bg-rose-500" },
    available: { label: copy.available, bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-500" },
    blocked: { label: copy.blocked, bg: "bg-muted/60", border: "border-border", dot: "bg-muted-foreground" },
  }
  const fallback = roomStatusConfig.available
  const groups = rooms.reduce<Record<string, RoomState[]>>((acc, room) => {
    const key = room.location ?? copy.noLocation
    ;(acc[key] ??= []).push(room)
    return acc
  }, {})

  if (rooms.length === 0) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{copy.noRooms}</p>

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {Object.entries(roomStatusConfig).map(([key, cfg]) => <span key={key} className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", cfg.dot)} />{cfg.label}</span>)}
      <span className="ml-2 flex items-center gap-1.5 border-l pl-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{copy.hkReady}<span className="h-2 w-2 rounded-full bg-amber-500" />{copy.hkProgress}<span className="h-2 w-2 rounded-full bg-orange-400" />{copy.hkPending}</span>
    </div>
    {Object.entries(groups).map(([location, locationRooms]) => <div key={location}><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{location}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{locationRooms.map((room) => {
      const cfg = roomStatusConfig[room.status ?? ""] ?? fallback
      const hkColors: Record<string, string> = { completed: "bg-emerald-500", in_progress: "bg-amber-500", pending: "bg-orange-400", skipped: "bg-muted-foreground" }
      return <div key={room.id} className={cn("space-y-2 rounded-lg border p-3 transition-colors", cfg.bg, cfg.border)}><div className="flex items-center justify-between gap-1"><p className="truncate text-sm font-semibold">{room.room_number}</p><span className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot)} /></div><p className="text-xs font-medium">{cfg.label}</p>{room.guest_name && <p className="truncate text-xs text-muted-foreground">{room.guest_name.split(" ")[0]}{room.check_out && <span className="ml-1 opacity-60">→ {room.check_out.substring(5)}</span>}</p>}<div className="flex items-center gap-1.5"><span title={`HK: ${room.housekeeping_status ?? "—"}`} className={cn("inline-block h-2 w-2 rounded-full", hkColors[room.housekeeping_status ?? ""] ?? "bg-muted-foreground/40")} /><span className="text-xs text-muted-foreground">HK</span></div></div>
    })}</div></div>)}
  </div>
}
