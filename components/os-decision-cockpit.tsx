'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/hooks/use-language'
import { hasCapability, normalizeCapabilitySnapshot } from '@/lib/access/capabilities'

type DecisionItem = {
  key: string
  domain: 'hospitality' | 'finance' | 'maintenance' | 'procurement' | 'tasks' | 'issues'
  title: string
  detail: string
  why: string
  action: string
  href: string
  priority: string | null
  rank: number
}
type ChangeSignal = { key: string; label: string; value: number; href: string }

const copy = {
  en: {
    title: 'What needs your attention', description: 'Only items that need a decision, follow-up, or action now.',
    empty: 'Nothing urgent right now.', emptyDetail: 'There are no visible blockers, overdue tasks, or approvals waiting for you.', recent: 'What changed today', recentDescription: 'Recent activity you may want to review.',
    loading: 'Checking what needs attention…', partial: 'Some information could not be refreshed. What is available is shown below.', why: 'Why it matters',
    hospitality: 'Hospitality', finance: 'Finance', maintenance: 'Maintenance', procurement: 'Procurement', tasks: 'Tasks', issues: 'Issues',
    financeFallback: 'Document ready for approval', maintenanceFallback: 'Blocked maintenance', procurementFallback: 'Purchase request', taskFallback: 'Operational task', issueFallback: 'Open issue',
    blocks: 'Blocks', overdue: 'Overdue', due: 'Due', amount: 'Amount', status: 'Status', created: 'Created',
    reservationWhy: 'This may affect check-in or check-out.', financeWhy: 'This payment or document is waiting for a decision.', maintenanceWhy: 'This work is blocked and cannot move forward.', procurementWhy: 'This request is waiting for approval or follow-up.', taskWhy: 'This task is due or overdue.', issueWhy: 'This issue is still open and may need follow-up.',
    reservationAction: 'Review reservation', financeAction: 'Review approval', maintenanceAction: 'Review maintenance', procurementAction: 'Review purchase', taskAction: 'Review task', issueAction: 'Review issue',
    changesTasks: 'Tasks changed', changesIssues: 'Issues created', changesMaintenance: 'Maintenance created', changesProcurement: 'Purchases changed',
  },
  es: {
    title: 'Qué necesita tu atención', description: 'Solo mostramos lo que necesita una decisión, seguimiento o acción ahora.',
    empty: 'Nada urgente por ahora.', emptyDetail: 'No hay bloqueos, tareas vencidas ni aprobaciones pendientes visibles para ti.', recent: 'Qué cambió hoy', recentDescription: 'Actividad reciente que puede ser útil revisar.',
    loading: 'Revisando qué necesita atención…', partial: 'Parte de la información no pudo actualizarse. Mostramos lo que sí está disponible.', why: 'Por qué importa',
    hospitality: 'Hospitality', finance: 'Finanzas', maintenance: 'Mantenimiento', procurement: 'Compras', tasks: 'Tareas', issues: 'Incidencias',
    financeFallback: 'Documento listo para aprobación', maintenanceFallback: 'Mantenimiento bloqueado', procurementFallback: 'Solicitud de compra', taskFallback: 'Tarea operativa', issueFallback: 'Incidencia abierta',
    blocks: 'Bloquea', overdue: 'Vencido', due: 'Vence', amount: 'Monto', status: 'Estado', created: 'Creado',
    reservationWhy: 'Puede afectar un check-in o check-out.', financeWhy: 'Este pago o documento está esperando una decisión.', maintenanceWhy: 'Este trabajo está bloqueado y no puede avanzar.', procurementWhy: 'Esta solicitud está esperando aprobación o seguimiento.', taskWhy: 'Esta tarea vence hoy o ya está vencida.', issueWhy: 'Esta incidencia sigue abierta y puede requerir seguimiento.',
    reservationAction: 'Revisar reserva', financeAction: 'Revisar aprobación', maintenanceAction: 'Revisar mantenimiento', procurementAction: 'Revisar compra', taskAction: 'Revisar tarea', issueAction: 'Revisar incidencia',
    changesTasks: 'Tareas modificadas', changesIssues: 'Incidencias creadas', changesMaintenance: 'Mantenimientos creados', changesProcurement: 'Compras modificadas',
  },
  de: {
    title: 'Was jetzt deine Aufmerksamkeit braucht', description: 'Nur Punkte, die jetzt eine Entscheidung, Nachverfolgung oder Aktion brauchen.',
    empty: 'Aktuell nichts Dringendes.', emptyDetail: 'Keine sichtbaren Blocker, überfälligen Aufgaben oder offenen Freigaben.', recent: 'Was sich heute geändert hat', recentDescription: 'Aktuelle Änderungen, die du prüfen kannst.',
    loading: 'Aktuelle Aufgaben werden geprüft…', partial: 'Ein Teil der Informationen konnte nicht aktualisiert werden. Verfügbare Daten werden angezeigt.', why: 'Warum das wichtig ist',
    hospitality: 'Hospitality', finance: 'Finanzen', maintenance: 'Instandhaltung', procurement: 'Beschaffung', tasks: 'Aufgaben', issues: 'Vorfälle',
    financeFallback: 'Dokument zur Freigabe bereit', maintenanceFallback: 'Blockierte Instandhaltung', procurementFallback: 'Beschaffungsanfrage', taskFallback: 'Betriebliche Aufgabe', issueFallback: 'Offener Vorfall',
    blocks: 'Blockiert', overdue: 'Überfällig', due: 'Fällig', amount: 'Betrag', status: 'Status', created: 'Erstellt',
    reservationWhy: 'Dies kann Check-in oder Check-out beeinflussen.', financeWhy: 'Diese Zahlung oder dieses Dokument wartet auf eine Entscheidung.', maintenanceWhy: 'Diese Arbeit ist blockiert und kann nicht fortgesetzt werden.', procurementWhy: 'Diese Anfrage wartet auf Freigabe oder Nachverfolgung.', taskWhy: 'Diese Aufgabe ist heute fällig oder bereits überfällig.', issueWhy: 'Dieser Vorfall ist noch offen und braucht möglicherweise Nachverfolgung.',
    reservationAction: 'Reservierung prüfen', financeAction: 'Freigabe prüfen', maintenanceAction: 'Instandhaltung prüfen', procurementAction: 'Einkauf prüfen', taskAction: 'Aufgabe prüfen', issueAction: 'Vorfall prüfen',
    changesTasks: 'Geänderte Aufgaben', changesIssues: 'Neue Vorfälle', changesMaintenance: 'Neue Instandhaltung', changesProcurement: 'Geänderte Beschaffung',
  },
} as const

