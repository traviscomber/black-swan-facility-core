'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, ExternalLink, FileCheck2, RefreshCw, Sparkles, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useOsPersona } from '@/lib/hooks/use-os-persona'
import { loadAuthorizedNavigation, type AuthorizedNavigation as Navigation, type AuthorizedNavItem as NavItem } from '@/lib/os/authorized-navigation-client'

type WorkKind = 'maintenance' | 'issue' | 'housekeeping'
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
type DashboardTask = {
  id: string
  title: string
  status: string
  detail: string | null
  dueDate: string | null
  priority: string | null
  source: 'asana' | 'system'
  sourceUrl: string | null
  systemTaskId: string | null
  syncRequired: boolean
  matchBasis: 'external_ref' | 'exact_title' | null
}
type TaskDateBucket = 'today' | 'overdue' | 'upcoming' | 'later' | 'unscheduled'
type TaskDateFilter = 'all' | TaskDateBucket
type SystemTaskRow = {
  id: string
  title: string | null
  status: string | null
  priority: string | null
  due_date: string | null
  task_category: string | null
  source_label: string | null
}
type CurrentAsanaTaskRow = {
  external_task_id: string
  task_title: string
  task_status: string
  project_name: string | null
  assignee_label: string | null
  assignee_email: string | null
  assignee_external_id: string | null
  due_on: string | null
  source_url: string | null
  last_seen_at: string
}
type TaskExternalRefRow = {
  task_id: string
  external_task_id: string | null
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

const DEFAULT_WORKSPACE_GID = '1205953160575908'
const ASANA_MY_TASKS_URL = 'https://app.asana.com/0/my-tasks'
const TASK_DATE_BUCKET_ORDER: TaskDateBucket[] = ['today', 'overdue', 'upcoming', 'later', 'unscheduled']
const TASK_DATE_LABELS: Record<TaskDateFilter, string> = {
  all: 'Todas',
  today: 'Hoy',
  overdue: 'Vencidas',
  upcoming: 'Próximas',
  later: 'Más tarde',
  unscheduled: 'Sin fecha',
}
const TASK_DATE_DESCRIPTIONS: Record<TaskDateBucket, string> = {
  today: 'Vencen hoy',
  overdue: 'Fecha vencida',
  upcoming: 'Próximos 7 días',
  later: 'Después de los próximos 7 días',
  unscheduled: 'Todavía sin fecha de entrega',
}

function hasNavKey(navigation: Navigation, key: string) {
  return Boolean(navigation.items?.some((item) => item.key === key))
}

function chileDateKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function addDaysDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function taskDateBucket(dueDate: string | null, today: string): TaskDateBucket {
  if (!dueDate) return 'unscheduled'
  if (dueDate === today) return 'today'
  if (dueDate < today) return 'overdue'
  if (dueDate <= addDaysDateKey(today, 7)) return 'upcoming'
  return 'later'
}

function normalizeTitle(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function isHistoricalAsanaTask(task: SystemTaskRow) {
  return task.task_category?.startsWith('asana_import') === true || task.source_label?.startsWith('Asana ·') === true
}

function isDemoTask(task: SystemTaskRow) {
  return task.title?.trim().startsWith('[DEMO]') === true || task.source_label?.startsWith('DEMO') === true
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

function sortDashboardTasks(items: DashboardTask[], today: string) {
  return [...items].sort((a, b) => {
    const bucketDelta = TASK_DATE_BUCKET_ORDER.indexOf(taskDateBucket(a.dueDate, today)) - TASK_DATE_BUCKET_ORDER.indexOf(taskDateBucket(b.dueDate, today))
    if (bucketDelta !== 0) return bucketDelta
    if (a.source !== b.source) return a.source === 'asana' ? -1 : 1
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate !== b.dueDate) return a.dueDate ? -1 : 1
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority)
    if (priorityDelta !== 0) return priorityDelta
    return a.title.localeCompare(b.title, 'es')
  })
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
  const [tasks, setTasks] = useState<DashboardTask[]>([])
  const [taskDateFilter, setTaskDateFilter] = useState<TaskDateFilter>('all')
  const [todayKey, setTodayKey] = useState(chileDateKey)
  const [operations, setOperations] = useState<WorkItem[]>([])
  const [attention, setAttention] = useState<AttentionSignal[]>([])
  const [financeApprovals, setFinanceApprovals] = useState<CostCenterApprovalGroup[]>([])
  const [canApproveFinance, setCanApproveFinance] = useState(false)
  const [canSyncAsana, setCanSyncAsana] = useState(false)
  const [hasAsanaIdentity, setHasAsanaIdentity] = useState(false)
  const [financeLoadError, setFinanceLoadError] = useState<string | null>(null)
  const [asanaLoadError, setAsanaLoadError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const interval = window.setInterval(() => setTodayKey(chileDateKey()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setFinanceLoadError(null)
    setAsanaLoadError(null)
    try {
      const nav = await loadAuthorizedNavigation()
      setNavigation(nav)
      setCanSyncAsana(hasNavKey(nav, 'asana-live'))
      const today = chileDateKey()
      setTodayKey(today)
      const nextOperations: WorkItem[] = []
      const nextTasks: DashboardTask[] = []

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
        const [assignmentsResult, identityResult, baselineResult] = await Promise.all([
          supabase.from('task_assignments').select('task_id').eq('employee_id', employeeId),
          supabase.from('asana_identity_links').select('asana_email,asana_user_gid').eq('employee_id', employeeId).eq('is_active', true).maybeSingle(),
          supabase.from('asana_sync_baselines').select('cutover_at,last_synced_at').eq('workspace_gid', DEFAULT_WORKSPACE_GID).maybeSingle(),
        ])

        if (assignmentsResult.error) throw assignmentsResult.error
        const identity = identityResult.error ? null : identityResult.data
        setHasAsanaIdentity(Boolean(identity?.asana_email || identity?.asana_user_gid))
        if (identityResult.error) setAsanaLoadError('No fue posible resolver tu identidad Asana. Tus asignaciones Black Swan siguen disponibles.')

        const assignedTaskIds = (assignmentsResult.data ?? []).map((row) => row.task_id).filter(Boolean) as string[]
        let systemRows: SystemTaskRow[] = []
        if (assignedTaskIds.length > 0) {
          const systemResult = await supabase
            .from('tasks')
            .select('id,title,status,priority,due_date,task_category,source_label')
            .in('id', assignedTaskIds)
            .not('status', 'in', '(completada,completed,cancelled,canceled)')
            .order('due_date', { ascending: true, nullsFirst: false })
          if (systemResult.error) throw systemResult.error
          systemRows = ((systemResult.data ?? []) as SystemTaskRow[]).filter((task) => !isHistoricalAsanaTask(task) && !isDemoTask(task))
        }

        const systemById = new Map(systemRows.map((task) => [task.id, task]))
        const systemByTitle = new Map<string, SystemTaskRow[]>()
        for (const task of systemRows) {
          const key = normalizeTitle(task.title)
          if (!key) continue
          const bucket = systemByTitle.get(key) ?? []
          bucket.push(task)
          systemByTitle.set(key, bucket)
        }

        const externalRefByAsanaId = new Map<string, SystemTaskRow>()
        if (systemRows.length > 0) {
          const refsResult = await supabase
            .from('task_external_refs')
            .select('task_id,external_task_id')
            .eq('provider', 'asana')
            .in('task_id', systemRows.map((task) => task.id))
          if (!refsResult.error) {
            for (const ref of (refsResult.data ?? []) as TaskExternalRefRow[]) {
              const systemTask = systemById.get(ref.task_id)
              if (systemTask && ref.external_task_id) externalRefByAsanaId.set(ref.external_task_id, systemTask)
            }
          }
        }

        const asanaRows: CurrentAsanaTaskRow[] = []
        const cutoverAt = baselineResult.error ? null : baselineResult.data?.cutover_at ?? null
        const latestSeenAt = baselineResult.error ? null : baselineResult.data?.last_synced_at ?? null
        if (baselineResult.error && identity) setAsanaLoadError('No fue posible leer la última sincronización de Asana. Mostramos tus asignaciones Black Swan como respaldo.')

        if (identity && cutoverAt && latestSeenAt) {
          let currentQuery = supabase
            .from('asana_current_tasks')
            .select('external_task_id,task_title,task_status,project_name,assignee_label,assignee_email,assignee_external_id,due_on,source_url,last_seen_at')
            .eq('task_status', 'open')
            .eq('last_seen_at', latestSeenAt)
            .gte('created_at_source', cutoverAt)
            .order('due_on', { ascending: true, nullsFirst: false })

          if (identity.asana_user_gid) currentQuery = currentQuery.eq('assignee_external_id', identity.asana_user_gid)
          else if (identity.asana_email) currentQuery = currentQuery.eq('assignee_email', identity.asana_email)

          const currentResult = await currentQuery
          if (currentResult.error) {
            setAsanaLoadError('No fue posible cargar Asana. Mostramos tus asignaciones Black Swan como respaldo.')
          } else {
            asanaRows.push(...((currentResult.data ?? []) as CurrentAsanaTaskRow[]))
          }
        }

        const matchedSystemIds = new Set<string>()
        for (const asanaTask of asanaRows) {
          let matchedSystem = externalRefByAsanaId.get(asanaTask.external_task_id) ?? null
          let matchBasis: DashboardTask['matchBasis'] = matchedSystem ? 'external_ref' : null
          if (!matchedSystem) {
            const titleMatches = systemByTitle.get(normalizeTitle(asanaTask.task_title)) ?? []
            matchedSystem = titleMatches.find((candidate) => !matchedSystemIds.has(candidate.id)) ?? null
            if (matchedSystem) matchBasis = 'exact_title'
          }
          if (matchedSystem) matchedSystemIds.add(matchedSystem.id)

          nextTasks.push({
            id: `asana:${asanaTask.external_task_id}`,
            title: asanaTask.task_title,
            status: asanaTask.task_status,
            detail: [asanaTask.project_name, matchedSystem ? 'Consolidada con Black Swan' : null].filter(Boolean).join(' · ') || 'Asana',
            dueDate: asanaTask.due_on,
            priority: matchedSystem?.priority ?? null,
            source: 'asana',
            sourceUrl: asanaTask.source_url,
            systemTaskId: matchedSystem?.id ?? null,
            syncRequired: false,
            matchBasis,
          })
        }

        for (const task of systemRows) {
          if (matchedSystemIds.has(task.id)) continue
          nextTasks.push({
            id: `system:${task.id}`,
            title: task.title || 'Tarea operativa',
            status: task.status || 'open',
            detail: task.due_date ? `Vence ${task.due_date}${task.priority ? ` · ${task.priority}` : ''}` : task.priority,
            dueDate: task.due_date,
            priority: task.priority,
            source: 'system',
            sourceUrl: null,
            systemTaskId: task.id,
            syncRequired: Boolean(identity?.asana_email || identity?.asana_user_gid),
            matchBasis: null,
          })
        }
      } else {
        setHasAsanaIdentity(false)
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
        nextOperations.push(...(maintenance.data ?? []).map((item) => ({
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
        nextOperations.push(...(housekeeping.data ?? []).map((item) => ({
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
        nextOperations.push(...issueRows
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

      setTasks(sortDashboardTasks(nextTasks, today))
      setOperations(sortWorkItems(nextOperations, today))
      setAttention(nextAttention)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar la operación del campo')
      setTasks([])
      setOperations([])
      setAttention([])
      setFinanceApprovals([])
      setCanApproveFinance(false)
      setCanSyncAsana(false)
      setHasAsanaIdentity(false)
      setFinanceLoadError(null)
      setAsanaLoadError(null)
    } finally {
      setLoading(false)
    }
  }, [employeeId, supabase])

  useEffect(() => { void load() }, [load])

  const syncAsana = useCallback(async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const response = await fetch('/api/asana-live/sync', { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSyncMessage('No fue posible actualizar Asana.')
        return
      }
      setSyncMessage(`Asana actualizado · ${payload.synced ?? 0} tareas vigentes`)
      await load()
    } catch {
      setSyncMessage('No fue posible actualizar Asana.')
    } finally {
      setSyncing(false)
    }
  }, [load])

  const financeApprovalCount = useMemo(() => financeApprovals.reduce((sum, group) => sum + group.count, 0), [financeApprovals])
  const taskBucketCounts = useMemo(() => {
    const counts: Record<TaskDateBucket, number> = { today: 0, overdue: 0, upcoming: 0, later: 0, unscheduled: 0 }
    for (const task of tasks) counts[taskDateBucket(task.dueDate, todayKey)] += 1
    return counts
  }, [tasks, todayKey])
  const visibleTaskBuckets = useMemo(() => {
    const allowed = taskDateFilter === 'all' ? TASK_DATE_BUCKET_ORDER : [taskDateFilter]
    return allowed
      .map((bucket) => ({ bucket, tasks: tasks.filter((task) => taskDateBucket(task.dueDate, todayKey) === bucket) }))
      .filter((group) => group.tasks.length > 0)
  }, [taskDateFilter, tasks, todayKey])
  const taskDateFilters: Array<{ key: TaskDateFilter; label: string; count: number }> = [
    { key: 'all', label: TASK_DATE_LABELS.all, count: tasks.length },
    ...TASK_DATE_BUCKET_ORDER.map((key) => ({ key, label: TASK_DATE_LABELS[key], count: taskBucketCounts[key] })),
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
            <h2 className="text-lg font-semibold">Tareas</h2>
            <p className="text-sm text-muted-foreground">Asana es la fuente principal. Hoy aparece primero; después vencidas, próximas, más tarde y tareas sin fecha. Las asignaciones Black Swan sólo aparecen como respaldo cuando no existe una tarea Asana vigente equivalente.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canSyncAsana && hasAsanaIdentity && <Button variant="outline" size="sm" onClick={() => void syncAsana()} disabled={syncing || loading}><RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Actualizando…' : 'Actualizar Asana'}</Button>}
            <Link href="/my-tasks" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted">Abrir Mis tareas <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
        {!loading && tasks.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Filtrar tareas por fecha">
            {taskDateFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setTaskDateFilter(filter.key)}
                aria-pressed={taskDateFilter === filter.key}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${taskDateFilter === filter.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {filter.label} · {filter.count}
              </button>
            ))}
          </div>
        )}
        {syncMessage && <div className="border-l-2 border-primary/60 bg-primary/5 p-3 text-sm">{syncMessage}</div>}
        {asanaLoadError && <div className="border-l-2 border-amber-400/60 bg-amber-500/5 p-3 text-sm text-muted-foreground">{asanaLoadError}</div>}
        {loading ? (
          <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Actualizando tareas…</div>
        ) : !employeeId ? (
          <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Tu usuario todavía no tiene una identidad de empleado vinculada.</div>
        ) : tasks.length === 0 ? (
          <div className="flex items-center gap-3 rounded border border-dashed p-5 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5" /><span>No tienes tareas vigentes en Asana ni asignaciones Black Swan de respaldo.</span></div>
        ) : visibleTaskBuckets.length === 0 ? (
          <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">No hay tareas en este rango de fecha.</div>
        ) : (
          <div className="space-y-5">
            {visibleTaskBuckets.map(({ bucket, tasks: bucketTasks }) => (
              <div key={bucket} className="space-y-2">
                <div className="flex items-end justify-between gap-3 border-b pb-2">
                  <div>
                    <h3 className="text-sm font-semibold">{TASK_DATE_LABELS[bucket]}</h3>
                    <p className="text-xs text-muted-foreground">{TASK_DATE_DESCRIPTIONS[bucket]}</p>
                  </div>
                  <Badge variant={bucket === 'today' ? 'secondary' : 'outline'}>{bucketTasks.length}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {bucketTasks.map((task) => <DashboardTaskCard key={task.id} task={task} today={todayKey} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Operación asignada</h2>
          <p className="text-sm text-muted-foreground">Mantenimiento, housekeeping e incidencias de triaje quedan separados de la cola de tareas.</p>
        </div>
        {loading ? (
          <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Actualizando tu operación…</div>
        ) : !employeeId ? (
          <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Tu usuario todavía no tiene una identidad de empleado vinculada.</div>
        ) : operations.length === 0 ? (
          <div className="flex items-center gap-3 rounded border border-dashed p-5 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5" /><span>No tienes mantenimiento, housekeeping ni incidencias pendientes de triaje.</span></div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {operations.map((item) => <WorkCard key={`${item.kind}-${item.id}`} item={item} />)}
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

function DashboardTaskCard({ task, today }: { task: DashboardTask; today: string }) {
  const detail = task.detail || (task.source === 'asana' ? 'Asana' : 'Asignación Black Swan')
  const bucket = taskDateBucket(task.dueDate, today)
  const dueLabel = bucket === 'today'
    ? 'Hoy'
    : bucket === 'overdue'
      ? `Vencida · ${task.dueDate}`
      : task.dueDate
        ? `Vence ${task.dueDate}`
        : null
  return (
    <div className={`rounded-lg border p-4 ${bucket === 'today' ? 'border-primary/50 bg-primary/5' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-primary"><ClipboardList className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{task.title}</p>
            <Badge variant={task.source === 'asana' ? 'secondary' : 'outline'}>{task.source === 'asana' ? 'Asana' : 'Black Swan'}</Badge>
            {task.matchBasis && <Badge variant="outline">Consolidada</Badge>}
            {task.syncRequired && <Badge variant="outline">Falta en Asana</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{task.status}</Badge>
            {task.priority && <Badge variant={priorityRank(task.priority) <= 1 ? 'destructive' : 'outline'}>{task.priority}</Badge>}
            {dueLabel && <Badge variant={bucket === 'today' ? 'secondary' : bucket === 'overdue' ? 'destructive' : 'outline'}>{dueLabel}</Badge>}
          </div>
          {task.syncRequired && <p className="mt-3 text-xs text-amber-300">Créala en Asana para mantener estado y vencimiento sincronizados. Black Swan no la crea automáticamente.</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
            {task.source === 'asana' && task.sourceUrl && <a href={task.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Abrir en Asana <ExternalLink className="h-3.5 w-3.5" /></a>}
            {task.systemTaskId && <Link href={`/tasks?selected=${task.systemTaskId}`} className="inline-flex items-center gap-1 text-primary hover:underline">Abrir en Black Swan <ArrowRight className="h-3.5 w-3.5" /></Link>}
            {task.syncRequired && <a href={ASANA_MY_TASKS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Crear en Asana <ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkCard({ item }: { item: WorkItem }) {
  const icon: ReactNode = item.kind === 'maintenance'
    ? <Wrench className="h-4 w-4" />
    : item.kind === 'housekeeping'
      ? <Sparkles className="h-4 w-4" />
      : <AlertTriangle className="h-4 w-4" />
  const kindLabel = item.kind === 'maintenance' ? 'Mantenimiento' : item.kind === 'housekeeping' ? 'Housekeeping' : 'Incidencia'

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
