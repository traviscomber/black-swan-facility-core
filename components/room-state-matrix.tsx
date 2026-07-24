"use client"
import { Badge } from "@/components/ui/badge"

export function RoomStateMatrix({ rooms }: any) {
  return (
    <div className="grid grid-cols-4 gap-2 text-xs">
      {rooms.map((r: any) => (
        <div key={r.bed_id} className="rounded border p-2 space-y-1">
          <div className="font-medium">Bed {r.bed_number}</div>
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="text-[10px]">{r.reservation_status}</Badge>
            <Badge variant="outline" className="text-[10px]">{r.housekeeping_status}</Badge>
            <Badge variant="outline" className="text-[10px]">{r.availability_status}</Badge>
          </div>
        </div>
      ))}
    </div>
  )
}
