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
import { useLanguage } from '@/lib/hooks/use-language'
import { loadAuthorizedNavigation, type AuthorizedNavigation as Navigation, type AuthorizedNavItem as NavItem } from '@/lib/os/authorized-navigation-client'

type Signal = {
  key: string
  label: string
  value: number
  detail: string
  href: string
  group: 'attention' | 'today'
}

type Language = 'en' | 'es' | 'de'

const uiCopy = {
  en: {
    today: 'Today', areaDescription: 'Authorized workspaces in this OS area.', homeDescription: 'What you need to know, decide, or execute now. Full depth remains available in each workspace.',
    attentionTitle: 'Requires attention', attentionDescription: 'Exceptions and decisions, ordered for your role.', updating: 'Updating operations…', noCritical: 'No critical pending items visible for your access.',
    todayTitle: "Today's operation", todayDescription: 'Daily pulse in Santiago time.', quickTitle: 'Quick actions', quickDescription: 'Shortcuts only to workspaces already authorized by the server.',
    workspaces: 'Workspaces', workspacesDescription: 'The complete system, ordered for your work context.', noWorkspaces: 'No authorized workspaces are available in this area.', open: 'Open', openWorkspace: 'Open workspace',
    areaLabels: { today: 'Today', operations: 'Operations', people: 'People', 'places-assets': 'Places & Assets', finance: 'Finance', network: 'Network' },
  },
  es: {
    today: 'Hoy', areaDescription: 'Workspaces autorizados en esta área del OS.', homeDescription: 'Lo que necesitas saber, decidir o ejecutar ahora. La profundidad completa sigue disponible en cada workspace.',
    attentionTitle: 'Requiere atención', attentionDescription: 'Excepciones y decisiones, ordenadas para tu función.', updating: 'Actualizando operación…', noCritical: 'Sin pendientes críticos visibles para tu acceso.',
    todayTitle: 'Operación de hoy', todayDescription: 'Pulso del día en horario de Santiago.', quickTitle: 'Acciones rápidas', quickDescription: 'Atajos sólo a workspaces que el servidor ya autorizó.',
    workspaces: 'Workspaces', workspacesDescription: 'El sistema completo, ordenado por tu contexto de trabajo.', noWorkspaces: 'No hay workspaces autorizados disponibles en esta área.', open: 'Abrir', openWorkspace: 'Abrir workspace',
    areaLabels: { today: 'Hoy', operations: 'Operación', people: 'Personas', 'places-assets': 'Lugares y activos', finance: 'Finanzas', network: 'Red' },
  },
  de: {
    today: 'Heute', areaDescription: 'Autorisierte Arbeitsbereiche in diesem OS-Bereich.', homeDescription: 'Was jetzt bekannt, entschieden oder ausgeführt werden muss. Die vollständige Tiefe bleibt in jedem Arbeitsbereich verfügbar.',
    attentionTitle: 'Erfordert Aufmerksamkeit', attentionDescription: 'Ausnahmen und Entscheidungen, nach deiner Rolle geordnet.', updating: 'Betrieb wird aktualisiert…', noCritical: 'Keine kritischen offenen Punkte für deinen Zugriff sichtbar.',
    todayTitle: 'Heutiger Betrieb', todayDescription: 'Tagesstatus in Santiago-Zeit.', quickTitle: 'Schnellaktionen', quickDescription: 'Verknüpfungen nur zu bereits serverseitig autorisierten Arbeitsbereichen.',
    workspaces: 'Arbeitsbereiche', workspacesDescription: 'Das vollständige System, nach deinem Arbeitskontext geordnet.', noWorkspaces: 'In diesem Bereich sind keine autorisierten Arbeitsbereiche verfügbar.', open: 'Öffnen', openWorkspace: 'Arbeitsbereich öffnen',
    areaLabels: { today: 'Heute', operations: 'Betrieb', people: 'Personen', 'places-assets': 'Orte & Anlagen', finance: 'Finanzen', network: 'Netzwerk' },
  },
} as const

