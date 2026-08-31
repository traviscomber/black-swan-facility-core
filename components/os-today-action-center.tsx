'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/hooks/use-language'

type Navigation = { items?: Array<{ key: string }> }
type Item = {
  key: string
  title: string
  why: string
  action: string
  href: string
  priority: number
}

type Change = { key: string; label: string; value: number; href: string }

const copy = {
  en: {
    title: 'What needs your attention',
    description: 'Only items that need a decision, follow-up, or action now.',
    clear: 'Nothing urgent right now.',
    clearDetail: 'There are no visible blockers, overdue tasks, or approvals waiting for you.',
    loading: 'Checking what needs attention…',
    partial: 'Some information could not be refreshed. What is available is shown below.',
    why: 'Why it matters',
    recent: 'What changed today',
    recentDescription: 'Recent activity you may want to review.',
    review: 'Review',
    approve: 'Review approval',
    reservation: 'Review reservation',
    maintenance: 'Review maintenance',
    purchase: 'Review purchase',
    task: 'Review task',
    issue: 'Review issue',
    reservationWhy: 'This may affect check-in or check-out.',
    financeWhy: 'This payment or document is waiting for a decision.',
    maintenanceWhy: 'This work is blocked and cannot move forward.',
    purchaseWhy: 'This request is waiting for approval or follow-up.',
    taskWhy: 'This task is due or overdue.',
    issueWhy: 'This issue is still open and may need follow-up.',
    tasksChanged: 'Tasks updated',
    issuesCreated: 'New issues',
    maintenanceCreated: 'New maintenance',
    purchasesChanged: 'Purchases updated',
  },
  es: {
    title: 'Qué necesita tu atención',
    description: 'Solo mostramos lo que necesita una decisión, seguimiento o acción ahora.',
    clear: 'Nada urgente por ahora.',
    clearDetail: 'No hay bloqueos, tareas vencidas ni aprobaciones pendientes visibles para ti.',
    loading: 'Revisando qué necesita atención…',
    partial: 'Parte de la información no pudo actualizarse. Mostramos lo que sí está disponible.',
    why: 'Por qué importa',
    recent: 'Qué cambió hoy',
    recentDescription: 'Actividad reciente que puede ser útil revisar.',
    review: 'Revisar',
    approve: 'Revisar aprobación',
    reservation: 'Revisar reserva',
    maintenance: 'Revisar mantenimiento',
    purchase: 'Revisar compra',
    task: 'Revisar tarea',
    issue: 'Revisar incidencia',
    reservationWhy: 'Puede afectar un check-in o check-out.',
    financeWhy: 'Este pago o documento está esperando una decisión.',
    maintenanceWhy: 'Este trabajo está bloqueado y no puede avanzar.',
    purchaseWhy: 'Esta solicitud está esperando aprobación o seguimiento.',
    taskWhy: 'Esta tarea vence hoy o ya está vencida.',
    issueWhy: 'Esta incidencia sigue abierta y puede requerir seguimiento.',
    tasksChanged: 'Tareas actualizadas',
    issuesCreated: 'Nuevas incidencias',
    maintenanceCreated: 'Nuevos mantenimientos',
    purchasesChanged: 'Compras actualizadas',
  },
  de: {
    title: 'Was jetzt deine Aufmerksamkeit braucht',
    description: 'Nur Punkte, die jetzt eine Entscheidung, Nachverfolgung oder Aktion brauchen.',
    clear: 'Aktuell nichts Dringendes.',
    clearDetail: 'Keine sichtbaren Blocker, überfälligen Aufgaben oder offenen Freigaben.',
    loading: 'Aktuelle Aufgaben werden geprüft…',
    partial: 'Ein Teil der Informationen konnte nicht aktualisiert werden. Verfügbare Daten werden angezeigt.',
    why: 'Warum das wichtig ist',
    recent: 'Was sich heute geändert hat',
    recentDescription: 'Aktuelle Änderungen, die du prüfen kannst.',
    review: 'Prüfen',
    approve: 'Freigabe prüfen',
    reservation: 'Reservierung prüfen',
    maintenance: 'Instandhaltung prüfen',
    purchase: 'Einkauf prüfen',
    task: 'Aufgabe prüfen',
    issue: 'Vorfall prüfen',
    reservationWhy: 'Dies kann Check-in oder Check-out beeinflussen.',
    financeWhy: 'Diese Zahlung oder dieses Dokument wartet auf eine Entscheidung.',
    maintenanceWhy: 'Diese Arbeit ist blockiert und kann nicht fortgesetzt werden.',
    purchaseWhy: 'Diese Anfrage wartet auf Freigabe oder Nachverfolgung.',
    taskWhy: 'Diese Aufgabe ist heute fällig oder bereits überfällig.',
    issueWhy: 'Dieser Vorfall ist noch offen und braucht möglicherweise Nachverfolgung.',
    tasksChanged: 'Aufgaben aktualisiert',
    issuesCreated: 'Neue Vorfälle',
    maintenanceCreated: 'Neue Instandhaltung',
    purchasesChanged: 'Einkäufe aktualisiert',
  },
} as const

