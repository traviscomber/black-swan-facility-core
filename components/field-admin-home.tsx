'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, FileCheck2, Sparkles, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useOsPersona } from '@/lib/hooks/use-os-persona'
import { loadAuthorizedNavigation, type AuthorizedNavigation as Navigation, type AuthorizedNavItem as NavItem } from '@/lib/os/authorized-navigation-client'

type WorkKind = 'task' | 'maintenance' | 'issue' | 'housekeeping'
type WorkFilter = 'all' | WorkKind
type WorkItem = {
  id: string
  kind: WorkKind
  title: string
  status: string
  detail: string | null
  href: string
  priority: string | null
  dueDate: string | null
  blocked?: boolean
  scope: 'mine' | 'triage'
}
type IssueRow = {
  id: string
  title: string | null
  status: string | null
  priority: string | null
  severity: string | null
  category: string | null
  issue_task_assignments: Array<{ task_id: string }> | null
}
type AttentionSignal = { key: string; label: string; value: number; detail: string; href: string }
type FinanceApprovalRow = {
  id: string
  operational_label: string | null
  cost_center_name: string | null
  cost_center_code: string | null
  total_amount: number | string
  currency: string
}
type CostCenterApprovalGroup = {
  key: string
  label: string
  count: number
  totals: Record<string, number>
}

function hasNavKey(navigation: Navigation, key: string) {
  return Boolean(navigation.items?.some((item) => item.key === key))
}

function chileDateKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function normalizedPriority(value: string | null) {
  return value?.trim().toLowerCase() || ''
}

function priorityRank(value: string | null) {
  const priority = normalizedPriority(value)
  if (priority === 'critical' || priority === 'urgente') return 0
  if (priority === 'high' || priority === 'alta') return 1
  if (priority === 'medium' || priority === 'media') return 2
  if (priority === 'low' || priority === 'baja') return 3
  return 4
}

function sortWorkItems(items: WorkItem[], today: string) {
  return [...items].sort((a, b) => {
    if (Boolean(a.blocked) !== Boolean(b.blocked)) return a.blocked ? -1 : 1
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority)
    if (priorityDelta !== 0) return priorityDelta
    const aOverdue = Boolean(a.dueDate && a.dueDate <= today)
    const bOverdue = Boolean(b.dueDate && b.dueDate <= today)
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate !== b.dueDate) return a.dueDate ? -1 : 1
    return a.title.localeCompare(b.title, 'es')
  })
}

function groupFinanceApprovals(rows: FinanceApprovalRow[]): CostCenterApprovalGroup[] {
  const groups = new Map<string, CostCenterApprovalGroup>()
  for (const row of rows) {
    const label = row.operational_label || row.cost_center_name || 'Sin centro de costo'
    const key = row.cost_center_code || label
    const current = groups.get(key) ?? { key, label, count: 0, totals: {} }
    const currency = row.currency || 'CLP'
    const amount = Number(row.total_amount ?? 0)
    current.count += 1
    current.totals[currency] = (current.totals[currency] ?? 0) + (Number.isFinite(amount) ? amount : 0)
    groups.set(key, current)
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
}

function formatApprovalTotals(totals: Record<string, number>) {
  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => {
      try {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: currency === 'CLP' ? 0 : 2 }).format(amount)
      } catch {
        return `${amount.toLocaleString('es-CL')} ${currency}`
      }
    })
    .join(' · ')
}