const navLabels = {
  en: {
    bookings: 'Reservations', activities: 'Activities', tasks: 'Tasks', checklists: 'Checklists', procurement: 'Procurement', maintenance: 'Maintenance', issues: 'Issues', 'guest-requests': 'Guest requests', employees: 'People',
    'property-management': 'Properties', inventory: 'Inventory', energy: 'Energy', map: 'Map', orchard: 'Orchard', vineyard: 'Vineyard', cattle: 'Cattle', 'cattle-health': 'Animal health', fuel: 'Fuels',
    budget: 'Budget', approvals: 'Approvals', documents: 'Documents', reconciliation: 'Reconciliation', accounting: 'Accounting', invoices: 'Invoices', discovery: 'Discovery', events: 'Events', 'event-providers': 'Event providers', 'front-door': 'Front door', education: 'Education', 'os-people': 'People',
  },
  es: {
    bookings: 'Reservas', activities: 'Actividades', tasks: 'Tareas', checklists: 'Listas de verificación', procurement: 'Adquisiciones y Procuramiento', maintenance: 'Mantenimiento', issues: 'Incidencias', 'guest-requests': 'Solicitudes de huéspedes', employees: 'Personas',
    'property-management': 'Propiedades', inventory: 'Inventario', energy: 'Energía', map: 'Mapa', orchard: 'Huerto', vineyard: 'Viñedo', cattle: 'Ganadería', 'cattle-health': 'Salud animal', fuel: 'Combustibles',
    budget: 'Presupuesto', approvals: 'Aprobaciones', documents: 'Documentos', reconciliation: 'Conciliación', accounting: 'Contabilidad', invoices: 'Facturas', discovery: 'Discovery', events: 'Eventos', 'event-providers': 'Proveedores de eventos', 'front-door': 'Acceso principal', education: 'Educación', 'os-people': 'Personas',
  },
  de: {
    bookings: 'Reservierungen', activities: 'Aktivitäten', tasks: 'Aufgaben', checklists: 'Checklisten', procurement: 'Beschaffung', maintenance: 'Instandhaltung', issues: 'Vorfälle', 'guest-requests': 'Gästeanfragen', employees: 'Personen',
    'property-management': 'Immobilien', inventory: 'Inventar', energy: 'Energie', map: 'Karte', orchard: 'Obstgarten', vineyard: 'Weinberg', cattle: 'Rinder', 'cattle-health': 'Tiergesundheit', fuel: 'Kraftstoffe',
    budget: 'Budget', approvals: 'Freigaben', documents: 'Dokumente', reconciliation: 'Abstimmung', accounting: 'Buchhaltung', invoices: 'Rechnungen', discovery: 'Discovery', events: 'Ereignisse', 'event-providers': 'Eventanbieter', 'front-door': 'Eingang', education: 'Bildung', 'os-people': 'Personen',
  },
} as const

const reportLabels = { en: 'Financial Reports', es: 'Reportes financieros', de: 'Finanzberichte' } as const