function hasNavKey(navigation: Navigation, key: string) {
  return Boolean(navigation.items?.some((item) => item.key === key))
}

function last24HoursIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export function OsTodayActionCenter() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const text = copy[language]
  const [items, setItems] = useState<Item[]>([])
  const [changes, setChanges] = useState<Change[]>([])
  const [loading, setLoading] = useState(true)
  const [partial, setPartial] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setPartial(false)

    const { data: navData, error: navError } = await supabase.rpc('get_black_swan_os_navigation')
    if (navError || !navData || typeof navData !== 'object') {
      setItems([])
      setChanges([])
      setPartial(true)
      setLoading(false)
      return
    }

    const navigation = navData as Navigation
    const canApproveResult = await supabase.rpc('can_finance_approve')
    const canApproveFinance = !canApproveResult.error && Boolean(canApproveResult.data) && hasNavKey(navigation, 'approvals')
    const emptyRows = Promise.resolve({ data: [], error: null })
    const zero = Promise.resolve({ count: 0, error: null })
    const since = last24HoursIso()
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

    const [reservations, finance, maintenance, procurement, tasks, issues, changedTasks, changedIssues, changedMaintenance, changedProcurement] = await Promise.all([
      hasNavKey(navigation, 'bookings')
        ? supabase.from('reservation_operational_exceptions').select('reservation_id,title,priority,blocks_check_in,blocks_check_out').in('exception_state', ['open', 'overdue']).or('blocks_check_in.eq.true,blocks_check_out.eq.true').limit(4)
        : emptyRows,
      canApproveFinance
        ? supabase.from('finance_approval_queue').select('id,operational_label,due_date').eq('approval_status', 'ready').limit(4)
        : emptyRows,
      hasNavKey(navigation, 'maintenance')
        ? supabase.from('maintenance_tasks').select('id,title,prioridad,fecha_objetivo,status').eq('bloqueado', true).not('status', 'in', '(completada,completed,cancelada,cancelled,canceled)').limit(4)
        : emptyRows,
      hasNavKey(navigation, 'procurement')
        ? supabase.from('procurement_requests').select('id,request_number,title,priority,required_date').in('status', ['submitted', 'pending_approval']).limit(4)
        : emptyRows,
      hasNavKey(navigation, 'tasks')
        ? supabase.from('tasks').select('id,title,priority,due_date').lte('due_date', today).not('status', 'in', '(completada,completed,cancelled,canceled)').limit(4)
        : emptyRows,
      hasNavKey(navigation, 'issues')
        ? supabase.from('issues').select('id,title,priority,severity,created_at').not('status', 'in', '(resolved,closed,cancelled,canceled)').order('created_at', { ascending: false }).limit(4)
        : emptyRows,
      hasNavKey(navigation, 'tasks') ? supabase.from('tasks').select('id', { count: 'exact', head: true }).gte('updated_at', since) : zero,
      hasNavKey(navigation, 'issues') ? supabase.from('issues').select('id', { count: 'exact', head: true }).gte('created_at', since) : zero,
      hasNavKey(navigation, 'maintenance') ? supabase.from('maintenance_tasks').select('id', { count: 'exact', head: true }).gte('created_at', since) : zero,
      hasNavKey(navigation, 'procurement') ? supabase.from('procurement_requests').select('id', { count: 'exact', head: true }).gte('updated_at', since) : zero,
    ])

    const results = [reservations, finance, maintenance, procurement, tasks, issues, changedTasks, changedIssues, changedMaintenance, changedProcurement]
    setPartial(results.some((result) => Boolean(result.error)))

    const next: Item[] = []
    if (!reservations.error) for (const row of reservations.data ?? []) next.push({
      key: `reservation-${row.reservation_id}`,
      title: row.title || text.reservation,
      why: text.reservationWhy,
      action: text.reservation,
      href: `/bookings/reservations/${row.reservation_id}`,
      priority: 0,
    })
    if (!finance.error) for (const row of finance.data ?? []) next.push({
      key: `finance-${row.id}`,
      title: row.operational_label || text.approve,
      why: text.financeWhy,
      action: text.approve,
      href: `/budgets/approvals/${row.id}`,
      priority: 0,
    })
    if (!maintenance.error) for (const row of maintenance.data ?? []) next.push({
      key: `maintenance-${row.id}`,
      title: row.title || text.maintenance,
      why: text.maintenanceWhy,
      action: text.maintenance,
      href: `/maintenance/${row.id}`,
      priority: 1,
    })
    if (!procurement.error) for (const row of procurement.data ?? []) next.push({
      key: `purchase-${row.id}`,
      title: row.title || row.request_number || text.purchase,
      why: text.purchaseWhy,
      action: text.purchase,
      href: `/procurement/requests/${row.id}`,
      priority: 1,
    })
    if (!tasks.error) for (const row of tasks.data ?? []) next.push({
      key: `task-${row.id}`,
      title: row.title || text.task,
      why: text.taskWhy,
      action: text.task,
      href: `/tasks?selected=${row.id}`,
      priority: 2,
    })
    if (!issues.error) for (const row of issues.data ?? []) next.push({
      key: `issue-${row.id}`,
      title: row.title || text.issue,
      why: text.issueWhy,
      action: text.issue,
      href: `/issues/${row.id}`,
      priority: 2,
    })

    setItems(next.sort((a, b) => a.priority - b.priority).slice(0, 8))

    const nextChanges: Change[] = []
    if (!changedTasks.error && (changedTasks.count ?? 0) > 0) nextChanges.push({ key: 'tasks', label: text.tasksChanged, value: changedTasks.count ?? 0, href: '/tasks' })
    if (!changedIssues.error && (changedIssues.count ?? 0) > 0) nextChanges.push({ key: 'issues', label: text.issuesCreated, value: changedIssues.count ?? 0, href: '/issues' })
    if (!changedMaintenance.error && (changedMaintenance.count ?? 0) > 0) nextChanges.push({ key: 'maintenance', label: text.maintenanceCreated, value: changedMaintenance.count ?? 0, href: '/maintenance' })
    if (!changedProcurement.error && (changedProcurement.count ?? 0) > 0) nextChanges.push({ key: 'procurement', label: text.purchasesChanged, value: changedProcurement.count ?? 0, href: '/procurement' })
    setChanges(nextChanges)
    setLoading(false)
  }, [supabase, text])

  useEffect(() => { void load() }, [load])

  return (
    <section className="px-4 pt-5 md:px-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{text.description}</p>
      </div>

      {partial && (
        <div className="mt-4 flex items-start gap-2 border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>{text.partial}</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          {text.loading}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 border-b border-border py-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium">{text.clear}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text.clearDetail}</p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.key} className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-medium leading-6">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground/80">{text.why}:</span> {item.why}</p>
              </div>
              <Link href={item.href} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline">
                {item.action}<ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {!loading && changes.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">{text.recent}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{text.recentDescription}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {changes.map((change) => (
              <Link key={change.key} href={change.href} className="text-sm text-muted-foreground hover:text-foreground">
                <span className="font-semibold text-foreground">{change.value}</span> {change.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
