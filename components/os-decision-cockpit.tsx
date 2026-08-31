'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/hooks/use-language'

type Navigation = { items?: Array<{ key: string; href: string; label: string }> }
type DecisionItem = {
  key: string
  domain: 'hospitality' | 'finance' | 'maintenance' | 'procurement' | 'tasks' | 'issues'
  title: string
  detail: string
  href: string
  priority: string | null
  rank: number
}
type ChangeSignal = { key: string; label: string; value: number; href: string }

const copy = {
  en: {
    eyebrow: 'Decision cockpit', title: 'Needs a decision now', description: 'Concrete canonical objects that are blocked, overdue, awaiting approval, or require triage. No synthetic scores.',
    empty: 'No visible decision blockers for your access.', open: 'Open', recent: 'Changed in the last 24 hours', recentDescription: 'Observed changes in canonical operating records.',
    loading: 'Refreshing decision queue…', partial: 'Some sources could not be refreshed; available evidence is still shown.',
    hospitality: 'Hospitality', finance: 'Finance', maintenance: 'Maintenance', procurement: 'Procurement', tasks: 'Tasks', issues: 'Issues',
    financeFallback: 'Document ready for approval', maintenanceFallback: 'Blocked maintenance', procurementFallback: 'Purchase request', taskFallback: 'Operational task', issueFallback: 'Open issue',
    blocks: 'Blocks', overdue: 'Overdue', due: 'Due', amount: 'Amount', status: 'Status', created: 'Created',
    changesTasks: 'Tasks changed', changesIssues: 'Issues created', changesMaintenance: 'Maintenance created', changesProcurement: 'Purchases changed',
  },
  es: {
    eyebrow: 'Decision cockpit', title: 'Necesita decisión ahora', description: 'Objetos canónicos concretos bloqueados, vencidos, pendientes de aprobación o que requieren triaje. Sin scores sintéticos.',
    empty: 'No hay bloqueos de decisión visibles para tu acceso.', open: 'Abrir', recent: 'Cambió en las últimas 24 horas', recentDescription: 'Cambios observados en registros operativos canónicos.',
    loading: 'Actualizando cola de decisiones…', partial: 'Algunas fuentes no pudieron actualizarse; se muestra la evidencia disponible.',
    hospitality: 'Hospitality', finance: 'Finanzas', maintenance: 'Mantenimiento', procurement: 'Compras', tasks: 'Tareas', issues: 'Incidencias',
    financeFallback: 'Documento listo para aprobación', maintenanceFallback: 'Mantenimiento bloqueado', procurementFallback: 'Solicitud de compra', taskFallback: 'Tarea operativa', issueFallback: 'Incidencia abierta',
    blocks: 'Bloquea', overdue: 'Vencido', due: 'Vence', amount: 'Monto', status: 'Estado', created: 'Creado',
    changesTasks: 'Tareas modificadas', changesIssues: 'Incidencias creadas', changesMaintenance: 'Mantenimientos creados', changesProcurement: 'Compras modificadas',
  },
  de: {
    eyebrow: 'Decision Cockpit', title: 'Jetzt entscheidungsrelevant', description: 'Konkrete kanonische Objekte, die blockiert, überfällig, freigabepflichtig oder zu triagieren sind. Keine synthetischen Scores.',
    empty: 'Keine sichtbaren Entscheidungsblocker für deinen Zugriff.', open: 'Öffnen', recent: 'In den letzten 24 Stunden geändert', recentDescription: 'Beobachtete Änderungen in kanonischen Betriebsdaten.',
    loading: 'Entscheidungswarteschlange wird aktualisiert…', partial: 'Einige Quellen konnten nicht aktualisiert werden; verfügbare Evidenz wird weiterhin angezeigt.',
    hospitality: 'Hospitality', finance: 'Finanzen', maintenance: 'Instandhaltung', procurement: 'Beschaffung', tasks: 'Aufgaben', issues: 'Vorfälle',
    financeFallback: 'Dokument zur Freigabe bereit', maintenanceFallback: 'Blockierte Instandhaltung', procurementFallback: 'Beschaffungsanfrage', taskFallback: 'Betriebliche Aufgabe', issueFallback: 'Offener Vorfall',
    blocks: 'Blockiert', overdue: 'Überfällig', due: 'Fällig', amount: 'Betrag', status: 'Status', created: 'Erstellt',
    changesTasks: 'Geänderte Aufgaben', changesIssues: 'Neue Vorfälle', changesMaintenance: 'Neue Instandhaltung', changesProcurement: 'Geänderte Beschaffung',
  },
} as const

