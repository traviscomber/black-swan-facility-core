'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search, Filter, X, Calendar, Clock, MapPin, Users } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createBrowserClient } from '@/lib/supabase/client'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ActivityFormDialog } from '@/components/activities/activity-form-dialog'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Loading from './loading'

interface Activity {
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
  notes: any[]
  created_at: string
}

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
  const [selectedType, setSelectedType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const supabase = createBrowserClient()
  const searchParams = useSearchParams()

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  useEffect(() => {
    // Initialize activity types on very first load only
    const initAndLoad = async () => {
      await initializeActivityTypes()
      await loadData()
    }
    initAndLoad()
  }, [])

  useEffect(() => {
    // Load data when month changes
    loadData()
  }, [currentMonth])

  async function initializeActivityTypes() {
    try {
      console.log('[v0] Checking and initializing activity types...')
      const response = await fetch('/api/activity-types/init', { method: 'POST' })
      if (response.ok) {
        const result = await response.json()
        console.log('[v0] Activity types result:', result)
      } else {
        console.error('[v0] Failed to initialize activity types')
      }
    } catch (error) {
      console.error('[v0] Error initializing activity types:', error)
    }
  }

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

  function getActivitiesForDay(day: Date): Activity[] {
    const dayStr = format(day, 'yyyy-MM-dd')
    let filtered = activities.filter((a) => a.start_date === dayStr)

    if (selectedType !== 'all') {
      filtered = filtered.filter((a) => a.activity_type_id === selectedType)
    }

    if (searchQuery) {
      filtered = filtered.filter((a) =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }

  function getActivityType(typeId: string): ActivityType | undefined {
    return activityTypes.find((t) => t.id === typeId)
  }

  function handleEditActivity(activity: Activity) {
    setEditingActivity(activity)
    setShowFormDialog(true)
  }

  async function handleDeleteActivity(activityId: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta actividad?')) return

    try {
      await supabase.from('activities').delete().eq('id', activityId)
      setActivities(activities.filter((a) => a.id !== activityId))
    } catch (error) {
      console.error('Error deleting activity:', error)
    }
  }

  const filteredActivityTypes = selectedType === 'all' ? activityTypes : activityTypes.filter((t) => t.id === selectedType)
  
  // Get upcoming events (sorted and limited)
  const upcomingEvents = activities
    .filter((a) => selectedType === 'all' || a.activity_type_id === selectedType)
    .filter((a) =>
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 5)

  return (
    <AppLayout>
      <Suspense fallback={<Loading />}>
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8 md:py-12 lg:px-6 space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-accent">Calendario de Actividades</h1>
                <p className="text-muted-foreground mt-2">Gestiona y programa eventos, fiestas, deportes y más</p>
              </div>
              <Button size="lg" className="gap-2" onClick={() => {
                setEditingActivity(null)
                setShowFormDialog(true)
              }}>
                <Plus className="h-5 w-5" />
                Nueva Actividad
              </Button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar actividades..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType('all')}
                >
                  Todas
                </Button>
                {activityTypes.slice(0, 5).map((type) => (
                  <Button
                    key={type.id}
                    variant={selectedType === type.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedType(type.id)}
                    className="gap-1"
                  >
                    <span>{type.icon}</span>
                    {type.name}
                  </Button>
                ))}
                {activityTypes.length > 5 && (
                  <Button variant="outline" size="sm" disabled>
                    +{activityTypes.length - 5}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Calendar Grid with Upcoming Events Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-2xl font-bold text-accent min-w-48 text-center">
                      {format(currentMonth, 'MMMM yyyy', { locale: es })}
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {activities.length} eventos
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* Calendar Grid */}
                <div className="space-y-4">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-2">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab'].map((day) => (
                      <div key={day} className="text-center font-bold text-sm text-accent py-2 border-b-2 border-accent/30">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar cells */}
                  <div className="grid grid-cols-7 gap-2 auto-rows-max">
                    {daysInMonth.map((day) => {
                      const dayActivities = getActivitiesForDay(day)
                      const isCurrentMonth = isSameMonth(day, currentMonth)
                      const isToday = isSameDay(day, new Date())

                      return (
                        <div
                          key={day.toString()}
                          className={`rounded-lg border-2 transition-all min-h-24 p-2 cursor-pointer hover:shadow-lg ${
                            isToday
                              ? 'border-accent bg-accent/10'
                              : isCurrentMonth
                                ? 'border-border bg-card'
                                : 'border-muted/20 bg-muted/5 text-muted-foreground'
                          }`}
                          onClick={() => {
                            setSelectedDate(day)
                            setEditingActivity(null)
                            setShowFormDialog(true)
                          }}
                        >
                          {/* Day number */}
                          <div className={`text-xs font-bold mb-1 ${isToday ? 'text-accent' : 'text-foreground'}`}>
                            {format(day, 'd')}
                          </div>

                          {/* Activities */}
                          <div className="space-y-1">
                            {dayActivities.slice(0, 2).map((activity) => {
                              const type = getActivityType(activity.activity_type_id)
                              return (
                                <div
                                  key={activity.id}
                                  className="text-xs p-1 rounded bg-opacity-20 truncate cursor-pointer hover:opacity-80 transition-opacity text-white"
                                  style={{
                                    backgroundColor: activity.color_override || type?.color || '#726658',
                                    borderLeft: `3px solid ${activity.color_override || type?.color || '#726658'}`,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditActivity(activity)
                                  }}
                                  title={activity.title}
                                >
                                  <span className="mr-1">{type?.icon}</span>
                                  {activity.title}
                                </div>
                              )
                            })}
                            {dayActivities.length > 2 && (
                              <div className="text-xs text-accent font-semibold px-1">
                                +{dayActivities.length - 2} más
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Events Sidebar */}
            <Card className="lg:col-span-1 h-fit sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 bg-accent rounded" />
                  <CardTitle className="text-lg">Próximos eventos</CardTitle>
                </div>
                {upcomingEvents.length > 0 && (
                  <CardDescription>{upcomingEvents.length} eventos programados</CardDescription>
                )}
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {upcomingEvents.length > 0 ? (
                    upcomingEvents.map((activity) => {
                      const type = getActivityType(activity.activity_type_id)
                      const daysDiff = Math.floor(
                        (new Date(activity.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                      )
                      
                      return (
                        <div
                          key={activity.id}
                          className="border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer space-y-2 hover:bg-muted/50"
                          style={{
                            borderLeft: `4px solid ${activity.color_override || type?.color || '#726658'}`,
                          }}
                          onClick={() => handleEditActivity(activity)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-sm">{type?.icon}</span>
                                <h4 className="text-sm font-semibold text-accent truncate">{activity.title}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {daysDiff === 0 ? 'Hoy' : daysDiff === 1 ? 'Mañana' : `${daysDiff}d atrás`}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-accent/20 text-accent whitespace-nowrap flex-shrink-0">
                              {type?.name}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {format(parseISO(activity.start_date), 'dd MMM yyyy', { locale: es })}
                          </p>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No hay eventos próximos</p>
                    </div>
                  )}
                </div>

                {/* Legend */}
                {activityTypes.length > 0 && (
                  <div className="mt-6 pt-4 border-t space-y-2">
                    <p className="text-xs font-semibold text-foreground mb-3">Tipos de eventos</p>
                    <div className="space-y-2">
                      {activityTypes.slice(0, 6).map((type) => (
                        <div key={type.id} className="flex items-center gap-2 text-xs">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: type.color }}
                          />
                          <span className="text-muted-foreground">{type.name}</span>
                        </div>
                      ))}
                      {activityTypes.length > 6 && (
                        <p className="text-xs text-muted-foreground">+{activityTypes.length - 6} tipos más</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Activities List */}
          {activities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Todas las Actividades</CardTitle>
                <CardDescription>Listado completo de actividades programadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activities
                    .filter((a) => selectedType === 'all' || a.activity_type_id === selectedType)
                    .filter((a) =>
                      !searchQuery ||
                      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      a.description?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                    .slice(0, 10)
                    .map((activity) => {
                      const type = getActivityType(activity.activity_type_id)
                      return (
                        <div
                          key={activity.id}
                          className="border rounded-lg p-4 hover:shadow-md transition-shadow space-y-2"
                          style={{
                            borderLeftColor: activity.color_override || type?.color || '#726658',
                            borderLeftWidth: '4px',
                          }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{type?.icon}</span>
                                <h3 className="font-semibold text-accent truncate">{activity.title}</h3>
                                <span className="text-xs px-2 py-1 rounded bg-accent/20 text-accent whitespace-nowrap">
                                  {type?.name}
                                </span>
                              </div>
                              {activity.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{activity.description}</p>
                              )}
                              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(parseISO(activity.start_date), 'dd MMM yyyy', { locale: es })}
                                </div>
                                {activity.start_time && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {activity.start_time}
                                  </div>
                                )}
                                {activity.location && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {activity.location}
                                  </div>
                                )}
                                {activity.capacity && (
                                  <div className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {activity.current_attendees || 0}/{activity.capacity}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditActivity(activity)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteActivity(activity.id)}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Suspense>

      <ActivityFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        activityTypes={activityTypes}
        editingActivity={editingActivity}
        selectedDate={selectedDate}
        onActivitySaved={() => {
          setShowFormDialog(false)
          loadData()
        }}
      />
    </AppLayout>
  )
}
