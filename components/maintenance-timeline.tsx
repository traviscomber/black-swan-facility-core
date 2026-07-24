"use client"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"

export function MaintenanceTimeline({ tasks }: any) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Maintenance Schedule</div>
      {tasks.map((t: any) => (
        <div key={t.id} className="flex items-center gap-2 rounded border p-2 text-xs">
          {t.priority >= 2 && <AlertCircle className="h-4 w-4 text-red-500" />}
          <div className="flex-1">
            <div className="font-medium">{t.maintenance_type} - {t.scheduled_date}</div>
            <div className="text-muted-foreground">{t.duration_minutes}min</div>
          </div>
          <Badge variant={t.status === "completed" ? "default" : "secondary"}>{t.status}</Badge>
        </div>
      ))}
    </div>
  )
}