const localeMap = { en: 'en-US', es: 'es-CL', de: 'de-DE' } as const

function hasNavKey(navigation: Navigation, key: string) {
  return Boolean(navigation.items?.some((item) => item.key === key))
}

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

    const [reservationRows, financeRows, maintenanceRows, procurementRows, taskRows, issueRows, changedTasks, changedIssues, changedMaintenance, changedProcurement] = await Promise.all([
      hasNavKey(navigation, 'bookings')
        ? supabase.from('reservation_operational_exceptions').select('reservation_id,title,detail,priority,exception_state,blocks_check_in,blocks_check_out').in('exception_state', ['open', 'overdue']).or('blocks_check_in.eq.true,blocks_check_out.eq.true').limit(5)
        : emptyRows,
      canApproveFinance
        ? supabase.from('finance_approval_queue').select('id,operational_label,total_amount,currency,due_date,approval_status').eq('approval_status', 'ready').limit(5)
        : emptyRows,
      hasNavKey(navigation, 'maintenance')
        ? supabase.from('maintenance_tasks').select('id,title,prioridad,fecha_objetivo,status,bloqueado').eq('bloqueado', true).not('status', 'in', '(completada,completed,cancelada,cancelled,canceled)').limit(5)
        : emptyRows,
      hasNavKey(navigation, 'procurement')
        ? supabase.from('procurement_requests').select('id,request_number,title,priority,status,required_date').in('status', ['submitted', 'pending_approval']).limit(5)
        : emptyRows,
      hasNavKey(navigation, 'tasks')
        ? supabase.from('tasks').select('id,title,status,priority,due_date').lte('due_date', today).not('status', 'in', '(completada,completed,cancelled,canceled)').limit(5)
        : emptyRows,
      hasNavKey(navigation, 'issues')
        ? supabase.from('issues').select('id,title,status,priority,severity,created_at').not('status', 'in', '(resolved,closed,cancelled,canceled)').order('created_at', { ascending: false }).limit(5)
        : emptyRows,
      hasNavKey(navigation, 'tasks') ? supabase.from('tasks').select('id', { count: 'exact', head: true }).gte('updated_at', since) : zero,
      hasNavKey(navigation, 'issues') ? supabase.from('issues').select('id', { count: 'exact', head: true }).gte('created_at', since) : zero,
      hasNavKey(navigation, 'maintenance') ? supabase.from('maintenance_tasks').select('id', { count: 'exact', head: true }).gte('created_at', since) : zero,
      hasNavKey(navigation, 'procurement') ? supabase.from('procurement_requests').select('id', { count: 'exact', head: true }).gte('updated_at', since) : zero,
    ])

    const results = [reservationRows, financeRows, maintenanceRows, procurementRows, taskRows, issueRows, changedTasks, changedIssues, changedMaintenance, changedProcurement]
    setPartial(results.some((result) => Boolean(result.error)))

    const next: DecisionItem[] = []
    if (!reservationRows.error) for (const row of reservationRows.data ?? []) {
      const blocks = [row.blocks_check_in ? 'check-in' : null, row.blocks_check_out ? 'check-out' : null].filter(Boolean).join(' + ')
      next.push({ key: `reservation-${row.reservation_id}-${row.title}`, domain: 'hospitality', title: row.title || text.hospitality, detail: `${text.blocks} ${blocks || 'stay'}${row.detail ? ` · ${row.detail}` : ''}`, href: `/bookings/reservations/${row.reservation_id}`, priority: row.priority, rank: 0 })
    }
    if (!financeRows.error) for (const row of financeRows.data ?? []) {
      const amount = formatMoney(row.total_amount, row.currency, language)
      next.push({ key: `finance-${row.id}`, domain: 'finance', title: row.operational_label || text.financeFallback, detail: [amount ? `${text.amount} ${amount}` : null, row.due_date ? `${text.due} ${row.due_date}` : null].filter(Boolean).join(' · '), href: '/budgets/approvals', priority: 'high', rank: 0 })
    }
    if (!maintenanceRows.error) for (const row of maintenanceRows.data ?? []) {
      next.push({ key: `maintenance-${row.id}`, domain: 'maintenance', title: row.title || text.maintenanceFallback, detail: [text.blocks, row.fecha_objetivo ? `${text.due} ${row.fecha_objetivo}` : null].filter(Boolean).join(' · '), href: `/maintenance/${row.id}`, priority: row.prioridad, rank: 1 })
    }
    if (!procurementRows.error) for (const row of procurementRows.data ?? []) {
      next.push({ key: `procurement-${row.id}`, domain: 'procurement', title: row.title || row.request_number || text.procurementFallback, detail: [row.request_number, row.status ? `${text.status} ${row.status}` : null, row.required_date ? `${text.due} ${row.required_date}` : null].filter(Boolean).join(' · '), href: `/procurement/requests/${row.id}`, priority: row.priority, rank: 1 })
    }
    if (!taskRows.error) for (const row of taskRows.data ?? []) {
      next.push({ key: `task-${row.id}`, domain: 'tasks', title: row.title || text.taskFallback, detail: `${text.overdue}${row.due_date ? ` · ${text.due} ${row.due_date}` : ''}`, href: `/tasks?selected=${row.id}`, priority: row.priority, rank: 2 })
    }
    if (!issueRows.error) for (const row of issueRows.data ?? []) {
      next.push({ key: `issue-${row.id}`, domain: 'issues', title: row.title || text.issueFallback, detail: [row.status ? `${text.status} ${row.status}` : null, row.created_at ? `${text.created} ${String(row.created_at).slice(0, 10)}` : null].filter(Boolean).join(' · '), href: `/issues/${row.id}`, priority: row.severity || row.priority, rank: 2 })
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

  const domainLabels = { hospitality: text.hospitality, finance: text.finance, maintenance: text.maintenance, procurement: text.procurement, tasks: text.tasks, issues: text.issues }

  return (
    <section className="px-4 pt-4 md:px-6">
      <Card className="border-primary/20 bg-primary/[.025]">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">{text.eyebrow}</p>
              <CardTitle className="mt-1 text-xl">{text.title}</CardTitle>
              <CardDescription className="mt-1 max-w-3xl">{text.description}</CardDescription>
            </div>
            {!loading && <Badge variant={items.length > 0 ? 'default' : 'secondary'}>{items.length}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {partial && <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{text.partial}</div>}
          {loading ? <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{text.loading}</div> : items.length === 0 ? <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" />{text.empty}</div> : (
            <div className="grid gap-2 lg:grid-cols-2">
              {items.map((item) => <Link key={item.key} href={item.href} className="group rounded-lg border bg-background/60 p-3 transition-colors hover:bg-muted/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="outline" className="text-[10px]">{domainLabels[item.domain]}</Badge>{item.priority && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.priority}</span>}</div><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p></div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>)}
            </div>
          )}
          {!loading && changes.length > 0 && <div className="border-t pt-3"><div className="mb-2 flex items-center gap-2"><Clock3 className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">{text.recent}</p><p className="text-xs text-muted-foreground">{text.recentDescription}</p></div></div><div className="flex flex-wrap gap-2">{changes.map((change) => <Link key={change.key} href={change.href} className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"><span className="font-semibold tabular-nums">{change.value}</span> {change.label}</Link>)}</div></div>}
        </CardContent>
      </Card>
    </section>
  )
}
