'use client'

import { format, isSameDay } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { DAY_WIDTH, LABEL_WIDTH, ROW_HEIGHT } from '@/lib/calendar/temporal-foundation'
import { normalizeActivitiesForTimeline } from '@/lib/activities/activities-timeline'

export type ActivityTimelineRecord = {
  id: string
  title: string
  activity_type_id: string
  start_date: string
  start_time: string | null
  end_date: string | null
  end_time: string | null
  description: string
  location: string
  capacity: number
  current_attendees: number
  color_override: string | null
  status: string
  recurring: boolean
  recurring_pattern: string | null
  recurring_end_date: string | null
  notes: any[]
  created_at?: string
}

type ActivityType = { id: string; name: string; color: string; icon: string }

export function ActivitiesTimeline({ activities, activityTypes, dates, onEdit, onCreate }: { activities: ActivityTimelineRecord[]; activityTypes: ActivityType[]; dates: Date[]; onEdit: (activity: ActivityTimelineRecord) => void; onCreate: (date: Date) => void }) {
  const rows = normalizeActivitiesForTimeline(activities, activityTypes, dates)
  const width = dates.length * DAY_WIDTH

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-auto">
          <div style={{ minWidth: LABEL_WIDTH + width }}>
            <div className="sticky top-0 z-20 flex border-b bg-background" style={{ height: ROW_HEIGHT }}>
              <div className="sticky left-0 z-30 flex shrink-0 items-center border-r bg-background px-3 text-xs font-semibold" style={{ width: LABEL_WIDTH }}>Activity type</div>
              <div className="relative flex" style={{ width }}>
                {dates.map((date) => <button type="button" key={date.toISOString()} onClick={() => onCreate(date)} className={`flex shrink-0 items-center justify-center border-r text-[10px] transition hover:bg-muted ${isSameDay(date, new Date()) ? 'bg-amber-50 font-bold' : 'text-muted-foreground'}`} style={{ width: DAY_WIDTH }} title={`Create activity on ${format(date, 'yyyy-MM-dd')}`}>{format(date, 'dd MMM')}</button>)}
              </div>
            </div>

            {rows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No activities match the selected filters. Select a date above to create one.</div>}
            {rows.map((row) => <div key={row.id} className="flex border-b" style={{ height: ROW_HEIGHT }}>
              <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-background px-3" style={{ width: LABEL_WIDTH }}><span>{row.icon}</span><span className="truncate text-xs font-semibold">{row.label}</span></div>
              <div className="relative" style={{ width, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_WIDTH - 1}px, hsl(var(--border)) ${DAY_WIDTH - 1}px, hsl(var(--border)) ${DAY_WIDTH}px)` }}>
                {row.events.map((raw) => {
                  const event = raw as unknown as ActivityTimelineRecord & { left: number; width: number }
                  const source = activities.find((item) => item.id === event.id)
                  return <button key={event.id} type="button" onClick={() => source && onEdit(source)} className="absolute top-[3px] h-[38px] overflow-hidden rounded-[3px] border px-2 text-left text-[11px] text-white transition hover:brightness-105" style={{ left: event.left, width: Math.max(event.width, 32), backgroundColor: event.color_override || row.color || '#726658' }} title={event.title}>
                    <div className="truncate font-semibold">{event.title}</div>
                    <div className="truncate text-[9px] opacity-80">{event.status}</div>
                  </button>
                })}
              </div>
            </div>)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
