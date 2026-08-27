'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Package, Sparkles, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useOsPersona } from '@/lib/hooks/use-os-persona'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

type NavItem = { key: string; label: string; href: string }
type Navigation = { role?: string; items?: NavItem[] }
type WorkItem = { id: string; kind: 'task' | 'maintenance' | 'housekeeping'; title: string; status: string; detail: string | null; href: string }
type AttentionSignal = { key: string; label: string; value: number; detail: string; href: string }

async function loadNavigation(): Promise<Navigation> {
  if (!operationsApi) throw new Error('NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL is not configured.')
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Authentication required')
  const response = await fetch(`${operationsApi}/v1/os/navigation`, { headers: { authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || 'Unable to load navigation')
  return body.data as Navigation
}

function hasNavKey(navigation: Navigation, key: string) {
  return Boolean(navigation.items?.some((item) => item.key === key))
}

function chileDateKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function FieldAdminHome() {
  const supabase = useMemo(() => createClient(), [])
  const { employeeId, firstName, personaLabel } = useOsPersona()
  const [navigation, setNavigation] = useState<Navigation | null>(null)
  const [work, setWork] = useState<WorkItem[]>([])
  const [attention, setAttention] = useState<AttentionSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nav = await loadNavigation()
      setNavigation(nav)
      const today = chileDateKey()
      const personal: WorkItem[] = []

      if (employeeId && hasNavKey(nav, 'tasks')) {
        const assignments = await supabase.from('task_assignments').select('task_id').eq('employee_id', employeeId)
        if (assignments.error) throw assignments.error
        const taskIds = (assignments.data ?? []).map((row) => row.task_id)
        if (taskIds.length > 0) {
          const tasks = await supabase
            .from('tasks')
            .select('id,title,status,priority,due_date')
            .in('id', taskIds)
            .not('status', 'in', '(completada,completed,cancelled,canceled)')
            .order('due_date', { ascending: true, nullsFirst: false })
            .limit(12)
          if (tasks.error) throw tasks.error
          personal.push(...(tasks.data ?? []).map((item) => ({
            id: item.id,
            kind: 'task' as const,
            title: item.title || 'Tarea operativa',
            status: item.status,
            detail: item.due_date ? `Vence ${item.due_date}${item.priority ? ` · ${item.priority}` : ''}` : item.priority,
            href: '/tasks',
          })))
        }
      }

      if (employeeId && hasNavKey(nav, 'maintenance')) {
        const maintenance = await supabase
          .from('maintenance_tasks')
          .select('id,title,status,prioridad,fecha_objetivo,bloqueado')
          .eq('assigned_to', employeeId)
          .not('status', 'in', '(completada,completed,cancelada,cancelled,canceled)')
          .order('fecha_objetivo', { ascending: true, nullsFirst: false })
          .limit(12)
        if (maintenance.error) throw maintenance.error
        personal.push(...(maintenance.data ?? []).map((item) => ({
          id: item.id,
          kind: 'maintenance' as const,
          title: item.title || 'Mantenimiento',
          status: item.status,
          detail: `${item.bloqueado ? 'Bloqueado · ' : ''}${item.fecha_objetivo ? `Objetivo ${item.fecha_objetivo}` : 'Sin fecha objetivo'}${item.prioridad ? ` · ${item.prioridad}` : ''}`,
          href: '/maintenance',
        })))
      }

      if (employeeId && hasNavKey(nav, 'bookings')) {
        const housekeeping = await supabase
          .from('housekeeping_tasks')
          .select('id,task_type,status,priority,service_date')
          .eq('assigned_to', employeeId)
          .not('status', 'in', '(completed,cancelled,canceled)')
          .order('service_date', { ascending: true, nullsFirst: false })
          .limit(12)
        if (housekeeping.error) throw housekeeping.error
        personal.push(...(housekeeping.data ?? []).map((item) => ({
          id: item.id,
          kind: 'housekeeping' as const,
          title: item.task_type || 'Housekeeping',
          status: item.status,
          detail: item.service_date ? `Servicio ${item.service_date}${item.priority ? ` · ${item.priority}` : ''}` : item.priority,
          href: '/bookings/housekeeping',
        })))
      }

      const zero = Promise.resolve({ count: 0, error: null })
      const [blockedMaintenance, overdueMaintenance, openIssues, criticalStock, replenishment] = await Promise.all([
        hasNavKey(nav, 'maintenance')
          ? supabase.from('maintenance_tasks').select('id', { count: 'exact', head: true }).eq('bloqueado', true).not('status', 'in', '(completada,completed,cancelada,cancelled,canceled)')
          : zero,
        hasNavKey(nav, 'maintenance')
          ? supabase.from('maintenance_tasks').select('id', { count: 'exact', head: true }).lte('fecha_objetivo', today).not('status', 'in', '(completada,completed,cancelada,cancelled,canceled)')
          : zero,
        hasNavKey(nav, 'issues')
          ? supabase.from('issues').select('id', { count: 'exact', head: true }).neq('status', 'resolved')
          : zero,
        hasNavKey(nav, 'inventory')
          ? supabase.from('inventory_stock_status').select('*', { count: 'exact', head: true }).in('stock_state', ['low', 'out'])
          : zero,
        hasNavKey(nav, 'inventory')
          ? supabase.from('inventory_replenishment_needs').select('id', { count: 'exact', head: true }).in('status', ['open', 'requested', 'sourcing', 'ordered', 'receiving'])
          : zero,
      ])

      const signalError = blockedMaintenance.error || overdueMaintenance.error || openIssues.error || criticalStock.error || replenishment.error
      if (signalError) throw signalError

      const nextAttention: AttentionSignal[] = [
        { key: 'maintenance-blocked', label: 'Mantenimiento bloqueado', value: blockedMaintenance.count ?? 0, detail: 'Necesita destrabe para seguir', href: '/maintenance' },
        { key: 'maintenance-overdue', label: 'Mantenimiento vencido', value: overdueMaintenance.count ?? 0, detail: 'Fecha objetivo cumplida', href: '/maintenance' },
        { key: 'issues', label: 'Incidentes abiertos', value: openIssues.count ?? 0, detail: 'Hallazgos sin resolver', href: '/issues' },
        { key: 'stock', label: 'Stock crítico', value: criticalStock.count ?? 0, detail: 'Bajo mínimo o sin stock', href: '/inventory/stock' },
        { key: 'replenishment', label: 'Reposición en curso', value: replenishment.count ?? 0, detail: 'Necesidades todavía abiertas', href: '/inventory/replenishment' },
      ].filter((signal) => signal.value > 0)

      setWork(personal)
      setAttention(nextAttention)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar la operación del campo')
      setWork([])
      setAttention([])
    } finally {
      setLoading(false)
    }
  }, [employeeId, supabase])

  useEffect(() => { void load() }, [load])

  const quickWorkspaces = useMemo(() => {
    const items = navigation?.items ?? []
    return ['tasks', 'maintenance', 'inventory', 'bookings', 'map', 'procurement']
      .map((key) => items.find((item) => item.key === key))
      .filter((item): item is NavItem => Boolean(item))
      .slice(0, 6)
  }, [navigation])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{`Hoy${firstName ? `, ${firstName}` : ''}`}</CardTitle>
            <Badge variant="secondary">{personaLabel}</Badge>
            {navigation?.role && <Badge variant="outline">{navigation.role}</Badge>}
          </div>
          <CardDescription>Tu trabajo primero. Después, sólo las excepciones del campo que requieren atención.</CardDescription>
        </CardHeader>
      </Card>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Mi trabajo</h2>
          <p className="text-sm text-muted-foreground">Asignaciones reales vinculadas a tu registro de empleado.</p>
        </div>
        {loading ? (
          <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Actualizando tu operación…</div>
        ) : !employeeId ? (
          <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Tu usuario todavía no tiene una identidad de empleado vinculada.</div>
        ) : work.length === 0 ? (
          <div className="flex items-center gap-3 rounded border border-dashed p-5 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5" /><span>No tienes tareas, mantenimiento ni housekeeping asignados directamente.</span></div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {work.map((item) => <WorkCard key={`${item.kind}-${item.id}`} item={item} />)}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Campo requiere atención</h2>
          <p className="text-sm text-muted-foreground">Excepciones generales visibles dentro de tu acceso operativo.</p>
        </div>
        {!loading && attention.length === 0 ? (
          <div className="flex items-center gap-3 rounded border border-dashed p-5 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5" /><span>Sin excepciones operativas críticas visibles.</span></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {attention.map((signal) => (
              <Link key={signal.key} href={signal.href} className="group rounded-lg border p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{signal.label}</p><p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p></div><span className="text-2xl font-semibold tabular-nums">{signal.value}</span></div>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">Abrir <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {quickWorkspaces.length > 0 && (
        <section className="space-y-3 border-t pt-5">
          <div><h2 className="text-base font-semibold">Workspaces</h2><p className="text-sm text-muted-foreground">Profundidad del OS cuando la necesitas.</p></div>
          <div className="flex flex-wrap gap-2">
            {quickWorkspaces.map((item) => <Link key={item.key} href={item.href} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">{item.label}</Link>)}
          </div>
        </section>
      )}
    </div>
  )
}

function WorkCard({ item }: { item: WorkItem }) {
  const icon: ReactNode = item.kind === 'maintenance' ? <Wrench className="h-4 w-4" /> : item.kind === 'housekeeping' ? <Sparkles className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />
  return (
    <Link href={item.href} className="rounded-lg border p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-primary">{icon}</div>
        <div className="min-w-0 flex-1"><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail || 'Sin detalle adicional'}</p><Badge variant="outline" className="mt-2">{item.status}</Badge></div>
      </div>
    </Link>
  )
}
