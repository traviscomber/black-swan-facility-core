'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, BedDouble, CheckCircle2, ClipboardList, FileCheck2, ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

type NavItem = { key: string; label: string; href: string }
type Navigation = { role?: string; items?: NavItem[] }
type PictureSignal = {
  key: string
  label: string
  value: number
  detail: string
  href: string
  alert?: boolean
}
type FinanceApprovalRow = { total_amount: number | string | null; currency: string | null }
type FinancePicture = { count: number; totals: Record<string, number> }

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

function chileDateOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function financeTotals(rows: FinanceApprovalRow[]): FinancePicture {
  const totals: Record<string, number> = {}
  for (const row of rows) {
    const currency = row.currency || 'CLP'
    const amount = Number(row.total_amount ?? 0)
    totals[currency] = (totals[currency] ?? 0) + (Number.isFinite(amount) ? amount : 0)
  }
  return { count: rows.length, totals }
}

function formatFinanceTotals(totals: Record<string, number>) {
  const parts = Object.entries(totals).map(([currency, amount]) => {
    try {
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: currency === 'CLP' ? 0 : 2 }).format(amount)
    } catch {
      return `${amount.toLocaleString('es-CL')} ${currency}`
    }
  })
  return parts.length > 0 ? parts.join(' · ') : 'Sin monto pendiente visible'
}

