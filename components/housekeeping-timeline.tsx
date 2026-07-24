"use client"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function HousekeepingTimeline({ tasks, onStatusChange }: any) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Housekeeping Tasks</div>
      {tasks.map((t: any) => (
        <div key={t.id} className="flex items-center justify-between rounded border p-2 text-xs">
          <div>
            <div className="font-medium">Bed {t.bed_id}</div>
            <div className="text-muted-foreground">{t.cleaning_duration_minutes}min</div>
          </div>
          <Badge variant={t.status === "completed" ? "default" : "secondary"}>{t.status}</Badge>
          <Button size="sm" variant="ghost" onClick={() => onStatusChange(t.id, "completed")}>Mark Done</Button>
        </div>
      ))}
    </div>
  )
}