const signalCopy = {
  en: {
    'booking-overdue': ['Overdue reservations without closure', 'Active stays with a past check-out'], finance: ['Financial decisions', 'Documents ready for decision'], procurement: ['Procurement decisions', 'Submitted or approval-pending requests'],
    'maintenance-blocked': ['Blocked maintenance', 'Work orders that need to be unblocked'], 'maintenance-due': ['Overdue maintenance', 'Open work orders past their target date'], issues: ['Open incidents', 'Findings not yet resolved'],
    stock: ['Critical stock', 'Positions below minimum or out of stock'], replenishment: ['Replenishment in progress', 'Needs that are still open'], tasks: ['Tasks due or overdue today', 'Operational work requiring execution'], arrivals: ['Arrivals', "Today's check-ins"], departures: ['Departures', "Today's check-outs"],
  },
  es: {
    'booking-overdue': ['Reservas vencidas sin cierre', 'Estadías con check-out vencido que siguen activas'], finance: ['Decisiones financieras', 'Documentos listos para decisión'], procurement: ['Compras por decidir', 'Solicitudes enviadas o pendientes de aprobación'],
    'maintenance-blocked': ['Mantenimiento bloqueado', 'Órdenes que requieren destrabe'], 'maintenance-due': ['Mantenimiento vencido', 'Órdenes abiertas con fecha objetivo cumplida'], issues: ['Incidentes abiertos', 'Hallazgos todavía sin resolver'],
    stock: ['Stock crítico', 'Posiciones bajo mínimo o sin stock'], replenishment: ['Reposición en curso', 'Necesidades todavía abiertas'], tasks: ['Tareas vencidas o para hoy', 'Trabajo operativo que requiere ejecución'], arrivals: ['Llegadas', 'Check-ins de hoy'], departures: ['Salidas', 'Check-outs de hoy'],
  },
  de: {
    'booking-overdue': ['Überfällige Reservierungen ohne Abschluss', 'Aktive Aufenthalte mit überschrittenem Check-out'], finance: ['Finanzentscheidungen', 'Dokumente sind entscheidungsbereit'], procurement: ['Beschaffungsentscheidungen', 'Eingereichte oder noch freizugebende Anfragen'],
    'maintenance-blocked': ['Blockierte Instandhaltung', 'Aufträge, die entsperrt werden müssen'], 'maintenance-due': ['Überfällige Instandhaltung', 'Offene Aufträge nach Zieldatum'], issues: ['Offene Vorfälle', 'Noch nicht gelöste Feststellungen'],
    stock: ['Kritischer Bestand', 'Positionen unter Mindestbestand oder ohne Bestand'], replenishment: ['Nachschub läuft', 'Noch offene Bedarfe'], tasks: ['Heute fällige oder überfällige Aufgaben', 'Operative Arbeit, die ausgeführt werden muss'], arrivals: ['Anreisen', 'Heutige Check-ins'], departures: ['Abreisen', 'Heutige Check-outs'],
  },
} as const

const LOCALE_PATH = /^\/(?:en|es|de)(?:\/|$)/

function withLocale(href: string, language: Language) {
  if (!href.startsWith('/') || LOCALE_PATH.test(href)) return href
  return `/${language}${href}`
}

function displayNavLabel(item: NavItem, language: Language) {
  if (item.href === '/accounting/reports') return reportLabels[language]
  return (navLabels[language] as Record<string, string>)[item.key] ?? item.label
}

