'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, MapPin, Truck, Calendar, Clock, Zap } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { OperationFormDialog } from '@/components/operations/operation-form-dialog'

interface Operation {
  id: string
  operation_code: string
  title: string
  operation_type: string
  vehicle_id: string
  start_date: string
  end_date: string
  status: string
  distance_km: number
  duration_hours: number
  month: string
}

interface Vehicle {
  id: string
  name: string
  vehicle_type: string
  code: string
}

export default function OperationsPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [operations, setOperations] = useState<Operation[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [showFormDialog, setShowFormDialog] = useState(false)
  const supabase = createBrowserClient()

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  useEffect(() => {
    loadData()
  }, [currentMonth, selectedVehicle])

  async function loadData() {
    try {
      setLoading(true)
      const monthStr = format(currentMonth, 'yyyy-MM-01')

      let query = supabase
        .from('operations')
        .select('*')
        .eq('month', monthStr)
        .order('start_date', { ascending: false })

      if (selectedVehicle !== 'all') {
        query = query.eq('vehicle_id', selectedVehicle)
      }

      const { data: opsData, error: opsError } = await query

      if (opsError) throw opsError

      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'active')

      if (vehiclesError) throw vehiclesError

      setOperations(opsData || [])
      setVehicles(vehiclesData || [])
    } catch (error) {
      console.error('Error loading operations:', error)
    } finally {
      setLoading(false)
    }
  }

  function getOperationsForDay(day: Date) {
    return operations.filter(op => {
      const opDate = new Date(op.start_date)
      return isSameDay(opDate, day)
    })
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-300'
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-300'
      case 'planned':
        return 'bg-yellow-500/20 text-yellow-300'
      case 'cancelled':
        return 'bg-red-500/20 text-red-300'
      default:
        return 'bg-gray-500/20 text-gray-300'
    }
  }

  function getVehicleIcon(type: string) {
    return type === 'drone' ? '🚁' : type === 'tractor' ? '🚜' : '🚗'
  }

  const monthlyStats = {
    totalOperations: operations.length,
    totalDistance: operations.reduce((sum, op) => sum + (op.distance_km || 0), 0),
    totalHours: operations.reduce((sum, op) => sum + (op.duration_hours || 0), 0),
    activeVehicles: new Set(operations.map(op => op.vehicle_id)).size,
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-accent">Operaciones Mensuales</h1>
          <p className="text-muted-foreground">Seguimiento de viajes y operaciones por mes</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Operaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{monthlyStats.totalOperations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Distancia Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{monthlyStats.totalDistance.toFixed(0)} km</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Horas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{monthlyStats.totalHours.toFixed(1)} h</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Truck className="h-3 w-3" /> Vehículos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{monthlyStats.activeVehicles}</div>
            </CardContent>
          </Card>
        </div>

        {/* Month Navigation and Filters - Responsive */}
        <Card>
          <CardHeader className="p-3 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center justify-between md:justify-start gap-2 md:gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-base md:text-xl font-semibold">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="h-8 w-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="px-3 py-2 bg-input border border-border rounded-md text-sm"
                >
                  <option value="all">Todos los vehículos</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.code})
                    </option>
                  ))}
                </select>

                <Button 
                  size="sm" 
                  className="gap-2 w-full sm:w-auto"
                  onClick={() => setShowFormDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Nueva Operación</span>
                  <span className="sm:hidden">Nueva</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            {/* Calendar Grid - Responsive with better styling */}
            <div className="space-y-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 md:gap-3">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab'].map((day) => (
                  <div key={day} className="text-center font-bold text-sm md:text-base text-accent py-2 border-b-2 border-accent/30">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7 gap-2 md:gap-3 auto-rows-max">
                {daysInMonth.map((day) => {
                  const dayOps = getOperationsForDay(day)
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isToday = isSameDay(day, new Date())

                  return (
                    <div
                      key={day.toString()}
                      className={`rounded-lg border-2 transition-all hover:shadow-lg cursor-pointer ${
                        isToday
                          ? 'border-accent bg-accent/20'
                          : isCurrentMonth
                            ? 'border-border bg-card hover:bg-card/80'
                            : 'border-muted/20 bg-muted/10 text-muted-foreground'
                      } ${dayOps.length > 0 ? 'ring-2 ring-accent/30' : ''}`}
                      style={{ minHeight: '120px', padding: '12px' }}
                    >
                      {/* Day number */}
                      <div className={`text-sm md:text-base font-bold mb-2 ${isToday ? 'text-accent' : 'text-foreground'}`}>
                        {format(day, 'd')}
                      </div>

                      {/* Operations list */}
                      <div className="space-y-1">
                        {dayOps.slice(0, 2).map((op) => (
                          <div
                            key={op.id}
                            className={`text-xs rounded px-2 py-1 truncate flex items-center gap-1 ${getStatusColor(op.status)} hover:opacity-90 transition-opacity`}
                            title={op.title || ''}
                          >
                            <span className="flex-shrink-0">{getVehicleIcon(vehicles.find((v) => v.id === op.vehicle_id)?.vehicle_type || '')}</span>
                            <span className="flex-1 truncate">{op.title}</span>
                          </div>
                        ))}

                        {/* More operations indicator */}
                        {dayOps.length > 2 && (
                          <div className="text-xs px-2 py-1 text-accent font-semibold">
                            +{dayOps.length - 2} más
                          </div>
                        )}

                        {/* Operations count badge */}
                        {dayOps.length > 0 && (
                          <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
                            {dayOps.length} op{dayOps.length !== 1 ? 's' : ''}
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

        {/* Operations List */}
        <Card>
          <CardHeader>
            <CardTitle>Operaciones del Mes</CardTitle>
            <CardDescription>{operations.length} operaciones registradas</CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando operaciones...</div>
            ) : operations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No hay operaciones en este mes</div>
            ) : (
              <div className="space-y-2">
                {operations.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg hover:bg-secondary/60 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(op.status)}`}>
                          {op.status}
                        </span>
                        <h3 className="font-semibold text-accent truncate">{op.title}</h3>
                        <span className="text-xs text-muted-foreground">{op.operation_code}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{format(new Date(op.start_date), 'HH:mm')}</span>
                        {op.distance_km && <span>{op.distance_km.toFixed(1)} km</span>}
                        {op.duration_hours && <span>{op.duration_hours.toFixed(1)}h</span>}
                      </div>
                    </div>

                    <Button variant="ghost" size="sm">
                      Ver Detalles →
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <OperationFormDialog 
        open={showFormDialog} 
        onOpenChange={setShowFormDialog}
        vehicles={vehicles}
        onOperationCreated={() => {
          setShowFormDialog(false)
          loadData()
        }}
      />
    </AppLayout>
  )
}
