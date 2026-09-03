'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Search, Users } from 'lucide-react'
import { addMonths, eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { de, enUS, es } from 'date-fns/locale'
import { AppLayout } from '@/components/app-layout'
import { ActivitiesTimeline, type ActivityTimelineRecord } from '@/components/activities/activities-timeline'
import { ActivityFormDialog } from '@/components/activities/activity-form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/lib/hooks/use-language'
import { createBrowserClient } from '@/lib/supabase/client'

type Activity = ActivityTimelineRecord & { created_at: string }
interface ActivityType { id: string; name: string; color: string; icon: string; description: string }

const DATE_LOCALES = { en: enUS, es, de } as const
const LOCALE_TAGS = { en: 'en-US', es: 'es-CL', de: 'de-DE' } as const
const COPY = {
  en: { title: 'Activities calendar', subtitle: 'Uses the same temporal model as Bed Booking while preserving the existing CRUD flow.', new: 'New activity', search: 'Search activities...', all: 'All', loading: 'Loading activities…', upcoming: 'Upcoming activities', compact: 'Compact view; edit and delete preserve the existing workflow.', empty: 'No activities match the selected filters.', edit: 'Edit', delete: 'Delete', confirmDelete: 'Are you sure you want to delete this activity?' },
  es: { title: 'Calendario de actividades', subtitle: 'Misma lógica temporal que Bed Booking, con el CRUD existente intacto.', new: 'Nueva actividad', search: 'Buscar actividades...', all: 'Todas', loading: 'Cargando actividades…', upcoming: 'Próximas actividades', compact: 'Vista compacta; editar y eliminar conservan el flujo existente.', empty: 'No hay actividades para los filtros seleccionados.', edit: 'Editar', delete: 'Eliminar', confirmDelete: '¿Estás seguro de que quieres eliminar esta actividad?' },
  de: { title: 'Aktivitätenkalender', subtitle: 'Verwendet dasselbe Zeitmodell wie Bed Booking und bewahrt den bestehenden CRUD-Ablauf.', new: 'Neue Aktivität', search: 'Aktivitäten suchen...', all: 'Alle', loading: 'Aktivitäten werden geladen…', upcoming: 'Bevorstehende Aktivitäten', compact: 'Kompakte Ansicht; Bearbeiten und Löschen verwenden den bestehenden Ablauf.', empty: 'Keine Aktivitäten entsprechen den gewählten Filtern.', edit: 'Bearbeiten', delete: 'Löschen', confirmDelete: 'Möchtest du diese Aktivität wirklich löschen?' },
} as const

export default function ActivitiesCalendarPage() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const dateLocale = DATE_LOCALES[language]
  const localeTag = LOCALE_TAGS[language]
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [activities, setActivities] = useState<Activity[]>([])
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [selectedType, setSelectedType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const supabase = useMemo(() => createBrowserClient(), [])
  const dates = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth])

  useEffect(() => { void loadData() }, [currentMonth])

  async function loadData() {
    try {
      setLoading(true)
      const [typesResult, activitiesResult] = await Promise.all([
        supabase.from('activity_types').select('*'),
        supabase.from('activities').select('*').gte('start_date', format(startOfMonth(currentMonth), 'yyyy-MM-dd')).lte('start_date', format(endOfMonth(currentMonth), 'yyyy-MM-dd')),
      ])
      setActivityTypes(typesResult.data || [])
      setActivities(activitiesResult.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase(localeTag)
  const filteredActivities = useMemo(() => activities
    .filter((activity) => selectedType === 'all' || activity.activity_type_id === selectedType)
    .filter((activity) => !normalizedQuery || activity.title.toLocaleLowerCase(localeTag).includes(normalizedQuery) || activity.description?.toLocaleLowerCase(localeTag).includes(normalizedQuery)), [activities, localeTag, normalizedQuery, selectedType])

  function handleEditActivity(activity: ActivityTimelineRecord) { setEditingActivity(activity as Activity); setSelectedDate(null); setShowFormDialog(true) }
  function handleCreateActivity(date: Date | null) { setEditingActivity(null); setSelectedDate(date); setShowFormDialog(true) }
  async function handleDeleteActivity(activityId: string) {
    if (!confirm(copy.confirmDelete)) return
    try { await supabase.from('activities').delete().eq('id', activityId); setActivities((current) => current.filter((activity) => activity.id !== activityId)) }
    catch (error) { console.error('Error deleting activity:', error) }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1600px] space-y-5 px-3 py-6 sm:px-4 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-medium text-accent">{copy.title}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p></div><Button onClick={() => handleCreateActivity(null)}><Plus className="mr-2 h-4 w-4" />{copy.new}</Button></div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={copy.search} className="pl-9" /></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={selectedType === 'all' ? 'default' : 'outline'} onClick={() => setSelectedType('all')}>{copy.all}</Button>{activityTypes.map((type) => <Button key={type.id} size="sm" variant={selectedType === type.id ? 'default' : 'outline'} onClick={() => setSelectedType(type.id)}><span className="mr-1">{type.icon}</span>{type.name}</Button>)}</div></div>
        <div className="flex items-center justify-between border-y px-1 py-2"><Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button><div className="text-sm font-medium capitalize">{format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}</div><Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button></div>
        {loading ? <div className="border-y py-10 text-center text-sm text-muted-foreground">{copy.loading}</div> : <ActivitiesTimeline activities={filteredActivities} activityTypes={activityTypes} dates={dates} onEdit={handleEditActivity} onCreate={(date) => handleCreateActivity(date)} />}
        <section className="pt-2">
          <div className="mb-4"><h2 className="text-base font-medium">{copy.upcoming}</h2><p className="mt-1 text-sm text-muted-foreground">{copy.compact}</p></div>
          <div className="border-t">
            {filteredActivities.length === 0 && <p className="border-b py-8 text-center text-sm text-muted-foreground">{copy.empty}</p>}
            {filteredActivities.slice().sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 12).map((activity) => {
              const type = activityTypes.find((item) => item.id === activity.activity_type_id)
              return <div key={activity.id} className="flex flex-col gap-3 border-b px-1 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span>{type?.icon}</span><h3 className="truncate font-medium">{activity.title}</h3></div>{activity.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{activity.description}</p>}<div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(activity.start_date), 'dd MMM yyyy', { locale: dateLocale })}</span>{activity.start_time && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{activity.start_time}</span>}{activity.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{activity.location}</span>}{activity.capacity > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{activity.current_attendees || 0}/{activity.capacity}</span>}</div></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => handleEditActivity(activity)}>{copy.edit}</Button><Button variant="destructive" size="sm" onClick={() => void handleDeleteActivity(activity.id)}>{copy.delete}</Button></div></div>
            })}
          </div>
        </section>
      </div>
      <ActivityFormDialog open={showFormDialog} onOpenChange={setShowFormDialog} activityTypes={activityTypes} editingActivity={editingActivity} selectedDate={selectedDate} onActivitySaved={() => { setShowFormDialog(false); void loadData() }} />
    </AppLayout>
  )
}