const localeMap = { en: 'en-US', es: 'es-CL', de: 'de-DE' } as const

function priorityRank(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? ''
  if (['critical', 'critica', 'crítica', 'urgent', 'urgente'].includes(normalized)) return 0
  if (['high', 'alta'].includes(normalized)) return 1
  if (['medium', 'normal', 'media'].includes(normalized)) return 2
  return 3
}

function formatMoney(value: unknown, currency: unknown, locale: keyof typeof localeMap) {
  const amount = Number(value ?? 0)
  const unit = typeof currency === 'string' && currency ? currency : 'CLP'
  if (!Number.isFinite(amount)) return null
  try {
    return new Intl.NumberFormat(localeMap[locale], { style: 'currency', currency: unit, maximumFractionDigits: unit === 'CLP' ? 0 : 2 }).format(amount)
  } catch {
    return `${amount.toLocaleString(localeMap[locale])} ${unit}`
  }
}

function last24HoursIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export function OsDecisionCockpit() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const text = copy[language]
  const [items, setItems] = useState<DecisionItem[]>([])
  const [changes, setChanges] = useState<ChangeSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [partial, setPartial] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setPartial(false)
    const { data: routeAccessData, error: routeAccessError } = await supabase.rpc('get_current_route_access')
    if (routeAccessError || !routeAccessData || typeof routeAccessData !== 'object') {
      setItems([])
      setChanges([])
      setPartial(true)
      setLoading(false)
      return
    }

    const capabilities = normalizeCapabilitySnapshot(routeAccessData)
    const canViewBookings = hasCapability(capabilities, 'booking', 'view')
    const canViewOperations = hasCapability(capabilities, 'operations', 'view')
    const canViewMaintenance = hasCapability(capabilities, 'maintenance', 'view')
    const canViewProcurement = hasCapability(capabilities, 'procurement', 'view')
    const canViewFinance = hasCapability(capabilities, 'finance', 'view')
    const canApproveResult = await supabase.rpc('can_finance_approve')
    const canApproveFinance = canViewFinance && !canApproveResult.error && Boolean(canApproveResult.data)
    const emptyRows = Promise.resolve({ data: [], error: null })
    const zero = Promise.resolve({ count: 0, error: null })
    const since = last24HoursIso()
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

    const [reservationRows, financeRows, maintenanceRows, procurementRows, taskRows, issueRows, changedTasks, changedIssues, changedMaintenance, changedProcurement] = await Promise.all([
      canViewBookings
        ? supabase.from('reservation_operational_exceptions').select('reservation_id,title,detail,priority,exception_state,blocks_check_in,blocks_check_out').in('exception_state', ['open', 'overdue']).or('blocks_check_in.eq.true,blocks_check_out.eq.true').limit(20)
        : emptyRows,
      canApproveFinance
        ? supabase.from('finance_approval_queue').select('id,supplier_name,document_number,description,cost_center_name,total_amount,currency,due_date,approval_status').eq('approval_status', 'ready').limit(5)
        : emptyRows,
      canViewMaintenance
        ? supabase.from('maintenance_tasks').select('id,title,prioridad,fecha_objetivo,status,bloqueado').eq('bloqueado', true).not('status', 'in', '(completada,completed,cancelada,cancelled,canceled)').limit(5)
        : emptyRows,
      canViewProcurement
        ? supabase.from('procurement_requests').select('id,request_number,title,priority,status,required_date').in('status', ['submitted', 'under_review']).limit(5)
        : emptyRows,
      canViewOperations
        ? supabase.from('tasks').select('id,title,status,priority,due_date').lte('due_date', today).not('status', 'in', '(completada,completed,cancelled,canceled)').limit(5)
        : emptyRows,
      canViewMaintenance
        ? supabase.from('issues').select('id,title,status,priority,severity,created_at').not('status', 'in', '(resolved,closed,cancelled,canceled)').order('created_at', { ascending: false }).limit(5)
        : emptyRows,
      canViewOperations ? supabase.from('tasks').select('id', { count: 'exact', head: true }).gte('updated_at', since) : zero,
      canViewMaintenance ? supabase.from('issues').select('id', { count: 'exact', head: true }).gte('created_at', since) : zero,
      canViewMaintenance ? supabase.from('maintenance_tasks').select('id', { count: 'exact', head: true }).gte('created_at', since) : zero,
      canViewProcurement ? supabase.from('procurement_requests').select('id', { count: 'exact', head: true }).gte('updated_at', since) : zero,
    ])

    const results = [reservationRows, financeRows, maintenanceRows, procurementRows, taskRows, issueRows, changedTasks, changedIssues, changedMaintenance, changedProcurement]
    setPartial(results.some((result) => Boolean(result.error)))

    const next: DecisionItem[] = []
    if (!reservationRows.error) for (const row of reservationRows.data ?? []) {
      const blocks = [row.blocks_check_in ? 'check-in' : null, row.blocks_check_out ? 'check-out' : null].filter(Boolean).join(' + ')
      next.push({ key: `reservation-${row.reservation_id}-${row.title}`, domain: 'hospitality', title: row.title || text.hospitality, detail: `${text.blocks} ${blocks || 'stay'}${row.detail ? ` · ${row.detail}` : ''}`, why: text.reservationWhy, action: text.reservationAction, href: `/bookings/reservations/${row.reservation_id}`, priority: row.priority, rank: 0 })
    }
    if (!financeRows.error) for (const row of financeRows.data ?? []) {
      const amount = formatMoney(row.total_amount, row.currency, language)
      next.push({ key: `finance-${row.id}`, domain: 'finance', title: row.description || row.cost_center_name || row.supplier_name || row.document_number || text.financeFallback, detail: [amount ? `${text.amount} ${amount}` : null, row.due_date ? `${text.due} ${row.due_date}` : null].filter(Boolean).join(' · '), why: text.financeWhy, action: text.financeAction, href: `/budgets/approvals/${row.id}`, priority: 'high', rank: 0 })
    }
    if (!maintenanceRows.error) for (const row of maintenanceRows.data ?? []) {
      next.push({ key: `maintenance-${row.id}`, domain: 'maintenance', title: row.title || text.maintenanceFallback, detail: [text.blocks, row.fecha_objetivo ? `${text.due} ${row.fecha_objetivo}` : null].filter(Boolean).join(' · '), why: text.maintenanceWhy, action: text.maintenanceAction, href: `/maintenance/${row.id}`, priority: row.prioridad, rank: 1 })
    }
    if (!procurementRows.error) for (const row of procurementRows.data ?? []) {
      next.push({ key: `procurement-${row.id}`, domain: 'procurement', title: row.title || row.request_number || text.procurementFallback, detail: [row.request_number, row.status ? `${text.status} ${row.status}` : null, row.required_date ? `${text.due} ${row.required_date}` : null].filter(Boolean).join(' · '), why: text.procurementWhy, action: text.procurementAction, href: `/procurement/requests/${row.id}`, priority: row.priority, rank: 1 })
    }
    if (!taskRows.error) for (const row of taskRows.data ?? []) {
      next.push({ key: `task-${row.id}`, domain: 'tasks', title: row.title || text.taskFallback, detail: `${text.overdue}${row.due_date ? ` · ${text.due} ${row.due_date}` : ''}`, why: text.taskWhy, action: text.taskAction, href: `/tasks?selected=${row.id}`, priority: row.priority, rank: 2 })
    }
    if (!issueRows.error) for (const row of issueRows.data ?? []) {
      next.push({ key: `issue-${row.id}`, domain: 'issues', title: row.title || text.issueFallback, detail: [row.status ? `${text.status} ${row.status}` : null, row.created_at ? `${text.created} ${String(row.created_at).slice(0, 10)}` : null].filter(Boolean).join(' · '), why: text.issueWhy, action: text.issueAction, href: `/issues/${row.id}`, priority: row.severity || row.priority, rank: 2 })
    }

    next.sort((a, b) => a.rank - b.rank || priorityRank(a.priority) - priorityRank(b.priority) || a.title.localeCompare(b.title, localeMap[language]))
    setItems(next.slice(0, 8))

    const nextChanges: ChangeSignal[] = []
    if (!changedTasks.error && (changedTasks.count ?? 0) > 0) nextChanges.push({ key: 'tasks', label: text.changesTasks, value: changedTasks.count ?? 0, href: '/tasks' })
    if (!changedIssues.error && (changedIssues.count ?? 0) > 0) nextChanges.push({ key: 'issues', label: text.changesIssues, value: changedIssues.count ?? 0, href: '/issues' })
    if (!changedMaintenance.error && (changedMaintenance.count ?? 0) > 0) nextChanges.push({ key: 'maintenance', label: text.changesMaintenance, value: changedMaintenance.count ?? 0, href: '/maintenance' })
    if (!changedProcurement.error && (changedProcurement.count ?? 0) > 0) nextChanges.push({ key: 'procurement', label: text.changesProcurement, value: changedProcurement.count ?? 0, href: '/procurement' })
    setChanges(nextChanges)
    setLoading(false)
  }, [language, supabase, text])

  useEffect(() => { void load() }, [load])

  return (
    <section className="px-4 pt-5 md:px-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{text.description}</p>
      </div>
      {partial && <div className="mt-4 flex items-start gap-2 border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><span>{text.partial}</span></div>}
      {loading ? <div className="mt-4 flex items-center gap-2 py-6 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" />{text.loading}</div> : items.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 border-b border-border py-5"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><p className="font-medium">{text.empty}</p><p className="mt-1 text-sm text-muted-foreground">{text.emptyDetail}</p></div></div>
      ) : <div className="divide-y divide-border">{items.map((item) => (
        <div key={item.key} className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0"><p className="font-medium leading-6">{item.title}</p>{item.detail && <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>}<p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground/80">{text.why}:</span> {item.why}</p></div>
          <Link href={item.href} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline">{item.action}<ArrowRight className="h-4 w-4" /></Link>
        </div>
      ))}</div>}
      {!loading && changes.length > 0 && <div className="mt-6 border-t border-border pt-4"><div className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><h2 className="text-sm font-semibold">{text.recent}</h2><p className="mt-1 text-sm text-muted-foreground">{text.recentDescription}</p></div></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{changes.map((change) => <Link key={change.key} href={change.href} className="text-sm text-muted-foreground hover:text-foreground"><span className="font-semibold text-foreground">{change.value}</span> {change.label}</Link>)}</div></div>}
    </section>
  )
}
