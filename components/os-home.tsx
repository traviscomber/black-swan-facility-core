'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { osAreas, resolveAreaForPath, type OsAreaKey } from '@/lib/os/navigation'
import { rankAreasForPersona, type OsPersonaKey } from '@/lib/os/personas'
import { useOsPersona } from '@/lib/hooks/use-os-persona'
import { loadAuthorizedNavigation, type AuthorizedNavigation as Navigation, type AuthorizedNavItem as NavItem } from '@/lib/os/authorized-navigation-client'

type Signal = {
  key: string
  label: string
  value: number
  detail: string
  href: string
  group: 'attention' | 'today'
}

const areaLabels: Record<OsAreaKey, string> = {
  today: 'Hoy',
  operations: 'Operación',
  people: 'Personas',
  'places-assets': 'Lugares y activos',
  finance: 'Finanzas',
  network: 'Red',
}

function chileDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function hasNavKey(navigation: Navigation, key: string) {
  return Boolean(navigation.items?.some((item) => item.key === key))
}

async function loadTodaySignals(navigation: Navigation): Promise<Signal[]> {
  const supabase = createClient()
  const today = chileDateKey()
  const zero = Promise.resolve({ count: 0, error: null })

  const [arrivals, departures, tasksDue, maintenanceBlocked, maintenanceDue, issuesOpen, stockCritical, replenishmentOpen, financeReady, procurementPending] = await Promise.all([
    hasNavKey(navigation, 'bookings')
      ? supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('check_in', today).not('status', 'in', '(cancelled,canceled,cancelada)')
      : zero,
    hasNavKey(navigation, 'bookings')
      ? supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('check_out', today).not('status', 'in', '(cancelled,canceled,cancelada)')
      : zero,
    hasNavKey(navigation, 'tasks')
      ? supabase.from('tasks').select('id', { count: 'exact', head: true }).lte('due_date', today).not('status', 'in', '(completada,completed,cancelada,cancelled,canceled)')
      : zero,
    hasNavKey(navigation, 'maintenance')
      ? supabase.from('maintenance_tasks').select('id', { count: 'exact', head: true }).eq('bloqueado', true).not('status', 'in', '(completada,completed,cancelada,cancelled,canceled)')
      : zero,
    hasNavKey(navigation, 'maintenance')
      ? supabase.from('maintenance_tasks').select('id', { count: 'exact', head: true }).lte('fecha_objetivo', today).not('status', 'in', '(completada,completed,cancelada,cancelled,canceled)')
      : zero,
    hasNavKey(navigation, 'issues')
      ? supabase.from('issues').select('id', { count: 'exact', head: true }).not('status', 'in', '(resolved,closed,cancelada,cancelled,canceled)')
      : zero,
    hasNavKey(navigation, 'inventory')
      ? supabase.from('inventory_stock_status').select('*', { count: 'exact', head: true }).in('stock_state', ['low', 'out'])
      : zero,
    hasNavKey(navigation, 'inventory')
      ? supabase.from('inventory_replenishment_needs').select('id', { count: 'exact', head: true }).in('status', ['open', 'requested', 'sourcing', 'ordered', 'receiving'])
      : zero,
    hasNavKey(navigation, 'approvals')
      ? supabase.from('finance_approval_queue').select('*', { count: 'exact', head: true }).eq('approval_status', 'ready')
      : zero,
    hasNavKey(navigation, 'procurement')
      ? supabase.from('procurement_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'under_review'])
      : zero,
  ])

  const nextSignals: Signal[] = [
    { key: 'finance', label: 'Decisiones financieras', value: financeReady.count ?? 0, detail: 'Documentos listos para decisión', href: '/budgets/approvals', group: 'attention' },
    { key: 'procurement', label: 'Compras por decidir', value: procurementPending.count ?? 0, detail: 'Solicitudes enviadas o pendientes de aprobación', href: '/procurement', group: 'attention' },
    { key: 'maintenance-blocked', label: 'Mantenimiento bloqueado', value: maintenanceBlocked.count ?? 0, detail: 'Órdenes que requieren destrabe', href: '/maintenance', group: 'attention' },
    { key: 'maintenance-due', label: 'Mantenimiento vencido', value: maintenanceDue.count ?? 0, detail: 'Órdenes abiertas con fecha objetivo cumplida', href: '/maintenance', group: 'attention' },
    { key: 'issues', label: 'Incidentes abiertos', value: issuesOpen.count ?? 0, detail: 'Hallazgos todavía sin resolver', href: '/issues', group: 'attention' },
    { key: 'stock', label: 'Stock crítico', value: stockCritical.count ?? 0, detail: 'Posiciones bajo mínimo o sin stock', href: '/inventory/stock', group: 'attention' },
    { key: 'replenishment', label: 'Reposición en curso', value: replenishmentOpen.count ?? 0, detail: 'Necesidades todavía abiertas', href: '/inventory/replenishment', group: 'attention' },
    { key: 'tasks', label: 'Tareas vencidas o para hoy', value: tasksDue.count ?? 0, detail: 'Trabajo operativo que requiere ejecución', href: '/tasks', group: 'attention' },
    { key: 'arrivals', label: 'Llegadas', value: arrivals.count ?? 0, detail: 'Check-ins de hoy', href: '/bookings', group: 'today' },
    { key: 'departures', label: 'Salidas', value: departures.count ?? 0, detail: 'Check-outs de hoy', href: '/bookings', group: 'today' },
  ]

  return nextSignals.filter((signal) => signal.group === 'today' || signal.value > 0)
}

const selectableAreas = new Set<OsAreaKey>(['operations', 'people', 'places-assets', 'finance', 'network'])

const attentionPriority: Record<OsPersonaKey, string[]> = {
  executive: ['finance', 'procurement', 'issues', 'maintenance-blocked', 'maintenance-due', 'stock', 'replenishment', 'tasks'],
  field_admin: ['maintenance-blocked', 'maintenance-due', 'issues', 'tasks', 'stock', 'replenishment', 'procurement', 'finance'],
  general: ['issues', 'maintenance-blocked', 'maintenance-due', 'tasks', 'stock', 'replenishment', 'procurement', 'finance'],
}

const quickActionPriority: Record<OsPersonaKey, string[]> = {
  executive: ['approvals', 'bookings', 'procurement', 'inventory'],
  field_admin: ['bookings', 'tasks', 'maintenance', 'inventory', 'procurement'],
  general: ['bookings', 'tasks', 'maintenance', 'inventory'],
}

export function OsHome() {
  const searchParams = useSearchParams()
  const requestedArea = searchParams.get('area') as OsAreaKey | null
  const selectedArea = requestedArea && selectableAreas.has(requestedArea) ? requestedArea : null
  const [navigation, setNavigation] = useState<Navigation | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [signalsLoading, setSignalsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { persona, personaLabel, firstName } = useOsPersona()

  useEffect(() => {
    void loadAuthorizedNavigation().then(setNavigation).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load Black Swan OS'))
  }, [])

  useEffect(() => {
    if (!navigation || selectedArea) return
    let cancelled = false
    setSignalsLoading(true)
    void loadTodaySignals(navigation)
      .then((nextSignals) => { if (!cancelled) setSignals(nextSignals) })
      .catch(() => { if (!cancelled) setSignals([]) })
      .finally(() => { if (!cancelled) setSignalsLoading(false) })
    return () => { cancelled = true }
  }, [navigation, selectedArea])

  const grouped = useMemo(() => {
    const groups = new Map<OsAreaKey | 'other', NavItem[]>()
    for (const item of navigation?.items || []) {
      const area = resolveAreaForPath(item.href) ?? 'other'
      groups.set(area, [...(groups.get(area) || []), item])
    }
    return groups
  }, [navigation])

  const visibleItems = selectedArea ? (grouped.get(selectedArea) || []) : []
  const selectedDefinition = selectedArea ? osAreas.find((area) => area.key === selectedArea) : null

  const attentionSignals = useMemo(() => {
    const priority = new Map(attentionPriority[persona].map((key, index) => [key, index]))
    return signals
      .filter((signal) => signal.group === 'attention')
      .sort((a, b) => (priority.get(a.key) ?? 99) - (priority.get(b.key) ?? 99))
  }, [persona, signals])

  const todaySignals = signals.filter((signal) => signal.group === 'today')

  const quickActions = useMemo(() => {
    const items = navigation?.items || []
    return quickActionPriority[persona]
      .map((key) => items.find((item) => item.key === key))
      .filter((item): item is NavItem => Boolean(item))
      .slice(0, 5)
  }, [navigation, persona])

  const workspaceAreas = useMemo(() => rankAreasForPersona(
    osAreas.filter((area) => area.key !== 'today' && (grouped.get(area.key)?.length ?? 0) > 0),
    persona,
  ), [grouped, persona])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{selectedDefinition ? areaLabels[selectedDefinition.key] : `Hoy${firstName ? `, ${firstName}` : ''}`}</CardTitle>
            {!selectedArea && <Badge variant="secondary">{personaLabel}</Badge>}
            {navigation?.role && <Badge variant="outline">{navigation.role}</Badge>}
          </div>
          <CardDescription>
            {selectedArea ? 'Workspaces autorizados en esta área del OS.' : 'Lo que necesitas saber, decidir o ejecutar ahora. La profundidad completa sigue disponible en cada workspace.'}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/os" className={`rounded border px-3 py-1.5 text-sm ${!selectedArea ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Hoy</Link>
        {workspaceAreas.map((area) => (
          <Link key={area.key} href={`/os?area=${area.key}`} className={`rounded border px-3 py-1.5 text-sm ${selectedArea === area.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{areaLabels[area.key]}</Link>
        ))}
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {!selectedArea && !error && navigation && <>
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Requiere atención</h2>
            <p className="text-sm text-muted-foreground">Excepciones y decisiones, ordenadas para tu función.</p>
          </div>
          {signalsLoading ? (
            <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Actualizando operación…</div>
          ) : attentionSignals.length === 0 ? (
            <div className="flex items-center gap-3 rounded border border-dashed p-5 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5" /><span>Sin pendientes críticos visibles para tu acceso.</span></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {attentionSignals.map((signal) => (
                <Link key={signal.key} href={signal.href} className="group rounded-lg border p-4 transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-medium">{signal.label}</p><p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p></div>
                    <span className="text-2xl font-semibold tabular-nums">{signal.value}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">Abrir <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div><h2 className="text-lg font-semibold">Operación de hoy</h2><p className="text-sm text-muted-foreground">Pulso del día en horario de Santiago.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {todaySignals.map((signal) => (
              <Link href={signal.href} key={signal.key} className="rounded-lg border p-4 hover:bg-muted/40">
                <p className="text-sm text-muted-foreground">{signal.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{signal.value}</p><p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p>
              </Link>
            ))}
          </div>
        </section>

        {quickActions.length > 0 && <section className="space-y-3">
          <div><h2 className="text-lg font-semibold">Acciones rápidas</h2><p className="text-sm text-muted-foreground">Atajos sólo a workspaces que el servidor ya autorizó.</p></div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((item) => <Link key={item.key} href={item.href} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">{item.label}</Link>)}
          </div>
        </section>}

        <section className="space-y-3 border-t pt-5">
          <div><h2 className="text-base font-semibold">Workspaces</h2><p className="text-sm text-muted-foreground">El sistema completo, ordenado por tu contexto de trabajo.</p></div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {workspaceAreas.map((area) => <Link key={area.key} href={`/os?area=${area.key}`} className="flex items-center justify-between rounded border px-4 py-3 text-sm hover:bg-muted/40"><span className="font-medium">{areaLabels[area.key]}</span><Badge variant="secondary">{grouped.get(area.key)?.length ?? 0}</Badge></Link>)}
          </div>
        </section>
      </>}

      {selectedArea && !error && navigation && visibleItems.length === 0 && <div className="rounded border border-dashed p-6 text-sm text-muted-foreground">No hay workspaces autorizados disponibles en esta área.</div>}

      {selectedArea && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => (
          <Link href={item.href} key={item.key}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader><CardTitle className="text-base">{item.label}</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-1 text-sm text-muted-foreground">Abrir workspace <ArrowRight className="h-4 w-4" /></CardContent>
            </Card>
          </Link>
        ))}
      </div>}
    </div>
  )
}