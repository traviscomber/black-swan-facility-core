'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Search, Users } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { ActivitiesTimeline, type ActivityTimelineRecord } from '@/components/activities/activities-timeline'
import { ActivityFormDialog } from '@/components/activities/activity-form-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createBrowserClient } from '@/lib/supabase/client'
import { addMonths, eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'

type Activity = ActivityTimelineRecord & { created_at: string }

interface ActivityType {
  id: string
  name: string
  color: string
  icon: string
  description: string
}

export default function ActivitiesCalendarPage() {
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

  useEffect(() => {
    void loadData()
  }, [currentMonth])

  async function loadData() {
    try {
      setLoading(true)
      const [typesResult, activitiesResult] = await Promise.all([
        supabase.from('activity_types').select('*'),
        supabase
          .from('activities')
          .select('*')
          .gte('start_date', format(startOfMonth(currentMonth), 'yyyy-MM-dd'))
          .lte('start_date', format(endOfMonth(currentMonth), 'yyyy-MM-dd')),
      ])
      setActivityTypes(typesResult.data || [])
      setActivities(activitiesResult.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredActivities = useMemo(() => activities
    .filter((activity) => selectedType === 'all' || activity.activity_type_id === selectedType)
    .filter((activity) => !searchQuery || activity.title.toLowerCase().includes(searchQuery.toLowerCase()) || activity.description?.toLowerCase().includes(searchQuery.toLowerCase())), [activities, searchQuery, selectedType])

  function handleEditActivity(activity: ActivityTimelineRecord) {
    setEditingActivity(activity as Activity)
    setSelectedDate(null)
    setShowFormDialog(true)
  }

  function handleCreateActivity(date: Date | null) {
    setEditingActivity(null)
    setSelectedDate(date)
    setShowFormDialog(true)
  }

  async function handleDeleteActivity(activityId: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta actividad?')) return
    try {
      await supabase.from('activities').delete().eq('id', activityId)
      setActivities((current) => current.filter((activity) => activity.id !== activityId))
    } catch (error) {
      console.error('Error deleting activity:', error)
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1600px] space-y-5 px-3 py-6 sm:px-4 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-accent">Calendario de Actividades</h1>
            <p className="mt-1 text-sm text-muted-foreground">Misma lógica temporal que Bed Booking, con el CRUD existente intacto.</p>
          </div>
          <Button onClick={() => handleCreateActivity(null)}><Plus className="mr-2 h-4 w-4" />Nueva Actividad</Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar actividades..." className="pl-9" /></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={selectedType === 'all' ? 'default' : 'outline'} onClick={() => setSelectedType('all')}>Todas</Button>
            {activityTypes.map((type) => <Button key={type.id} size="sm" variant={selectedType === type.id ? 'default' : 'outline'} onClick={() => setSelectedType(type.id)}><span className="mr-1">{type.icon}</span>{type.name}</Button>)}
          </div>
        </div>

        <div className="flex items-center justify-between rounded border bg-card px-3 py-2">
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-sm font-semibold capitalize">{format(currentMonth, 'MMMM yyyy', { locale: es })}</div>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        {loading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Cargando actividades…</CardContent></Card> : <ActivitiesTimeline activities={filteredActivities} activityTypes={activityTypes} dates={dates} onEdit={handleEditActivity} onCreate={(date) => handleCreateActivity(date)} />}

        <Card>
          <CardHeader><CardTitle>Próximas Actividades</CardTitle><CardDescription>Vista compacta; editar y eliminar conservan el flujo existente.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {filteredActivities.length === 0 && <p className="text-sm text-muted-foreground">No hay actividades para los filtros seleccionados.</p>}
            {filteredActivities.slice().sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 12).map((activity) => {
              const type = activityTypes.find((item) => item.id === activity.activity_type_id)
              return <div key={activity.id} className="flex flex-col gap-3 rounded border p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span>{type?.icon}</span><h3 className="truncate font-semibold">{activity.title}</h3></div>
                  {activity.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{activity.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(activity.start_date), 'dd MMM yyyy', { locale: es })}</span>
                    {activity.start_time && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{activity.start_time}</span>}
                    {activity.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{activity.location}</span>}
                    {activity.capacity > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{activity.current_attendees || 0}/{activity.capacity}</span>}
                  </div>
                </div>
                <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => handleEditActivity(activity)}>Editar</Button><Button variant="destructive" size="sm" onClick={() => void handleDeleteActivity(activity.id)}>Eliminar</Button></div>
              </div>
            })}
          </CardContent>
        </Card>
      </div>

      <ActivityFormDialog open={showFormDialog} onOpenChange={setShowFormDialog} activityTypes={activityTypes} editingActivity={editingActivity} selectedDate={selectedDate} onActivitySaved={() => { setShowFormDialog(false); void loadData() }} />
    </AppLayout>
  )
}