export function FieldAdminHome() {
  const supabase = useMemo(() => createClient(), [])
  const { employeeId, firstName, personaLabel } = useOsPersona()
  const [navigation, setNavigation] = useState<Navigation | null>(null)
  const [work, setWork] = useState<WorkItem[]>([])
  const [workFilter, setWorkFilter] = useState<WorkFilter>('all')
  const [attention, setAttention] = useState<AttentionSignal[]>([])
  const [financeApprovals, setFinanceApprovals] = useState<CostCenterApprovalGroup[]>([])
  const [canApproveFinance, setCanApproveFinance] = useState(false)
  const [financeLoadError, setFinanceLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setFinanceLoadError(null)
    try {
      const nav = await loadAuthorizedNavigation()
      setNavigation(nav)
      const today = chileDateKey()
      const personal: WorkItem[] = []

      const financePermissionResult = await supabase.rpc('can_finance_approve')
      const financeAllowed = !financePermissionResult.error && Boolean(financePermissionResult.data)
      setCanApproveFinance(financeAllowed)

      if (financeAllowed) {
        const financeResult = await supabase
          .from('finance_approval_queue')
          .select('id,operational_label,cost_center_name,cost_center_code,total_amount,currency')
          .eq('approval_status', 'ready')
        if (financeResult.error) {
          setFinanceApprovals([])
          setFinanceLoadError(financeResult.error.message)
        } else {
          setFinanceApprovals(groupFinanceApprovals((financeResult.data ?? []) as FinanceApprovalRow[]))
        }
      } else {
        setFinanceApprovals([])
      }

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
            priority: item.priority,
            dueDate: item.due_date,
            scope: 'mine' as const,
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
          priority: item.prioridad,
          dueDate: item.fecha_objetivo,
          blocked: Boolean(item.bloqueado),
          scope: 'mine' as const,
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
          priority: item.priority,
          dueDate: item.service_date,
          scope: 'mine' as const,
        })))
      }

      if (employeeId && hasNavKey(nav, 'issues')) {
        const issues = await supabase
          .from('issues')
          .select('id,title,status,priority,severity,category,issue_task_assignments(task_id)')
          .not('status', 'in', '(resolved,closed)')
          .order('created_at', { ascending: false })
          .limit(12)
        if (issues.error) throw issues.error
        const issueRows = (issues.data ?? []) as unknown as IssueRow[]
        personal.push(...issueRows
          .filter((item) => (item.issue_task_assignments ?? []).length === 0)
          .map((item) => {
            const priority = item.severity || item.priority
            return {
              id: item.id,
              kind: 'issue' as const,
              title: item.title || 'Incidencia sin título',
              status: item.status || 'open',
              detail: `Sin tarea vinculada · ${item.category || 'Incidencia'}${priority ? ` · ${priority}` : ''}`,
              href: '/issues',
              priority,
              dueDate: null,
              scope: 'triage' as const,
            }
          }))
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

      setWork(sortWorkItems(personal, today))
      setAttention(nextAttention)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar la operación del campo')
      setWork([])
      setAttention([])
      setFinanceApprovals([])
      setCanApproveFinance(false)
      setFinanceLoadError(null)
    } finally {
      setLoading(false)
    }
  }, [employeeId, supabase])

  useEffect(() => { void load() }, [load])

  const financeApprovalCount = useMemo(() => financeApprovals.reduce((sum, group) => sum + group.count, 0), [financeApprovals])
  const workCounts = useMemo(() => work.reduce<Record<WorkKind, number>>((counts, item) => {
    counts[item.kind] += 1
    return counts
  }, { task: 0, maintenance: 0, issue: 0, housekeeping: 0 }), [work])
  const visibleWork = useMemo(() => workFilter === 'all' ? work : work.filter((item) => item.kind === workFilter), [work, workFilter])
  const workFilters: Array<{ key: WorkFilter; label: string; count: number }> = [
    { key: 'all', label: 'Todo', count: work.length },
    { key: 'task', label: 'Tareas', count: workCounts.task },
    { key: 'maintenance', label: 'Mantenimiento', count: workCounts.maintenance },
    { key: 'issue', label: 'Incidencias', count: workCounts.issue },
    { key: 'housekeeping', label: 'Housekeeping', count: workCounts.housekeeping },
  ]

  const quickWorkspaces = useMemo(() => {
    const items = navigation?.items ?? []
    return ['tasks', 'maintenance', 'issues', 'inventory', 'bookings', 'procurement']
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
          <CardDescription>Aprobaciones y trabajo operativo primero. Después, sólo las excepciones que requieren atención.</CardDescription>
        </CardHeader>
      </Card>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {canApproveFinance && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Facturas por aprobar</h2>
              <p className="text-sm text-muted-foreground">Documentos listos para decisión, agrupados por centro de costo.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {financeApprovalCount > 0 && <Badge variant="secondary">{financeApprovalCount} pendiente{financeApprovalCount === 1 ? '' : 's'} · {financeApprovals.length} centro{financeApprovals.length === 1 ? '' : 's'}</Badge>}
              <Link href="/budgets/approvals" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                <FileCheck2 className="h-4 w-4" />
                Revisar aprobaciones
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          {loading ? (
            <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Actualizando aprobaciones…</div>
          ) : financeLoadError ? (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-muted-foreground">No pudimos actualizar el contador de facturas. La cola canónica de aprobaciones sigue disponible desde “Revisar aprobaciones”.</div>
          ) : financeApprovals.length === 0 ? (
            <div className="flex items-center gap-3 rounded border border-dashed p-5 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5" /><span>No hay facturas listas para tu aprobación.</span></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {financeApprovals.slice(0, 8).map((group) => (
                <Link key={group.key} href="/budgets/approvals" className="group rounded-lg border p-4 transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 shrink-0 text-primary" /><p className="truncate font-medium">{group.label}</p></div>
                      <p className="mt-2 text-xs text-muted-foreground">{formatApprovalTotals(group.totals)}</p>
                    </div>
                    <span className="text-2xl font-semibold tabular-nums">{group.count}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">Revisar facturas <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Mi trabajo</h2>
            <p className="text-sm text-muted-foreground">Una sola cola para tareas, mantenimiento, housekeeping e incidencias que todavía necesitan convertirse en trabajo ejecutable.</p>
          </div>
          {!loading && work.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Filtrar trabajo por tipo">
              {workFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setWorkFilter(filter.key)}
                  aria-pressed={workFilter === filter.key}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${workFilter === filter.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  {filter.label} · {filter.count}
                </button>
              ))}
            </div>
          )}
        </div>
        {loading ? (
          <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Actualizando tu operación…</div>
        ) : !employeeId ? (
          <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Tu usuario todavía no tiene una identidad de empleado vinculada.</div>
        ) : work.length === 0 ? (
          <div className="flex items-center gap-3 rounded border border-dashed p-5 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5" /><span>No tienes trabajo asignado ni incidencias pendientes de triaje.</span></div>
        ) : visibleWork.length === 0 ? (
          <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">No hay trabajo de este tipo en tu cola actual.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleWork.map((item) => <WorkCard key={`${item.kind}-${item.id}`} item={item} />)}
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
  const icon: ReactNode = item.kind === 'maintenance'
    ? <Wrench className="h-4 w-4" />
    : item.kind === 'housekeeping'
      ? <Sparkles className="h-4 w-4" />
      : item.kind === 'issue'
        ? <AlertTriangle className="h-4 w-4" />
        : <ClipboardList className="h-4 w-4" />
  const kindLabel = item.kind === 'maintenance' ? 'Mantenimiento' : item.kind === 'housekeeping' ? 'Housekeeping' : item.kind === 'issue' ? 'Incidencia' : 'Tarea'

  return (
    <Link href={item.href} className="rounded-lg border p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-primary">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.title}</p><Badge variant="secondary">{kindLabel}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">{item.detail || 'Sin detalle adicional'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{item.status}</Badge>
            {item.priority && <Badge variant={priorityRank(item.priority) <= 1 ? 'destructive' : 'outline'}>{item.priority}</Badge>}
            {item.scope === 'triage' && <Badge variant="outline">Requiere triaje</Badge>}
          </div>
        </div>
      </div>
    </Link>
  )
}
