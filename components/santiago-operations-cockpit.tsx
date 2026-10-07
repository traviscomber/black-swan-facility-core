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

type Pickup = {
  reservationId: string
  guestName: string | null
  checkIn: string
  transportMode: string
  carrierName: string | null
  serviceNumber: string | null
  originDestination: string | null
  hub: string
  anchorAt: string | null
  pickupRequired: boolean
  transportCoordinatorName: string | null
  status: string
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
    title: 'Hoy',
    booking: 'Reservas',
    openCalendar: 'Ver más',
    prepareArrival: 'Preparar',
    noBookings: 'Sin movimientos próximos.',
    arrivals: 'Llegan',
    departures: 'Salen',
    stays: 'Alojados',
    transport: 'Recogidas',
    noPickups: 'Sin recogidas pendientes.',
    coordinator: 'Encargado',
    flight: 'Vuelo',
    bus: 'Bus',
    vehicle: 'Vehículo',
    transfer: 'Traslado',
    unassigned: 'Por asignar',
    staff: 'Tareas',
    newTask: 'Nueva',
    openTasks: 'Ver más',
    noTasks: 'Sin tareas pendientes.',
    overdue: 'Vencida',
    today: 'Hoy',
    inProgress: 'En curso',
    pending: 'Pendiente',
    details: 'Detalles',
    loadError: 'No fue posible cargar la operación.'
  },
  en: {
    title: 'Today',
    booking: 'Bookings',
    openCalendar: 'View more',
    prepareArrival: 'Prepare',
    noBookings: 'No upcoming movement.',
    arrivals: 'Arrivals',
    departures: 'Departures',
    stays: 'Staying',
    transport: 'Pickups',
    noPickups: 'No pending pickups.',
    coordinator: 'Coordinator',
    flight: 'Flight',
    bus: 'Bus',
    vehicle: 'Vehicle',
    transfer: 'Transfer',
    unassigned: 'Unassigned',
    staff: 'Tasks',
    newTask: 'New',
    openTasks: 'View more',
    noTasks: 'No pending tasks.',
    overdue: 'Overdue',
    today: 'Today',
    inProgress: 'In progress',
    pending: 'Pending',
    details: 'Details',
    loadError: 'Operations could not be loaded.'
  },
  de: {
    title: 'Heute',
    booking: 'Buchungen',
    openCalendar: 'Mehr',
    prepareArrival: 'Vorbereiten',
    noBookings: 'Keine nächsten Bewegungen.',
    arrivals: 'Anreisen',
    departures: 'Abreisen',
    stays: 'Gäste',
    transport: 'Abholungen',
    noPickups: 'Keine ausstehenden Abholungen.',
    coordinator: 'Koordination',
    flight: 'Flug',
    bus: 'Bus',
    vehicle: 'Fahrzeug',
    transfer: 'Transfer',
    unassigned: 'Nicht zugewiesen',
    staff: 'Aufgaben',
    newTask: 'Neu',
    openTasks: 'Mehr',
    noTasks: 'Keine offenen Aufgaben.',
    overdue: 'Überfällig',
    today: 'Heute',
    inProgress: 'In Bearbeitung',
    pending: 'Ausstehend',
    details: 'Details',
    loadError: 'Der Betrieb konnte nicht geladen werden.'
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
  const [pickups, setPickups] = useState<Pickup[]>([])
  const [error, setError] = useState<string | null>(null)
  const today = chileToday()
  const horizon = addDays(today, 6)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      setError(null)
      const [bookingResult, taskResult, pickupResult] = await Promise.all([
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
        hasNavKey(navigation, 'bookings')
          ? supabase.rpc('get_upcoming_reservation_pickups', { p_from_date: today, p_to_date: horizon })
          : Promise.resolve({ data: [], error: null }),
      ])

      if (cancelled) return
      if (bookingResult.error || taskResult.error || pickupResult.error) {
        setError(text.loadError)
      }
      setBookings((bookingResult.data ?? []) as Booking[])
      setPickups((pickupResult.data ?? []) as Pickup[])
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
  }).filter((task) => !task.due_date || task.due_date <= addDays(today, 1)).slice(0, 5), [tasks, today])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{text.title}</h2>
        <p className="text-xs text-muted-foreground">{dateLabel(today, language)}</p>
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-3 xl:grid-cols-[1.15fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" />{text.booking}</CardTitle>
                
              </div>
              <Button asChild variant="ghost" size="sm"><Link href={`/${language}/bookings/calendar`}>{text.openCalendar}</Link></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex snap-x snap-mandatory overflow-x-auto border-b sm:grid sm:grid-cols-4 sm:overflow-visible xl:grid-cols-7">
              {days.slice(0, 3).map((day) => {
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
                {bookings.slice(0, 3).map((booking) => (
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
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{booking.num_guests ?? 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4" />{text.staff}</CardTitle>
                
              </div>
              <div className="flex items-center gap-1">
                <Button asChild size="sm" className="h-10"><Link href={`/${language}/tasks?new=1`}><Plus className="mr-1 h-3.5 w-3.5" />{text.newTask}</Link></Button>
                <Button asChild variant="ghost" size="sm"><Link href={`/${language}/tasks`}>{text.openTasks}</Link></Button>
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
                      {task.due_date && task.due_date !== today && <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />{task.due_date}</p>}
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{text.transport}</CardTitle>
              <Button asChild variant="ghost" size="sm"><Link href={`/${language}/bookings/calendar`}>{text.openCalendar}</Link></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {pickups.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">{text.noPickups}</p>
            ) : (
              <div className="divide-y">
                {pickups.slice(0, 3).map((pickup) => (
                  <Link href={`/${language}/bookings/reservations/${pickup.reservationId}`} key={pickup.reservationId} className="grid gap-2 px-4 py-4 hover:bg-muted/30 sm:grid-cols-[1.2fr_1fr_1fr] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{pickup.guestName || 'Reserva'}</p>
                      <p className="text-xs text-muted-foreground">{pickup.checkIn}{pickup.anchorAt ? ` · ${new Date(pickup.anchorAt).toLocaleString(language === 'es' ? 'es-CL' : language === 'de' ? 'de-DE' : 'en-US', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' })}` : ''}</p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{pickup.transportMode === 'flight' ? text.flight : pickup.transportMode === 'bus' ? text.bus : pickup.transportMode === 'private_vehicle' ? text.vehicle : text.transfer}</p>
                      <p className="text-xs text-muted-foreground">{[pickup.carrierName, pickup.serviceNumber, pickup.originDestination].filter(Boolean).join(' · ') || pickup.hub}</p>
                    </div>
                    <div className="text-sm sm:text-right">
                      <p className="font-medium">{pickup.transportCoordinatorName || text.unassigned}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