export function BigPictureHome() {
  const supabase = useMemo(() => createClient(), [])
  const [navigation, setNavigation] = useState<Navigation | null>(null)
  const [hospitality, setHospitality] = useState<PictureSignal[]>([])
  const [work, setWork] = useState<PictureSignal[]>([])
  const [supply, setSupply] = useState<PictureSignal[]>([])
  const [finance, setFinance] = useState<FinancePicture | null>(null)
  const [financeAllowed, setFinanceAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nav = await loadNavigation()
      setNavigation(nav)
      const today = chileDateOffset(0)
      const horizon = chileDateOffset(7)
      const zero = Promise.resolve({ count: 0, error: null })

      const financePermission = await supabase.rpc('can_finance_approve')
      const canApprove = !financePermission.error && Boolean(financePermission.data)
      setFinanceAllowed(canApprove)

      const [
        arrivals7d,
        departures7d,
        openRequests,
        blockingExceptions,
        openTasks,
        blockedMaintenance,
        openIssues,
        criticalStock,
        replenishment,
        procurementPending,
        financeRows,
      ] = await Promise.all([
        hasNavKey(nav, 'bookings')
          ? supabase.from('reservations').select('id', { count: 'exact', head: true }).gte('check_in', today).lt('check_in', horizon).not('status', 'in', '(cancelled,canceled,void,voided)')
          : zero,
        hasNavKey(nav, 'bookings')
          ? supabase.from('reservations').select('id', { count: 'exact', head: true }).gte('check_out', today).lt('check_out', horizon).not('status', 'in', '(cancelled,canceled,void,voided)')
          : zero,
        hasNavKey(nav, 'bookings')
          ? supabase.from('hospitality_requests').select('id', { count: 'exact', head: true }).not('status', 'in', '(completed,resolved,closed,cancelled,canceled)')
          : zero,
        hasNavKey(nav, 'bookings')
          ? supabase.from('reservation_operational_exceptions').select('reservation_id', { count: 'exact', head: true }).in('exception_state', ['open', 'overdue']).or('blocks_check_in.eq.true,blocks_check_out.eq.true')
          : zero,
        hasNavKey(nav, 'tasks')
          ? supabase.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(completada,completed,cancelled,canceled)')
          : zero,
        hasNavKey(nav, 'maintenance')
          ? supabase.from('maintenance_tasks').select('id', { count: 'exact', head: true }).eq('bloqueado', true).not('status', 'in', '(completada,completed,cancelada,cancelled,canceled)')
          : zero,
        hasNavKey(nav, 'issues')
          ? supabase.from('issues').select('id', { count: 'exact', head: true }).not('status', 'in', '(resolved,closed,cancelled,canceled)')
          : zero,
        hasNavKey(nav, 'inventory')
          ? supabase.from('inventory_stock_status').select('*', { count: 'exact', head: true }).in('stock_state', ['low', 'out'])
          : zero,
        hasNavKey(nav, 'inventory')
          ? supabase.from('inventory_replenishment_needs').select('id', { count: 'exact', head: true }).in('status', ['open', 'requested', 'sourcing', 'ordered', 'receiving'])
          : zero,
        hasNavKey(nav, 'procurement')
          ? supabase.from('procurement_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'pending_approval'])
          : zero,
        canApprove
          ? supabase.from('finance_approval_queue').select('total_amount,currency').eq('approval_status', 'ready')
          : Promise.resolve({ data: [], error: null }),
      ])

      const operationalError = arrivals7d.error
        || departures7d.error
        || openRequests.error
        || blockingExceptions.error
        || openTasks.error
        || blockedMaintenance.error
        || openIssues.error
        || criticalStock.error
        || replenishment.error
        || procurementPending.error
      if (operationalError) throw operationalError

      setHospitality(hasNavKey(nav, 'bookings') ? [
        { key: 'arrivals', label: 'Llegadas · 7 días', value: arrivals7d.count ?? 0, detail: 'Reservas con check-in en el horizonte', href: '/bookings' },
        { key: 'departures', label: 'Salidas · 7 días', value: departures7d.count ?? 0, detail: 'Reservas con check-out en el horizonte', href: '/bookings' },
        { key: 'requests', label: 'Solicitudes abiertas', value: openRequests.count ?? 0, detail: 'Hospitality todavía por resolver', href: '/bookings/requests', alert: (openRequests.count ?? 0) > 0 },
        { key: 'blockers', label: 'Bloqueos de estadía', value: blockingExceptions.count ?? 0, detail: 'Excepciones que bloquean check-in o check-out', href: '/bookings', alert: (blockingExceptions.count ?? 0) > 0 },
      ] : [])

      const nextWork: PictureSignal[] = []
      if (hasNavKey(nav, 'tasks')) nextWork.push({ key: 'tasks', label: 'Tareas abiertas', value: openTasks.count ?? 0, detail: 'Trabajo operativo aún no cerrado', href: '/tasks' })
      if (hasNavKey(nav, 'maintenance')) nextWork.push({ key: 'maintenance', label: 'Mantenimiento bloqueado', value: blockedMaintenance.count ?? 0, detail: 'Trabajo técnico que necesita destrabe', href: '/maintenance', alert: (blockedMaintenance.count ?? 0) > 0 })
      if (hasNavKey(nav, 'issues')) nextWork.push({ key: 'issues', label: 'Incidencias abiertas', value: openIssues.count ?? 0, detail: 'Hallazgos todavía sin resolver', href: '/issues', alert: (openIssues.count ?? 0) > 0 })
      setWork(nextWork)

      const nextSupply: PictureSignal[] = []
      if (hasNavKey(nav, 'inventory')) {
        nextSupply.push({ key: 'stock', label: 'Stock crítico', value: criticalStock.count ?? 0, detail: 'Posiciones bajo mínimo o sin stock', href: '/inventory/stock', alert: (criticalStock.count ?? 0) > 0 })
        nextSupply.push({ key: 'replenishment', label: 'Reposición en curso', value: replenishment.count ?? 0, detail: 'Necesidades abiertas hasta recepción', href: '/inventory/replenishment' })
      }
      if (hasNavKey(nav, 'procurement')) nextSupply.push({ key: 'procurement', label: 'Compras por decidir', value: procurementPending.count ?? 0, detail: 'Solicitudes enviadas o pendientes de aprobación', href: '/procurement', alert: (procurementPending.count ?? 0) > 0 })
      setSupply(nextSupply)

      if (canApprove && !financeRows.error) setFinance(financeTotals((financeRows.data ?? []) as FinanceApprovalRow[]))
      else setFinance(null)
    } catch (caught) {
      setHospitality([])
      setWork([])
      setSupply([])
      setFinance(null)
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar Panorama')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const attentionCount = useMemo(() => [...hospitality, ...work, ...supply].filter((signal) => signal.alert).reduce((sum, signal) => sum + signal.value, 0), [hospitality, supply, work])
  const visibleSections = useMemo(() => ({
    hospitality: hasNavKey(navigation ?? {}, 'bookings'),
    work: hasNavKey(navigation ?? {}, 'tasks') || hasNavKey(navigation ?? {}, 'maintenance') || hasNavKey(navigation ?? {}, 'issues'),
    supply: hasNavKey(navigation ?? {}, 'inventory') || hasNavKey(navigation ?? {}, 'procurement'),
  }), [navigation])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="overflow-hidden">
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="secondary">Panorama</Badge>{navigation?.role && <Badge variant="outline">{navigation.role}</Badge>}</div>
            <CardTitle className="text-2xl">Blackswan · Big Picture</CardTitle>
            <CardDescription className="mt-2">Estado real de la operación, decisiones y excepciones visibles para tu acceso. Sin scores sintéticos.</CardDescription>
          </div>
          {!loading && !error && (
            <div className="text-left md:text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Estado visible</p>
              <p className="mt-1 text-lg font-semibold">{attentionCount > 0 ? `${attentionCount} señales requieren atención` : 'Sin señales críticas visibles'}</p>
            </div>
          )}
        </CardHeader>
      </Card>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">No fue posible actualizar Panorama: {error}</div>}
      {loading && <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">Leyendo el estado canónico de la operación…</div>}

      {!loading && !error && <>
        {attentionCount === 0 && <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><span>No hay bloqueos, incidencias, stock crítico o decisiones pendientes visibles en las fuentes revisadas.</span></div>}

        <div className="grid gap-6 xl:grid-cols-2">
          {visibleSections.hospitality && <PictureSection title="Hospitality" icon={<BedDouble className="h-4 w-4" />} description="Carga próxima y fricción operativa de las estadías." signals={hospitality} />}
          {visibleSections.work && <PictureSection title="Trabajo" icon={<ClipboardList className="h-4 w-4" />} description="Backlog y bloqueos de ejecución en el campo." signals={work} />}
          {visibleSections.supply && <PictureSection title="Stock & Compras" icon={<ShoppingCart className="h-4 w-4" />} description="Necesidades que conectan stock, reposición y compra." signals={supply} />}
          {financeAllowed && <Card>
            <CardHeader><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" /><CardTitle className="text-base">Finanzas</CardTitle></div><CardDescription>Documentos que realmente están listos para tu decisión.</CardDescription></CardHeader>
            <CardContent>
              <Link href="/budgets/approvals" className="group block rounded-lg border p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-start justify-between gap-4"><div><p className="font-medium">Facturas por aprobar</p><p className="mt-1 text-xs text-muted-foreground">{finance ? formatFinanceTotals(finance.totals) : 'La cola financiera no pudo resumirse; abre la fuente canónica.'}</p></div><span className="text-3xl font-semibold tabular-nums">{finance?.count ?? '—'}</span></div>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">Revisar aprobaciones <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div>
              </Link>
            </CardContent>
          </Card>}
        </div>

        <section className="space-y-3 border-t pt-5">
          <div><h2 className="text-base font-semibold">Leer en profundidad</h2><p className="text-sm text-muted-foreground">Panorama resume; la decisión y la ejecución siguen viviendo en el objeto o flujo canónico.</p></div>
          <div className="flex flex-wrap gap-2">
            {navigation?.items?.filter((item) => ['bookings', 'tasks', 'maintenance', 'inventory', 'procurement', 'approvals'].includes(item.key)).slice(0, 7).map((item) => <Link key={item.key} href={item.href} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">{item.label}</Link>)}
          </div>
        </section>
      </>}
    </div>
  )
}

function PictureSection({ title, icon, description, signals }: { title: string; icon: ReactNode; description: string; signals: PictureSignal[] }) {
  return <Card><CardHeader><div className="flex items-center gap-2">{icon}<CardTitle className="text-base">{title}</CardTitle></div><CardDescription>{description}</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{signals.map((signal) => <Link key={signal.key} href={signal.href} className={`group rounded-lg border p-4 transition-colors hover:bg-muted/40 ${signal.alert ? 'border-amber-500/30 bg-amber-500/5' : ''}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{signal.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.detail}</p></div><span className="text-2xl font-semibold tabular-nums">{signal.value}</span></div><div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">Abrir <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div></Link>)}</CardContent></Card>
}
