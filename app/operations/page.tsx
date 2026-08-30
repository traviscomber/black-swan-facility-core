'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, MapPin, Truck, Clock } from 'lucide-react'
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, subMonths } from 'date-fns'
import { de, enUS, es } from 'date-fns/locale'
import { AppLayout } from '@/components/app-layout'
import { OperationFormDialog } from '@/components/operations/operation-form-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/lib/hooks/use-language'
import { createBrowserClient } from '@/lib/supabase/client'

interface Operation { id: string; operation_code: string; title: string; operation_type: string; vehicle_id: string; start_date: string; end_date: string; status: string; distance_km: number; duration_hours: number; month: string }
interface Vehicle { id: string; name: string; vehicle_type: string; code: string }

const DATE_LOCALES = { en: enUS, es, de } as const
const INTL_LOCALES = { en: 'en-US', es: 'es-CL', de: 'de-DE' } as const
const WEEKDAYS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
} as const
const COPY = {
  en: { title: 'Monthly operations', subtitle: 'Track trips and operations by month', total: 'Total operations', distance: 'Total distance', hours: 'Hours', vehicles: 'Vehicles', allVehicles: 'All vehicles', new: 'New operation', newShort: 'New', more: 'more', monthOps: 'Monthly operations', registered: 'operations recorded', loading: 'Loading operations...', empty: 'No operations this month', details: 'View details →' },
  es: { title: 'Operaciones mensuales', subtitle: 'Seguimiento de viajes y operaciones por mes', total: 'Total operaciones', distance: 'Distancia total', hours: 'Horas', vehicles: 'Vehículos', allVehicles: 'Todos los vehículos', new: 'Nueva operación', newShort: 'Nueva', more: 'más', monthOps: 'Operaciones del mes', registered: 'operaciones registradas', loading: 'Cargando operaciones...', empty: 'No hay operaciones en este mes', details: 'Ver detalles →' },
  de: { title: 'Monatliche Einsätze', subtitle: 'Fahrten und Einsätze nach Monat verfolgen', total: 'Einsätze gesamt', distance: 'Gesamtdistanz', hours: 'Stunden', vehicles: 'Fahrzeuge', allVehicles: 'Alle Fahrzeuge', new: 'Neuer Einsatz', newShort: 'Neu', more: 'weitere', monthOps: 'Einsätze des Monats', registered: 'Einsätze erfasst', loading: 'Einsätze werden geladen...', empty: 'Keine Einsätze in diesem Monat', details: 'Details anzeigen →' },
} as const
const STATUS_COPY = {
  en: { completed: 'Completed', in_progress: 'In progress', planned: 'Planned', cancelled: 'Cancelled' },
  es: { completed: 'Completada', in_progress: 'En curso', planned: 'Planificada', cancelled: 'Cancelada' },
  de: { completed: 'Abgeschlossen', in_progress: 'In Bearbeitung', planned: 'Geplant', cancelled: 'Storniert' },
} as const

