'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Clock3, Plus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AuthorizedNavigation as Navigation } from '@/lib/os/authorized-navigation-client'

type Language = 'en' | 'es' | 'de'

type Booking = {
  id: string
  guest_name: string | null
  check_in: string
  check_out: string
  status: string | null
  num_guests: number | null
}

type TaskAssignment = {
  employee_id: string | null
  employees: Array<{ id: string; name: string; role: string | null }> | null
}

type StaffTask = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  operational_area: string | null
  task_category: string | null
  source_label: string | null
  task_assignments: TaskAssignment[]
}

const COPY = {
  es: {
    title: 'Booking y personal',
    description: 'Las dos superficies principales para operar el día.',
    booking: 'Calendario de booking',
    bookingHint: 'Próximos 7 días · llegadas, salidas y estadías activas',
    openCalendar: 'Abrir calendario',
    prepareArrival: 'Preparar llegada',
    noBookings: 'Sin movimientos de booking en los próximos 7 días.',
    arrivals: 'llegadas',
    departures: 'salidas',
    stays: 'estadías',
    staff: 'Tareas del personal',
    staffHint: 'Trabajo vigente asignado a personas, sin demos ni snapshots de Asana',
    newTask: 'Nueva tarea',
    openTasks: 'Ver tareas',
    noTasks: 'Sin tareas operativas vigentes asignadas al personal.',
    overdue: 'Vencida',
    today: 'Hoy',
    inProgress: 'En curso',
    pending: 'Pendiente',
    loadError: 'No fue posible cargar el cockpit operativo.',
  },
  en: {
    title: 'Bookings and staff',
    description: 'The two primary surfaces for running the day.',
    booking: 'Booking calendar',
    bookingHint: 'Next 7 days · arrivals, departures and active stays',
    openCalendar: 'Open calendar',
    prepareArrival: 'Prepare arrival',
    noBookings: 'No booking movement in the next 7 days.',
    arrivals: 'arrivals',
    departures: 'departures',
    stays: 'stays',
    staff: 'Staff tasks',
    staffHint: 'Current work assigned to staff, excluding demos and Asana snapshots',
    newTask: 'New task',
    openTasks: 'View tasks',
    noTasks: 'No current operational staff tasks.',
    overdue: 'Overdue',
    today: 'Today',
    inProgress: 'In progress',
    pending: 'Pending',
    loadError: 'The operational cockpit could not be loaded.',
  },
  de: {
    title: 'Buchungen und Personal',
    description: 'Die zwei wichtigsten Flächen für den Tagesbetrieb.',
    booking: 'Buchungskalender',
    bookingHint: 'Nächste 7 Tage · Anreisen, Abreisen und aktive Aufenthalte',
    openCalendar: 'Kalender öffnen',
    prepareArrival: 'Anreise vorbereiten',
    noBookings: 'Keine Buchungsbewegung in den nächsten 7 Tagen.',
    arrivals: 'Anreisen',
    departures: 'Abreisen',
    stays: 'Aufenthalte',
    staff: 'Personalaufgaben',
    staffHint: 'Aktuelle zugewiesene Arbeit ohne Demos und Asana-Snapshots',
    newTask: 'Neue Aufgabe',
    openTasks: 'Aufgaben öffnen',
    noTasks: 'Keine aktuellen operativen Personalaufgaben.',
    overdue: 'Überfällig',
    today: 'Heute',
    inProgress: 'In Bearbeitung',
    pending: 'Ausstehend',
    loadError: 'Das operative Cockpit konnte nicht geladen werden.',
  },
} as const

function hasNavKey(navigation: Navigation, key: string) {
  return Boolean(navigation.items?.some((item) => item.key === key))
}

function chileToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function dateLabel(dateKey: string, language: Language) {
  const locale = language === 'es' ? 'es-CL' : language === 'de' ? 'de-DE' : 'en-US'
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00Z`))
}

function arrivalTaskHref(booking: Booking, language: Language) {
  const sourcePath = `/${language}/bookings/reservations/${booking.id}`
  const params = new URLSearchParams({
    new: '1',
    sourceType: 'hospitality_request',
    sourceId: booking.id,
    sourceLabel: `Reserva · ${booking.guest_name || booking.id}`,
    sourcePath,
    template: 'hosp-checkin',
    area: 'hospitalidad',
    dueDate: booking.check_in,
  })
  return `/${language}/tasks?${params.toString()}`
}

function isDemoTask(task: StaffTask) {
  return task.title.trim().startsWith('[DEMO]') || task.source_label?.startsWith('DEMO') === true
}

function isAsanaTask(task: StaffTask) {
  return task.task_category?.startsWith('asana_import') === true || task.source_label?.startsWith('Asana ·') === true
}

export function SantiagoOperationsCockpit({ language, navigation }: { language: Language; navigation: Navigation }) {
  const text = COPY[language]
  const [bookings, setBookings] = useState<Booking[]>([])
  const [tasks, setTasks] = useState<StaffTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const today = chileToday()
  const horizon = addDays(today, 6)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      setError(null)
      const [bookingResult, taskResult] = await Promise.all([
        hasNavKey(navigation, 'bookings')
          ? supabase
              .from('reservations')
              .select('id,guest_name,check_in,check_out,status,num_guests')
              .lte('check_in', horizon)
              .gte('check_out', today)
              .not('status', 'in', '(cancelled,canceled,cancelada)')
              .order('check_in', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        hasNavKey(navigation, 'tasks')
          ? supabase
              .from('tasks')
              .select('id,title,status,priority,due_date,operational_area,task_category,source_label,task_assignments(employee_id,employees(id,name,role))')
              .in('status', ['nueva', 'en_progreso'])
              .order('due_date', { ascending: true, nullsFirst: false })
              .order('created_at', { ascending: false })
              .limit(80)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (cancelled) return
      if (bookingResult.error || taskResult.error) {
        setError(text.loadError)
      }
      setBookings((bookingResult.data ?? []) as Booking[])
      setTasks(
        ((taskResult.data ?? []) as StaffTask[])
          .filter((task) => !isDemoTask(task) && !isAsanaTask(task))
          .filter((task) => task.task_assignments?.some((assignment) => assignment.employee_id && assignment.employees?.length))
          .slice(0, 12),
      )
    }

    void load()
    return () => { cancelled = true }
  }, [horizon, navigation, text.loadError, today])

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index)), [today])
  const taskRows = useMemo(() => [...tasks].sort((a, b) => {
    const aDate = a.due_date ?? '9999-12-31'
    const bDate = b.due_date ?? '9999-12-31'
    if (aDate !== bDate) return aDate.localeCompare(bDate)
    if (a.priority === 'urgente' && b.priority !== 'urgente') return -1
    if (b.priority === 'urgente' && a.priority !== 'urgente') return 1
    return a.title.localeCompare(b.title)
  }).slice(0, 8), [tasks])

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{text.title}</h2>
        <p className="text-sm text-muted-foreground">{text.description}</p>
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" />{text.booking}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{text.bookingHint}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto"><Link href={`/${language}/bookings/calendar`}>{text.openCalendar}</Link></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex snap-x snap-mandatory overflow-x-auto border-b sm:grid sm:grid-cols-4 sm:overflow-visible xl:grid-cols-7">
              {days.map((day) => {
                const arrivals = bookings.filter((booking) => booking.check_in === day).length
                const departures = bookings.filter((booking) => booking.check_out === day).length
                const stays = bookings.filter((booking) => booking.check_in <= day && booking.check_out > day).length
                const isToday = day === today
                return (
                  <Link href={`/${language}/bookings/calendar`} key={day} className={`min-h-24 min-w-[132px] snap-start border-r p-3 transition-colors hover:bg-muted/40 sm:min-h-28 sm:min-w-0 sm:border-t ${isToday ? 'bg-primary/5' : ''}`}>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{dateLabel(day, language)}</p>
                    <p className="mt-3 text-2xl font-semibold tabular-nums">{stays}</p>
                    <p className="text-[11px] text-muted-foreground">{text.stays}</p>
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                      {arrivals > 0 && <Badge variant="secondary">{arrivals} {text.arrivals}</Badge>}
                      {departures > 0 && <Badge variant="outline">{departures} {text.departures}</Badge>}
                    </div>
                  </Link>
                )
              })}
            </div>
            {bookings.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">{text.noBookings}</p>
            ) : (
              <div className="divide-y">
                {bookings.slice(0, 5).map((booking) => (
                  <div key={booking.id} className="flex flex-col gap-3 px-4 py-4 text-sm hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                    <Link href={`/${language}/bookings/reservations/${booking.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-medium">{booking.guest_name || 'Reserva'}</p>
                      <p className="text-xs text-muted-foreground">{booking.check_in} → {booking.check_out}</p>
                    </Link>
                    <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                      {booking.check_in >= today && hasNavKey(navigation, 'tasks') && (
                        <Button asChild size="sm" className="h-11 flex-1 sm:h-9 sm:flex-none">
                          <Link href={arrivalTaskHref(booking, language)}><Plus className="mr-1 h-3.5 w-3.5" />{text.prepareArrival}</Link>
                        </Button>
                      )}
                      <Badge variant="outline">{booking.num_guests ?? 0} <Users className="ml-1 h-3 w-3" /></Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4" />{text.staff}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{text.staffHint}</p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <Button asChild size="sm" className="h-11 sm:h-9"><Link href={`/${language}/tasks?new=1`}><Plus className="mr-1 h-3.5 w-3.5" />{text.newTask}</Link></Button>
                <Button asChild variant="outline" size="sm" className="h-11 sm:h-9"><Link href={`/${language}/tasks`}>{text.openTasks}</Link></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {taskRows.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">{text.noTasks}</p>
            ) : (
              <div className="divide-y">
                {taskRows.map((task) => {
                  const names = task.task_assignments.map((assignment) => assignment.employees?.[0]?.name?.trim()).filter(Boolean) as string[]
                  const overdue = Boolean(task.due_date && task.due_date < today)
                  const dueToday = task.due_date === today
                  return (
                    <Link href={`/${language}/tasks?selected=${task.id}`} key={task.id} className="block min-h-16 px-4 py-4 hover:bg-muted/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{task.title}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{names.join(', ')}</p>
                        </div>
                        <Badge variant={overdue ? 'destructive' : 'outline'}>
                          {overdue ? text.overdue : dueToday ? text.today : task.status === 'en_progreso' ? text.inProgress : text.pending}
                        </Badge>
                      </div>
                      {task.due_date && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />{task.due_date}</p>}
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
