import { temporalSpanGeometry } from "../calendar/temporal-foundation.ts"

type Activity = {
  id: string
  title: string
  activity_type_id: string
  start_date: string
  end_date?: string | null
  status?: string
  color_override?: string | null
}

type ActivityType = {
  id: string
  name: string
  color?: string | null
  icon?: string | null
}

export function normalizeActivitiesForTimeline(activities: Activity[], activityTypes: ActivityType[], dates: Date[]) {
  const byType = new Map(activityTypes.map((type) => [type.id, {
    id: type.id,
    label: type.name,
    icon: type.icon ?? "",
    color: type.color ?? null,
    events: [] as Array<Record<string, unknown>>,
  }]))

  for (const activity of activities) {
    const row = byType.get(activity.activity_type_id) ?? {
      id: activity.activity_type_id,
      label: "Other",
      icon: "",
      color: null,
      events: [] as Array<Record<string, unknown>>,
    }
    const end = activity.end_date && activity.end_date > activity.start_date ? activity.end_date : nextDay(activity.start_date)
    const geometry = temporalSpanGeometry(activity.start_date, end, dates)
    row.events.push({ ...activity, startsOn: activity.start_date, endsOn: end, left: geometry.left, width: geometry.width })
    byType.set(activity.activity_type_id, row)
  }

  return Array.from(byType.values()).filter((row) => row.events.length > 0)
}

function nextDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
