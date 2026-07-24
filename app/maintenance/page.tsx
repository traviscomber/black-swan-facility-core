'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ClipboardList, Filter, Plus, RefreshCw, Wrench } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MaintenanceWeekView } from '@/components/maintenance-week-view'
import { MaintenanceQuickAddDrawer } from '@/components/maintenance-quick-add-drawer'
import { createClient } from '@/lib/supabase/client'

type MaintenanceTask = {
  id: string
  title: string
  description?: string | null
  status?: string | null
  estado_extendido?: string | null
  prioridad?: string | null
  priority?: string | null
  next_run?: string | null
  last_completed?: string | null
  assigned_to?: string | null
  bloqueado?: boolean | null
  assets?: { name?: string | null } | null
  employees?: { name?: string | null } | null
}

const STATE_LABELS: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  assigned: 'Asignada',
  in_progress: 'En ejecución',
  completed: 'Completada',
}

export default function MaintenancePage() {
  const supabase = useMemo(() => createClient(), [])
  const [tasks, setTasks] = useState<MaintenanceTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [filters, setFilters] = useState({ state: 'all', priority: 'all', unassigned: false })

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from('maintenance_tasks')
      .select('*, assets(name), employees(name)')
      .order('next_run', { ascending: true, nullsFirst: false })

    if (loadError) {
      setError(loadError.message)
      setTasks([])
    } else {
      setTasks(((data ?? []) as MaintenanceTask[]).map((task) => ({ ...task, priority: task.prioridad ?? task.priority ?? 'medium' })))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const taskState = task.estado_extendido ?? task.status ?? 'draft'
    const taskPriority = task.prioridad ?? task.priority ?? 'medium'
    return (filters.state === 'all' || taskState === filters.state)
      && (filters.priority === 'all' || taskPriority === filters.priority)
      && (!filters.unassigned || !task.assigned_to)
  }), [tasks, filters])

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(now.getDate() - now.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const completedThisWeek = tasks.filter((task) => {
    if (!task.last_completed) return false
    const date = new Date(task.last_completed)
    return date >= weekStart && date < weekEnd
  }).length
  const pending = tasks.filter((task) => !['completed', 'cancelled'].includes(task.estado_extendido ?? task.status ?? '')).length
  const overdue = tasks.filter((task) => task.next_run && new Date(task.next_run) < now && !['completed', 'cancelled'].includes(task.estado_extendido ?? task.status ?? '')).length
  const blocked = tasks.filter((task) => task.bloqueado).length

  return (
    <AppLayout>
      <PageHeader
        title="Mantenimiento · Fundo Corcovado"
        description="Planificación y seguimiento de trabajos preventivos y correctivos sobre activos e infraestructura de la operación en Valdivia."
        actions={<Button onClick={() => setIsDrawerOpen(true)}><Plus className="mr-2 h-4 w-4" />Registrar trabajo</Button>}
      />

      <div className="space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Contexto operativo</CardTitle></CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Esta sección administra trabajos de mantenimiento. Las incidencias reportadas por usuarios se gestionan por separado y pueden transformarse en tareas cuando requieren ejecución técnica.
          </CardContent>
        </Card>

        {error && <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><span>No fue posible cargar mantenimiento: {error}</span><Button variant="outline" size="sm" onClick={fetchTasks}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric title="Trabajos registrados" value={tasks.length} />
          <Metric title="Completados esta semana" value={completedThisWeek} />
          <Metric title="Pendientes" value={pending} />
          <Metric title="Vencidos" value={overdue} alert={overdue > 0} />
          <Metric title="Bloqueados" value={blocked} alert={blocked > 0} />
        </div>

        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Filter className="h-4 w-4" /><CardTitle className="text-base">Filtros operativos</CardTitle></div></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">Estado<select value={filters.state} onChange={(e) => setFilters((current) => ({ ...current, state: e.target.value }))} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="all">Todos los estados</option>{Object.entries(STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm font-medium">Prioridad<select value={filters.priority} onChange={(e) => setFilters((current) => ({ ...current, priority: e.target.value }))} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="all">Todas las prioridades</option><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium"><input type="checkbox" checked={filters.unassigned} onChange={(e) => setFilters((current) => ({ ...current, unassigned: e.target.checked }))} />Solo trabajos sin responsable</label>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/issues"><AlertCircle className="mr-2 h-4 w-4" />Ver incidencias abiertas</Link></Button>
          <Button asChild variant="outline"><Link href="/tasks"><ClipboardList className="mr-2 h-4 w-4" />Ver tareas generales</Link></Button>
        </div>

        {loading ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Cargando trabajos de mantenimiento…</CardContent></Card> : filteredTasks.length === 0 ? <Card><CardContent className="py-12 text-center"><Wrench className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">No hay trabajos para los filtros seleccionados.</p><p className="mt-1 text-sm text-muted-foreground">Registra un trabajo o revisa las incidencias abiertas.</p></CardContent></Card> : <MaintenanceWeekView tasks={filteredTasks as never[]} />}
      </div>

      <MaintenanceQuickAddDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onTaskCreated={fetchTasks} />
    </AppLayout>
  )
}

function Metric({ title, value, alert = false }: { title: string; value: number; alert?: boolean }) {
  return <Card className={alert ? 'border-amber-300' : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value.toLocaleString('es-CL')}</div></CardContent></Card>
}
