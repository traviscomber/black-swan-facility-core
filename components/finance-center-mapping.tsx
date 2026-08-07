'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type CenterRow = {
  id: string
  historical_label: string
  header_frequency: number
  division_id: string | null
  division_name: string | null
  category_id: string | null
  category_name: string | null
  mapping_status: string
  open_document_count: number
  historical_rule_count: number
}
type Division = { id: string; name: string; source_key: string | null; is_aggregate: boolean }
type Category = { id: string; division_id: string; name: string; source_key: string | null }

export function FinanceCenterMapping() {
  const supabase = useMemo(() => createClient(), [])
  const [centers, setCenters] = useState<CenterRow[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, { division: string; category: string }>>({})
  const [query, setQuery] = useState('')
  const [showMapped, setShowMapped] = useState(false)

  const load = useCallback(async () => {
    const [centerResult, divisionResult, categoryResult] = await Promise.all([
      supabase.from('finance_center_mapping_queue').select('*').gt('open_document_count', 0).order('open_document_count', { ascending: false }).order('header_frequency', { ascending: false }),
      supabase.from('budget_divisions').select('id,name,source_key,is_aggregate').eq('is_active', true).eq('is_aggregate', false).order('sort_order'),
      supabase.from('budget_categories').select('id,division_id,name,source_key').eq('is_active', true).order('sort_order'),
    ])
    if (centerResult.error || divisionResult.error || categoryResult.error) {
      toast.error(centerResult.error?.message || divisionResult.error?.message || categoryResult.error?.message || 'No fue posible cargar los mapeos.')
      return
    }
    const rows = (centerResult.data ?? []) as CenterRow[]
    setCenters(rows)
    setDivisions((divisionResult.data ?? []) as Division[])
    setCategories((categoryResult.data ?? []) as Category[])
    setDraft((current) => {
      const next = { ...current }
      for (const row of rows) if (!next[row.id]) next[row.id] = { division: row.division_id ?? '', category: row.category_id ?? '' }
      return next
    })
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const handler = () => void load()
    window.addEventListener('finance-workbook-imported', handler)
    return () => window.removeEventListener('finance-workbook-imported', handler)
  }, [load])

  async function save(row: CenterRow) {
    const choice = draft[row.id]
    if (!choice?.division || !choice.category) return
    setBusy(row.id)
    const { data, error } = await supabase.rpc('map_finance_historical_center', {
      p_center_id: row.id,
      p_division_id: choice.division,
      p_category_id: choice.category,
      p_note: 'Mapeo validado desde bandeja financiera',
    })
    if (error) toast.error(error.message)
    else {
      const result = data as { documents_updated?: number; rules_promoted?: number } | null
      toast.success(`Mapeo guardado · ${result?.documents_updated ?? 0} documentos actualizados.`)
      window.dispatchEvent(new Event('finance-workbook-imported'))
      await load()
    }
    setBusy(null)
  }

  const pending = centers.filter((row) => row.mapping_status !== 'mapped' || !row.category_id)
  const mapped = centers.length - pending.length
  const progress = centers.length ? Math.round((mapped / centers.length) * 100) : 100
  const normalizedQuery = query.trim().toLocaleLowerCase('es')
  const visibleRows = centers.filter((row) => {
    const isMapped = row.mapping_status === 'mapped' && Boolean(row.category_id)
    if (!showMapped && isMapped) return false
    if (!normalizedQuery) return true
    return `${row.historical_label} ${row.division_name ?? ''} ${row.category_name ?? ''}`.toLocaleLowerCase('es').includes(normalizedQuery)
  })

  if (!centers.length) return null

  return (
    <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] md:mx-8">
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Paso 1 · Clasificar</p>
            <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Confirmar dónde cae cada centro histórico</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">El P&L se completa automáticamente cuando el prefijo es inequívoco. Solo falta confirmar la categoría Budget. Hasta entonces ningún documento puede aprobarse ni afectar el Budget.</p>
          </div>
          <div className="min-w-56 text-right">
            <p className="text-xs text-[var(--bs-text-muted)]">{mapped} de {centers.length} centros listos</p>
            <div className="mt-2 h-2 bg-[var(--bs-surface-secondary)]"><div className="h-full bg-[var(--bs-cool-sage)] transition-all" style={{ width: `${progress}%` }} /></div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--bs-text-muted)]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar centro histórico" className="h-10 w-full bg-[var(--bs-surface-secondary)] pl-10 pr-3 text-sm text-[var(--bs-text-primary)] outline-none placeholder:text-[var(--bs-text-muted)]" />
          </div>
          <button type="button" onClick={() => setShowMapped((value) => !value)} className="text-xs text-[var(--bs-text-secondary)] hover:text-[var(--bs-text-primary)]">{showMapped ? 'Ocultar mapeados' : `Ver mapeados (${mapped})`}</button>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-[var(--bs-divider-subtle)]">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">
            <tr><th className="px-5 py-3 font-normal">Centro histórico</th><th className="px-5 py-3 font-normal">Uso</th><th className="px-5 py-3 font-normal">P&L</th><th className="px-5 py-3 font-normal">Categoría Budget</th><th className="px-5 py-3 text-right font-normal">Acción</th></tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const choice = draft[row.id] ?? { division: row.division_id ?? '', category: row.category_id ?? '' }
              const availableCategories = categories.filter((category) => category.division_id === choice.division)
              const isMapped = row.mapping_status === 'mapped' && Boolean(row.category_id)
              return (
                <tr key={row.id} className="border-t border-[var(--bs-divider-subtle)] align-middle">
                  <td className="px-5 py-4"><p className="text-[var(--bs-text-primary)]">{row.historical_label}</p><p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.header_frequency} apariciones históricas</p></td>
                  <td className="px-5 py-4"><p className="text-[var(--bs-text-primary)]">{row.open_document_count} doc{row.open_document_count === 1 ? '' : 's'} abierto{row.open_document_count === 1 ? '' : 's'}</p>{row.historical_rule_count > 0 && <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.historical_rule_count} regla{row.historical_rule_count === 1 ? '' : 's'} recurrente{row.historical_rule_count === 1 ? '' : 's'}</p>}</td>
                  <td className="px-5 py-4"><select value={choice.division} onChange={(event) => setDraft((current) => ({ ...current, [row.id]: { division: event.target.value, category: '' } }))} className="h-10 min-w-48 bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)]"><option value="">Seleccionar P&L</option>{divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></td>
                  <td className="px-5 py-4"><select value={choice.category} disabled={!choice.division} onChange={(event) => setDraft((current) => ({ ...current, [row.id]: { ...choice, category: event.target.value } }))} className="h-10 min-w-64 bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)] disabled:opacity-40"><option value="">Seleccionar categoría</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></td>
                  <td className="px-5 py-4 text-right">{isMapped ? <span className="inline-flex items-center gap-2 text-xs text-[var(--bs-cool-sage)]"><CheckCircle2 className="h-4 w-4" />Listo</span> : <Button size="sm" onClick={() => void save(row)} disabled={busy === row.id || !choice.division || !choice.category}>{busy === row.id ? 'Guardando…' : 'Confirmar'}</Button>}</td>
                </tr>
              )
            })}
            {!visibleRows.length && <tr><td colSpan={5} className="px-5 py-10 text-center text-[var(--bs-text-muted)]">No hay centros pendientes con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
