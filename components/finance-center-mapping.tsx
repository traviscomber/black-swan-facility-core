'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Search, ShieldCheck } from 'lucide-react'
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
type Category = { id: string; division_id: string; name: string; source_key: string | null; category_role: string | null }
type PendingDocument = {
  id: string
  supplier_name: string
  document_number: string
  total_amount: number | string
  currency: string
  classification_status: string
  classification_reason: string | null
  historical_count: number | null
  historical_dominance: number | string | null
  accepted_min: number | string | null
  accepted_max: number | string | null
  amount_in_range: boolean | null
  source_payload: { historical_cost_center?: string } | null
}

function n(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: unknown, currency: string) {
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'CLP' ? 0 : 2,
    }).format(n(value))
  } catch {
    return `${n(value).toLocaleString('es-CL')} ${currency}`
  }
}

export function FinanceCenterMapping() {
  const supabase = useMemo(() => createClient(), [])
  const [centers, setCenters] = useState<CenterRow[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [documents, setDocuments] = useState<PendingDocument[]>([])
  const [canReview, setCanReview] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, { division: string; category: string }>>({})
  const [query, setQuery] = useState('')
  const [showMapped, setShowMapped] = useState(false)

  const load = useCallback(async () => {
    const [centerResult, divisionResult, categoryResult, documentResult, permissionResult] = await Promise.all([
      supabase.from('finance_center_mapping_queue').select('*').gt('open_document_count', 0).order('open_document_count', { ascending: false }).order('header_frequency', { ascending: false }),
      supabase.from('budget_divisions').select('id,name,source_key,is_aggregate').eq('is_active', true).eq('is_aggregate', false).not('source_key', 'is', null).order('sort_order'),
      supabase.from('budget_categories').select('id,division_id,name,source_key,category_role').eq('is_active', true).not('source_key', 'is', null).eq('category_role', 'cost').order('sort_order'),
      supabase.from('finance_documents').select('id,supplier_name,document_number,total_amount,currency,classification_status,classification_reason,historical_count,historical_dominance,accepted_min,accepted_max,amount_in_range,source_payload').eq('approval_status', 'pending_mapping'),
      supabase.rpc('can_finance_review_ambiguous'),
    ])
    if (centerResult.error || divisionResult.error || categoryResult.error || documentResult.error || permissionResult.error) {
      toast.error(centerResult.error?.message || divisionResult.error?.message || categoryResult.error?.message || documentResult.error?.message || permissionResult.error?.message || 'No fue posible cargar la revisión financiera.')
      return
    }
    const rows = (centerResult.data ?? []) as CenterRow[]
    setCenters(rows)
    setDivisions((divisionResult.data ?? []) as Division[])
    setCategories((categoryResult.data ?? []) as Category[])
    setDocuments((documentResult.data ?? []) as PendingDocument[])
    setCanReview(Boolean(permissionResult.data))
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

  const documentsByCenter = useMemo(() => {
    const grouped = new Map<string, PendingDocument[]>()
    for (const document of documents) {
      const label = document.source_payload?.historical_cost_center
      if (!label) continue
      const current = grouped.get(label) ?? []
      current.push(document)
      grouped.set(label, current)
    }
    return grouped
  }, [documents])

  async function save(row: CenterRow) {
    if (!canReview) {
      toast.error('Los centros ambiguos deben ser confirmados por Raimundo.')
      return
    }
    const choice = draft[row.id]
    if (!choice?.division || !choice.category) return
    setBusy(row.id)
    const { data, error } = await supabase.rpc('map_finance_historical_center', {
      p_center_id: row.id,
      p_division_id: choice.division,
      p_category_id: choice.category,
      p_note: 'Clasificación ambigua confirmada por Raimundo desde la bandeja financiera',
    })
    if (error) toast.error(error.message)
    else {
      const result = data as { documents_updated?: number; rules_promoted?: number } | null
      toast.success(`Decisión guardada · ${result?.documents_updated ?? 0} documentos listos · ${result?.rules_promoted ?? 0} reglas actualizadas.`)
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
    const evidence = (documentsByCenter.get(row.historical_label) ?? []).map((item) => `${item.supplier_name} ${item.document_number}`).join(' ')
    return `${row.historical_label} ${row.division_name ?? ''} ${row.category_name ?? ''} ${evidence}`.toLocaleLowerCase('es').includes(normalizedQuery)
  })

  if (!centers.length) return null

  return (
    <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] md:mx-8">
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Paso 1 · Revisión de Raimundo</p>
            <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Resolver únicamente las clasificaciones que el histórico no puede cerrar</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">El sistema conserva la evidencia histórica y propone el P&L cuando existe. Raimundo confirma la categoría Budget en los casos ambiguos. Esa decisión deja el documento listo y se reutiliza como regla cuando corresponde.</p>
          </div>
          <div className="min-w-64">
            <div className="flex items-center justify-end gap-2 text-xs text-[var(--bs-text-secondary)]">
              <ShieldCheck className={`h-4 w-4 ${canReview ? 'text-[var(--bs-cool-sage)]' : 'text-[var(--bs-text-muted)]'}`} />
              {canReview ? 'Sesión habilitada para revisar' : 'Solo Raimundo puede confirmar'}
            </div>
            <p className="mt-3 text-right text-xs text-[var(--bs-text-muted)]">{mapped} de {centers.length} centros activos resueltos</p>
            <div className="mt-2 h-2 bg-[var(--bs-surface-secondary)]"><div className="h-full bg-[var(--bs-cool-sage)] transition-all" style={{ width: `${progress}%` }} /></div>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-md"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--bs-text-muted)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar centro, proveedor o documento" className="h-10 w-full bg-[var(--bs-surface-secondary)] pl-10 pr-3 text-sm text-[var(--bs-text-primary)] outline-none placeholder:text-[var(--bs-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--bs-cool-sky)]" /></div>
          <button type="button" onClick={() => setShowMapped((value) => !value)} className="min-h-10 px-3 text-xs text-[var(--bs-text-secondary)] hover:text-[var(--bs-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bs-cool-sky)]">{showMapped ? 'Ocultar resueltos' : `Ver resueltos (${mapped})`}</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-[var(--bs-surface-secondary)] text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]"><tr><th className="px-5 py-3 font-normal">Centro histórico</th><th className="px-5 py-3 font-normal">Evidencia activa</th><th className="px-5 py-3 font-normal">P&L</th><th className="px-5 py-3 font-normal">Categoría Budget</th><th className="px-5 py-3 text-right font-normal">Decisión</th></tr></thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const choice = draft[row.id] ?? { division: row.division_id ?? '', category: row.category_id ?? '' }
              const availableCategories = categories.filter((category) => category.division_id === choice.division)
              const isMapped = row.mapping_status === 'mapped' && Boolean(row.category_id)
              const evidence = documentsByCenter.get(row.historical_label) ?? []
              const firstEvidence = evidence.slice(0, 3)
              return <tr key={row.id} className={`${index % 2 ? 'bg-[var(--bs-surface-secondary)]/40' : 'bg-[var(--bs-surface-primary)]'} align-top`}>
                <td className="px-5 py-4"><p className="text-[var(--bs-text-primary)]">{row.historical_label}</p><p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.header_frequency} apariciones históricas · {row.open_document_count} doc{row.open_document_count === 1 ? '' : 's'} abierto{row.open_document_count === 1 ? '' : 's'}</p>{row.historical_rule_count > 0 && <p className="mt-1 text-xs text-[var(--bs-cool-sage)]">{row.historical_rule_count} regla{row.historical_rule_count === 1 ? '' : 's'} recurrente{row.historical_rule_count === 1 ? '' : 's'}</p>}</td>
                <td className="px-5 py-4">
                  <div className="space-y-3">
                    {firstEvidence.map((document) => <div key={document.id}>
                      <div className="flex items-start justify-between gap-4"><div><p className="max-w-64 text-xs text-[var(--bs-text-primary)]">{document.supplier_name}</p><p className="mt-1 text-[11px] text-[var(--bs-text-muted)]">{document.document_number} · {document.classification_status === 'ready' ? 'historial consistente' : document.classification_status === 'exception' ? 'excepción' : 'revisión manual'}</p></div><p className="shrink-0 text-xs text-[var(--bs-text-primary)]">{formatMoney(document.total_amount, document.currency)}</p></div>
                      {document.classification_reason && <p className="mt-1 max-w-80 text-[11px] leading-4 text-[var(--bs-text-secondary)]">{document.classification_reason}</p>}
                    </div>)}
                    {evidence.length > 3 && <p className="text-[11px] text-[var(--bs-text-muted)]">+{evidence.length - 3} documentos adicionales</p>}
                  </div>
                </td>
                <td className="px-5 py-4"><select value={choice.division} disabled={isMapped || !canReview} onChange={(event) => setDraft((current) => ({ ...current, [row.id]: { division: event.target.value, category: '' } }))} className="h-10 min-w-48 bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bs-cool-sky)]"><option value="">Seleccionar P&L</option>{divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></td>
                <td className="px-5 py-4"><select value={choice.category} disabled={isMapped || !canReview || !choice.division} onChange={(event) => setDraft((current) => ({ ...current, [row.id]: { ...choice, category: event.target.value } }))} className="h-10 min-w-64 bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bs-cool-sky)]"><option value="">Seleccionar categoría de costo</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></td>
                <td className="px-5 py-4 text-right">{isMapped ? <span className="inline-flex min-h-10 items-center gap-2 text-xs text-[var(--bs-cool-sage)]"><CheckCircle2 className="h-4 w-4" />Resuelto</span> : <Button size="sm" onClick={() => void save(row)} disabled={!canReview || busy === row.id || !choice.division || !choice.category}>{busy === row.id ? 'Guardando…' : 'Confirmar clasificación'}</Button>}</td>
              </tr>
            })}
            {!visibleRows.length && <tr><td colSpan={5} className="px-5 py-10 text-center text-[var(--bs-text-muted)]">No hay centros pendientes con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
