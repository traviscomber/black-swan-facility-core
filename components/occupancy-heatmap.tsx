import { format, getDaysInMonth, startOfMonth } from "date-fns"
import { useMemo } from "react"

interface OccupancyHeatmapProps {
  reservations: any[]
  totalBeds: number
  startDate: Date
}

export function OccupancyHeatmap({ reservations, totalBeds, startDate }: OccupancyHeatmapProps) {
  const month = startOfMonth(startDate)
  const daysInMonth = getDaysInMonth(month)

  const occupancyByDay = useMemo(() => {
    const days: Record<number, number> = {}
    Array.from({ length: daysInMonth }, (_, i) => i + 1).forEach((day) => {
      days[day] = 0
    })
    reservations.forEach((r) => {
      const start = new Date(r.check_in)
      const end = new Date(r.check_out)
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(month.getFullYear(), month.getMonth(), d)
        if (date >= start && date < end) days[d]++
      }
    })
    return days
  }, [reservations, daysInMonth, month])

  const getColor = (occupied: number) => {
    const pct = (occupied / totalBeds) * 100
    if (pct >= 90) return "bg-red-500"
    if (pct >= 70) return "bg-orange-500"
    if (pct >= 50) return "bg-yellow-500"
    if (pct >= 30) return "bg-lime-500"
    return "bg-green-500"
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="text-sm font-medium">{format(month, "MMMM yyyy")} - Ocupación</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const occupied = occupancyByDay[day] || 0
          const pct = Math.round((occupied / totalBeds) * 100)
          return (
            <div
              key={day}
              className={`h-12 rounded flex items-center justify-center text-xs font-bold text-white cursor-help ${getColor(occupied)}`}
              title={`${day}: ${occupied}/${totalBeds} camas (${pct}%)`}
            >
              {day}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <div>🟢 &lt;30%</div>
        <div>🟡 30-50%</div>
        <div>🟠 50-70%</div>
        <div>🟠 70-90%</div>
        <div>🔴 &gt;90%</div>
      </div>
    </div>
  )
}
