'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CircleDollarSign, GitCompareArrows, Layers3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

type RouteRow = {
  category_key: string
  primary_route: string
  primary_label: string
  secondary_routes: string[]
  operational_owner: string | null
  description: string | null
}

type ReconciliationRow = {
  budget_id: string
  division_name: string
  division_key: string | null
  category_name: string
  category_key: string | null
  year: number
  month: number
  plan_amount: number
  excel_actual_amount: number
  operational_actual_amount: number
  reconciliation_difference: number
  posted_count: number
  pending_count: number
  primary_route: string | null
  primary_label: string | null
  operational_owner: string | null
}

function n(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function BudgetFinancialMap() {
  const supabase = useMemo(() => createClient(), [])
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [routes, setRoutes] = useState<RouteRow[]>([])
  const [rows, setRows] = useState<ReconciliationRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [routeResult, reconciliationResult] = await Promise.all([
      supabase.from('budget_module_routes').select('category_key,primary_route,primary_label,secondary_routes,operational_owner,description').order('primary_label'),
      supabase.from('budget_actual_reconciliation').select('*').eq('year', year).eq('month', month).order('division_name').order('category_name'),
    ])
    if (!routeResult.error) setRoutes((routeResult.data ?? []) as RouteRow[])
    if (!reconciliationResult.error) setRows((reconciliationResult.data ?? []) as ReconciliationRow[])
    setLoading(false)
  }, [month, supabase, year])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('budget-financial-map-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_postings' }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  const summary = useMemo(() => rows.reduce((acc, row) => {
    acc.plan += n(row.plan_amount)
    acc.excel += n(row.excel_actual_amount)
    acc.operational += n(row.operational_actual_amount)
    acc.pending += n(row.pending_count)
    return acc
  }, { plan: 0, excel: 0, operational: 0, pending: 0 }), [rows])

  return (
    <section className="mx-4 mb-8 md:mx-8">
      <div className="bg-[var(--bs-surface-primary)] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Mapa financiero operacional</p>
            <h2 className="mt-2 text-xl text-[var(--bs-text-primary)]">Cada número del Budget tiene un módulo de origen</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--bs-text-secondary)]">
              El Excel sigue siendo la referencia presupuestaria importada. La operación genera movimientos financieros separados; aquí se comparan antes de reemplazar o conciliar el Actual del Excel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-10 bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)]">
              {[year - 1, year, year + 1].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="h-10 bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)]">
              {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Plan Excel</p><p className="mt-2 text-lg">{money.format(summary.plan)}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Actual Excel</p><p className="mt-2 text-lg">{money.format(summary.excel)}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Actual operacional validado</p><p className="mt-2 text-lg">{money.format(summary.operational)}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Pendientes de posteo</p><p className="mt-2 text-lg">{summary.pending}</p></div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">
              <tr>
                <th className="py-3 pr-4 font-normal">Centro P&L</th>
                <th className="py-3 pr-4 font-normal">Categoría</th>
                <th className="py-3 text-right font-normal">Actual Excel</th>
                <th className="py-3 text-right font-normal">Operacional</th>
                <th className="py-3 text-right font-normal">Diferencia</th>
                <th className="py-3 text-center font-normal">Mov.</th>
                <th className="py-3 pl-5 font-normal">Dónde se trabaja</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const difference = n(row.reconciliation_difference)
                const hasDifference = Math.abs(difference) > 0.005
                return (
                  <tr key={row.budget_id} className="border-t border-[var(--bs-divider-subtle)]">
                    <td className="py-4 pr-4 text-[var(--bs-text-primary)]">{row.division_name}</td>
                    <td className="py-4 pr-4 text-[var(--bs-text-secondary)]">{row.category_name}</td>
                    <td className="py-4 text-right text-[var(--bs-text-primary)]">{money.format(n(row.excel_actual_amount))}</td>
                    <td className="py-4 text-right text-[var(--bs-text-primary)]">{money.format(n(row.operational_actual_amount))}</td>
                    <td className={`py-4 text-right ${hasDifference ? 'text-[var(--bs-warm-orange)]' : 'text-[var(--bs-cool-sage)]'}`}>{money.format(difference)}</td>
                    <td className="py-4 text-center text-[var(--bs-text-secondary)]">{n(row.posted_count)}{n(row.pending_count) > 0 && <span className="ml-1 text-[var(--bs-warm-yellow)]">+{n(row.pending_count)}</span>}</td>
                    <td className="py-4 pl-5">
                      {row.primary_route ? (
                        <Button asChild variant="outline" size="sm"><Link href={row.primary_route}>{row.primary_label ?? 'Abrir módulo'}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                      ) : <span className="text-xs text-[var(--bs-text-muted)]">Sin ruta definida</span>}
                    </td>
                  </tr>
                )
              })}
              {!loading && !rows.length && <tr><td colSpan={7} className="py-10 text-center text-[var(--bs-text-muted)]">No hay líneas de Budget para este periodo. Importa el Excel maestro o cambia el periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {routes.map((route) => (
          <div key={route.category_key} className="bg-[var(--bs-surface-primary)] p-4">
            <div className="flex items-center gap-2 text-[var(--bs-text-primary)]">
              {route.category_key === 'income' ? <CircleDollarSign className="h-4 w-4 text-[var(--bs-cool-sage)]" /> : route.category_key.includes('investment') ? <Layers3 className="h-4 w-4 text-[var(--bs-cool-sky)]" /> : <GitCompareArrows className="h-4 w-4 text-[var(--bs-warm-yellow)]" />}
              <span className="text-sm">{route.primary_label}</span>
            </div>
            <p className="mt-3 min-h-12 text-xs leading-5 text-[var(--bs-text-secondary)]">{route.description}</p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--bs-text-muted)]">Responsable · {route.operational_owner ?? 'Por definir'}</p>
            <Button asChild variant="ghost" size="sm" className="mt-3 px-0"><Link href={route.primary_route}>Abrir módulo<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        ))}
      </div>
    </section>
  )
}
