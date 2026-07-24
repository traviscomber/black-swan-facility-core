"use client"

import { cn } from "@/lib/utils"

type RoomState = {
  id: string
  room_number: string
  location: string | null
  room_type: string | null
  status: string | null
  // derived from joined reservations / housekeeping
  reservation_status?: string | null
  housekeeping_status?: string | null
  guest_name?: string | null
  check_out?: string | null
}

const ROOM_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; border: string; dot: string }
> = {
  clean: {
    label: "Limpia",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  dirty: {
    label: "Sucia",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    dot: "bg-amber-500",
  },
  occupied: {
    label: "Ocupada",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    dot: "bg-blue-500",
  },
  maintenance: {
    label: "Mant.",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    dot: "bg-rose-500",
  },
  available: {
    label: "Libre",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  blocked: {
    label: "Bloqueada",
    bg: "bg-muted/60",
    border: "border-border",
    dot: "bg-muted-foreground",
  },
}

const fallback = ROOM_STATUS_CONFIG.available

function statusCfg(status: string | null | undefined) {
  return ROOM_STATUS_CONFIG[status ?? ""] ?? fallback
}

function HousekeepingDot({ status }: { status?: string | null }) {
  const colors: Record<string, string> = {
    completed: "bg-emerald-500",
    in_progress: "bg-amber-500",
    pending: "bg-orange-400",
    skipped: "bg-muted-foreground",
  }
  return (
    <span
      title={`HK: ${status ?? "—"}`}
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        colors[status ?? ""] ?? "bg-muted-foreground/40",
      )}
    />
  )
}

export function RoomStateMatrix({ rooms }: { rooms: RoomState[] }) {
  if (rooms.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin habitaciones para mostrar.
      </p>
    )
  }

  // Group by location
  const groups = rooms.reduce<Record<string, RoomState[]>>((acc, r) => {
    const key = r.location ?? "Sin ubicacion"
    ;(acc[key] ??= []).push(r)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {Object.entries(ROOM_STATUS_CONFIG).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
            {cfg.label}
          </span>
        ))}
        <span className="ml-2 flex items-center gap-1.5 border-l pl-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          HK lista
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          HK en curso
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          HK pendiente
        </span>
      </div>

      {Object.entries(groups).map(([loc, locRooms]) => (
        <div key={loc}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {loc}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {locRooms.map((room) => {
              const cfg = statusCfg(room.status)
              return (
                <div
                  key={room.id}
                  className={cn(
                    "rounded-lg border p-3 space-y-2 transition-colors",
                    cfg.bg,
                    cfg.border,
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-semibold text-sm truncate">{room.room_number}</p>
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot)} />
                  </div>

                  <p className={cn("text-xs font-medium", cfg.dot.replace("bg-", "text-").replace("-500", "-400").replace("-400", "-400"))}>
                    {cfg.label}
                  </p>

                  {room.guest_name && (
                    <p className="truncate text-xs text-muted-foreground">
                      {room.guest_name.split(" ")[0]}
                      {room.check_out && (
                        <span className="ml-1 opacity-60">
                          → {room.check_out.substring(5)}
                        </span>
                      )}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5">
                    <HousekeepingDot status={room.housekeeping_status} />
                    <span className="text-xs text-muted-foreground">HK</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