export default function OperationsPage() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const dateLocale = DATE_LOCALES[language]
  const number = useMemo(() => new Intl.NumberFormat(INTL_LOCALES[language], { maximumFractionDigits: 1 }), [language])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [operations, setOperations] = useState<Operation[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [showFormDialog, setShowFormDialog] = useState(false)
  const supabase = useMemo(() => createBrowserClient(), [])
  const daysInMonth = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth])

  useEffect(() => { void loadData() }, [currentMonth, selectedVehicle])

  async function loadData() {
    try {
      setLoading(true)
      const monthStr = format(currentMonth, 'yyyy-MM-01')
      let query = supabase.from('operations').select('*').eq('month', monthStr).order('start_date', { ascending: false })
      if (selectedVehicle !== 'all') query = query.eq('vehicle_id', selectedVehicle)
      const [operationsResult, vehiclesResult] = await Promise.all([query, supabase.from('vehicles').select('*').eq('status', 'active')])
      if (operationsResult.error) throw operationsResult.error
      if (vehiclesResult.error) throw vehiclesResult.error
      setOperations(operationsResult.data || [])
      setVehicles(vehiclesResult.data || [])
    } catch (error) {
      console.error('Error loading operations:', error)
    } finally {
      setLoading(false)
    }
  }

  const getOperationsForDay = (day: Date) => operations.filter((operation) => isSameDay(new Date(operation.start_date), day))
  const getStatusColor = (status: string) => status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : status === 'in_progress' ? 'bg-blue-500/20 text-blue-300' : status === 'planned' ? 'bg-yellow-500/20 text-yellow-300' : status === 'cancelled' ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-300'
  const getVehicleIcon = (type: string) => type === 'drone' ? '🚁' : type === 'tractor' ? '🚜' : '🚗'
  const monthlyStats = { totalOperations: operations.length, totalDistance: operations.reduce((sum, operation) => sum + (operation.distance_km || 0), 0), totalHours: operations.reduce((sum, operation) => sum + (operation.duration_hours || 0), 0), activeVehicles: new Set(operations.map((operation) => operation.vehicle_id)).size }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold text-accent">{copy.title}</h1><p className="text-muted-foreground">{copy.subtitle}</p></div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Metric title={copy.total} value={number.format(monthlyStats.totalOperations)} />
          <Metric title={copy.distance} value={`${number.format(monthlyStats.totalDistance)} km`} icon={<MapPin className="h-3 w-3" />} />
          <Metric title={copy.hours} value={`${number.format(monthlyStats.totalHours)} h`} icon={<Clock className="h-3 w-3" />} />
          <Metric title={copy.vehicles} value={number.format(monthlyStats.activeVehicles)} icon={<Truck className="h-3 w-3" />} />
        </div>
        <Card>
          <CardHeader className="p-3 md:p-6"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center justify-between gap-2 md:justify-start md:gap-4"><Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button><h2 className="text-base font-semibold capitalize md:text-xl">{format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}</h2><Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button></div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"><select value={selectedVehicle} onChange={(event) => setSelectedVehicle(event.target.value)} className="rounded-md border border-border bg-input px-3 py-2 text-sm"><option value="all">{copy.allVehicles}</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} ({vehicle.code})</option>)}</select><Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => setShowFormDialog(true)}><Plus className="h-4 w-4" /><span className="hidden sm:inline">{copy.new}</span><span className="sm:hidden">{copy.newShort}</span></Button></div>
          </div></CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0"><div className="space-y-4"><div className="grid grid-cols-7 gap-2 md:gap-3">{WEEKDAYS[language].map((day) => <div key={day} className="border-b-2 border-accent/30 py-2 text-center text-sm font-bold text-accent md:text-base">{day}</div>)}</div><div className="grid auto-rows-max grid-cols-7 gap-2 md:gap-3">{daysInMonth.map((day) => {
            const dayOps = getOperationsForDay(day); const current = isSameMonth(day, currentMonth); const today = isSameDay(day, new Date())
            return <div key={day.toString()} className={`cursor-pointer rounded-lg border-2 transition-all hover:shadow-lg ${today ? 'border-accent bg-accent/20' : current ? 'border-border bg-card hover:bg-card/80' : 'border-muted/20 bg-muted/10 text-muted-foreground'} ${dayOps.length > 0 ? 'ring-2 ring-accent/30' : ''}`} style={{ minHeight: '120px', padding: '12px' }}><div className={`mb-2 text-sm font-bold md:text-base ${today ? 'text-accent' : 'text-foreground'}`}>{format(day, 'd')}</div><div className="space-y-1">{dayOps.slice(0, 2).map((operation) => <div key={operation.id} className={`flex items-center gap-1 truncate rounded px-2 py-1 text-xs ${getStatusColor(operation.status)}`} title={operation.title || ''}><span>{getVehicleIcon(vehicles.find((vehicle) => vehicle.id === operation.vehicle_id)?.vehicle_type || '')}</span><span className="flex-1 truncate">{operation.title}</span></div>)}{dayOps.length > 2 && <div className="px-2 py-1 text-xs font-semibold text-accent">+{number.format(dayOps.length - 2)} {copy.more}</div>}{dayOps.length > 0 && <div className="border-t border-border/30 pt-1 text-xs text-muted-foreground">{number.format(dayOps.length)} op</div>}</div></div>
          })}</div></div></CardContent>
        </Card>
        <Card><CardHeader><CardTitle>{copy.monthOps}</CardTitle><CardDescription>{number.format(operations.length)} {copy.registered}</CardDescription></CardHeader><CardContent>{loading ? <div className="py-8 text-center text-muted-foreground">{copy.loading}</div> : operations.length === 0 ? <div className="py-8 text-center text-muted-foreground">{copy.empty}</div> : <div className="space-y-2">{operations.map((operation) => <div key={operation.id} className="flex cursor-pointer items-center justify-between rounded-lg bg-secondary/40 p-3 transition-colors hover:bg-secondary/60"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`rounded px-2 py-1 text-xs ${getStatusColor(operation.status)}`}>{STATUS_COPY[language][operation.status as keyof typeof STATUS_COPY.en] ?? operation.status}</span><h3 className="truncate font-semibold text-accent">{operation.title}</h3><span className="text-xs text-muted-foreground">{operation.operation_code}</span></div><div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground"><span>{format(new Date(operation.start_date), 'HH:mm')}</span>{operation.distance_km ? <span>{number.format(operation.distance_km)} km</span> : null}{operation.duration_hours ? <span>{number.format(operation.duration_hours)} h</span> : null}</div></div><Button variant="ghost" size="sm">{copy.details}</Button></div>)}</div>}</CardContent></Card>
      </div>
      <OperationFormDialog open={showFormDialog} onOpenChange={setShowFormDialog} vehicles={vehicles} onOperationCreated={() => { setShowFormDialog(false); void loadData() }} />
    </AppLayout>
  )
}

function Metric({ title, value, icon }: { title: string; value: string; icon?: React.ReactNode }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-1 text-sm font-medium text-muted-foreground">{icon}{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-accent">{value}</div></CardContent></Card>
}