function displaySignal(signal: Signal, language: Language) {
  const localized = (signalCopy[language] as Record<string, readonly [string, string]>)[signal.key]
  return localized ? { label: localized[0], detail: localized[1] } : { label: signal.label, detail: signal.detail }
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

  const [arrivals, departures, overdueReservations, tasksDue, maintenanceBlocked, maintenanceDue, issuesOpen, stockCritical, replenishmentOpen, financeReady, procurementPending] = await Promise.all([
    hasNavKey(navigation, 'bookings')
      ? supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('check_in', today).not('status', 'in', '(cancelled,canceled,cancelada)')
      : zero,
    hasNavKey(navigation, 'bookings')
      ? supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('check_out', today).not('status', 'in', '(cancelled,canceled,cancelada)')
      : zero,
    hasNavKey(navigation, 'bookings')
      ? supabase.from('reservations').select('id', { count: 'exact', head: true }).lt('check_out', today).in('status', ['pending', 'confirmed', 'waiting_for_room', 'ready_for_checkin', 'checked_in', 'checked-in'])
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
    { key: 'booking-overdue', label: 'Reservas vencidas sin cierre', value: overdueReservations.count ?? 0, detail: 'Estadías con check-out vencido que siguen activas', href: '/bookings/exceptions', group: 'attention' },
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
  executive: ['booking-overdue', 'finance', 'procurement', 'issues', 'maintenance-blocked', 'maintenance-due', 'stock', 'replenishment', 'tasks'],
  field_admin: ['booking-overdue', 'maintenance-blocked', 'maintenance-due', 'issues', 'tasks', 'stock', 'replenishment', 'procurement', 'finance'],
  general: ['booking-overdue', 'issues', 'maintenance-blocked', 'maintenance-due', 'tasks', 'stock', 'replenishment', 'procurement', 'finance'],
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
  const { language } = useLanguage()
  const lang = language as Language
  const text = uiCopy[lang]
  const osHref = `/${lang}/os`

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
            <CardTitle>{selectedDefinition ? text.areaLabels[selectedDefinition.key] : `${text.today}${firstName ? `, ${firstName}` : ''}`}</CardTitle>
            {!selectedArea && <Badge variant="secondary">{personaLabel}</Badge>}
            {navigation?.role && <Badge variant="outline">{navigation.role}</Badge>}
          </div>
          <CardDescription>{selectedArea ? text.areaDescription : text.homeDescription}</CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href={osHref} className={`rounded border px-3 py-1.5 text-sm ${!selectedArea ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{text.today}</Link>
        {workspaceAreas.map((area) => (
          <Link key={area.key} href={`${osHref}?area=${area.key}`} className={`rounded border px-3 py-1.5 text-sm ${selectedArea === area.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{text.areaLabels[area.key]}</Link>
        ))}
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {!selectedArea && !error && navigation && <>
        <section className="space-y-3">
          <div><h2 className="text-lg font-semibold">{text.attentionTitle}</h2><p className="text-sm text-muted-foreground">{text.attentionDescription}</p></div>
          {signalsLoading ? (
            <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">{text.updating}</div>
          ) : attentionSignals.length === 0 ? (
            <div className="flex items-center gap-3 rounded border border-dashed p-5 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5" /><span>{text.noCritical}</span></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {attentionSignals.map((signal) => {
                const localized = displaySignal(signal, lang)
                return <Link key={signal.key} href={withLocale(signal.href, lang)} className="group rounded-lg border p-4 transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{localized.label}</p><p className="mt-1 text-xs text-muted-foreground">{localized.detail}</p></div><span className="text-2xl font-semibold tabular-nums">{signal.value}</span></div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">{text.open} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div>
                </Link>
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div><h2 className="text-lg font-semibold">{text.todayTitle}</h2><p className="text-sm text-muted-foreground">{text.todayDescription}</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {todaySignals.map((signal) => {
              const localized = displaySignal(signal, lang)
              return <Link href={withLocale(signal.href, lang)} key={signal.key} className="rounded-lg border p-4 hover:bg-muted/40">
                <p className="text-sm text-muted-foreground">{localized.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{signal.value}</p><p className="mt-1 text-xs text-muted-foreground">{localized.detail}</p>
              </Link>
            })}
          </div>
        </section>

        {quickActions.length > 0 && <section className="space-y-3">
          <div><h2 className="text-lg font-semibold">{text.quickTitle}</h2><p className="text-sm text-muted-foreground">{text.quickDescription}</p></div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((item) => <Link key={item.key} href={withLocale(item.href, lang)} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">{displayNavLabel(item, lang)}</Link>)}
          </div>
        </section>}

        <section className="space-y-3 border-t pt-5">
          <div><h2 className="text-base font-semibold">{text.workspaces}</h2><p className="text-sm text-muted-foreground">{text.workspacesDescription}</p></div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {workspaceAreas.map((area) => <Link key={area.key} href={`${osHref}?area=${area.key}`} className="flex items-center justify-between rounded border px-4 py-3 text-sm hover:bg-muted/40"><span className="font-medium">{text.areaLabels[area.key]}</span><Badge variant="secondary">{grouped.get(area.key)?.length ?? 0}</Badge></Link>)}
          </div>
        </section>
      </>}

      {selectedArea && !error && navigation && visibleItems.length === 0 && <div className="rounded border border-dashed p-6 text-sm text-muted-foreground">{text.noWorkspaces}</div>}

      {selectedArea && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => (
          <Link href={withLocale(item.href, lang)} key={item.key}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader><CardTitle className="text-base">{displayNavLabel(item, lang)}</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-1 text-sm text-muted-foreground">{text.openWorkspace} <ArrowRight className="h-4 w-4" /></CardContent>
            </Card>
          </Link>
        ))}
      </div>}
    </div>
  )
}
