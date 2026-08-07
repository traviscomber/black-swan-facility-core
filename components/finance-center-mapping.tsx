'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
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
      toast.success(`Mapeo guardado · ${result?.documents_updated ?? 0} documentos · ${result?.rules_promoted ?? 0} reglas promovidas.`)
      window.dispatchEvent(new Event('finance-workbook-imported'))
      await load()
    }
    setBusy(null)
  }

  const pending = centers.filter((row) => row.mapping_status !== 'mapped' || !row.category_id)
  if (!centers.length) return null

  return (
    <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] p-5 md:mx-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Puente hacia Budget</p>
          <h2 className="mt-2 text-lg font-normal text-[var(--bs-text-primary)]">Mapear centros históricos con documentos abiertos</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--bs-text-secondary)]">El prefijo del centro permite recuperar el P&L cuando es inequívoco. La categoría Budget se confirma aquí antes de habilitar la aprobación y promover la regla recurrente.</p>
        </div>
        <p className="text-xs text-[var(--bs-text-muted)]">Pendientes · {pending.length}</p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]"><tr><th className="py-3 pr-4 font-normal">Centro histórico</th><th className="py-3 pr-4 font-normal">Docs / reglas</th><th className="py-3 pr-4 font-normal">Centro P&L</th><th className="py-3 pr-4 font-normal">Categoría Budget</th><th className="py-3 text-right font-normal">Estado</th></tr></thead>
          <tbody>
            {centers.map((row) => {
              const choice = draft[row.id] ?? { division: row.division_id ?? '', category: row.category_id ?? '' }
              const availableCategories = categories.filter((category) => category.division_id === choice.division)
              const mapped = row.mapping_status === 'mapped' && Boolean(row.category_id)
              return <tr key={row.id} className="border-t border-[var(--bs-divider-subtle)]">
                <td className="py-4 pr-4"><p className="text-[var(--bs-text-primary)]">{row.historical_label}</p><p className="mt-1 text-xs text-[var(--bs-text-muted)]">Frecuencia histórica {row.header_frequency}</p></td>
                <td className="py-4 pr-4 text-[var(--bs-text-secondary)]">{row.open_document_count} / {row.historical_rule_count}</td>
                <td className="py-4 pr-4"><select value={choice.division} onChange={(e) => setDraft((current) => ({ ...current, [row.id]: { division: e.target.value, category: '' } }))} className="h-10 min-w-48 bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)]"><option value="">Seleccionar</option>{divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></td>
                <td className="py-4 pr-4"><select value={choice.category} disabled={!choice.division} onChange={(e) => setDraft((current) => ({ ...current, [row.id]: { ...choice, category: e.target.value } }))} className="h-10 min-w-64 bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)] disabled:opacity-40"><option value="">Seleccionar categoría</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></td>
                <td className="py-4 text-right">{mapped ? <span className="inline-flex items-center gap-2 text-xs text-[var(--bs-cool-sage)]"><CheckCircle2 className="h-4 w-4" />Mapeado</span> : <Button size="sm" onClick={() => void save(row)} disabled={busy === row.id || !choice.division || !choice.category}>Confirmar<ArrowRight className="ml-2 h-4 w-4" /></Button>}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
