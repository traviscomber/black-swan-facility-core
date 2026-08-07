'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, RefreshCw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type AliasStatus = 'proposed' | 'approved' | 'rejected'
type AliasKind = 'format_normalization' | 'manual_candidate'
type AliasRow = {
  id: string
  status: AliasStatus
  proposal_kind: AliasKind
  confidence: number | string
  proposal_reason: string
  review_note: string | null
  reviewed_at: string | null
  source_label: string
  source_operational_label: string | null
  source_frequency: number
  source_mapping_status: string
  source_division_name: string | null
  source_category_name: string | null
  canonical_label: string
  canonical_operational_label: string | null
  canonical_frequency: number
  canonical_mapping_status: string
  canonical_division_name: string | null
  canonical_category_name: string | null
}

function kindLabel(kind: AliasKind) {
  return kind === 'format_normalization' ? 'Formato idéntico' : 'Candidato semántico'
}

export function FinanceHistoricalAliasReview() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<AliasRow[]>([])
  const [canReview, setCanReview] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [aliasResult, permissionResult] = await Promise.all([
      supabase.from('finance_historical_alias_queue').select('*').order('status').order('proposal_kind').order('source_label'),
      supabase.rpc('can_finance_review_ambiguous'),
    ])
    if (aliasResult.error || permissionResult.error) {
      toast.error(aliasResult.error?.message || permissionResult.error?.message || 'No fue posible cargar los alias históricos.')
    } else {
      setRows((aliasResult.data ?? []) as AliasRow[])
      setCanReview(Boolean(permissionResult.data))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const handler = () => void load()
    window.addEventListener('finance-workbook-imported', handler)
    return () => window.removeEventListener('finance-workbook-imported', handler)
  }, [load])

  async function refreshProposals() {
    if (!canReview) return
    setBusy('refresh')
    const { data, error } = await supabase.rpc('refresh_finance_historical_alias_proposals')
    if (error) toast.error(error.message)
    else {
      const result = data as { inserted?: number; format_inserted?: number; manual_inserted?: number } | null
      toast.success(`${result?.inserted ?? 0} nuevas sugerencias · ${result?.format_inserted ?? 0} de formato · ${result?.manual_inserted ?? 0} para revisar.`)
      await load()
    }
    setBusy(null)
  }

  async function review(row: AliasRow, decision: 'approved' | 'rejected') {
    if (!canReview) return
    const note = decision === 'rejected'
      ? window.prompt(`Motivo para no consolidar ${row.source_label}`)
      : null
    if (decision === 'rejected' && note === null) return

    setBusy(row.id)
    const { error } = await supabase.rpc('review_finance_historical_alias', {
      p_alias_id: row.id,
      p_decision: decision,
      p_note: note?.trim() || null,
    })
    if (error) toast.error(error.message)
    else {
      toast.success(decision === 'approved' ? 'Alias aprobado. La etiqueta histórica original se conserva.' : 'Sugerencia descartada.')
      window.dispatchEvent(new Event('finance-workbook-imported'))
      await load()
    }
    setBusy(null)
  }

  const counts = useMemo(() => rows.reduce<{ proposed: number; approved: number; rejected: number; format: number; manual: number }>((acc, row) => {
    acc[row.status] += 1
    if (row.status === 'proposed') {
      if (row.proposal_kind === 'format_normalization') acc.format += 1
      else acc.manual += 1
    }
    return acc
  }, { proposed: 0, approved: 0, rejected: 0, format: 0, manual: 0 }), [rows])

  const normalizedQuery = query.trim().toLocaleLowerCase('es')
  const visibleRows = rows.filter((row) => {
    if (!showResolved && row.status !== 'proposed') return false
    if (!normalizedQuery) return true
    return `${row.source_label} ${row.canonical_label} ${row.source_operational_label ?? ''} ${row.canonical_operational_label ?? ''}`
      .toLocaleLowerCase('es')
      .includes(normalizedQuery)
  })

  if (!loading && rows.length === 0) return null

  return (
    <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] md:mx-8">
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-cool-sky)]">Normalización histórica</p>
            <h2 className="mt-2 font-normal text-[var(--bs-text-primary)]">Alias propuestos sin modificar la fuente</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">
              Las diferencias puramente formales se detectan de forma determinística. Las variantes de palabras, abreviaturas o nombres históricos se muestran como candidatos y siempre requieren decisión de Raimundo. Ninguna etiqueta original se renombra, borra o fusiona automáticamente.
            </p>
          </div>
          <div className="text-right text-xs text-[var(--bs-text-secondary)]">
            <p><span className="text-[var(--bs-warm-yellow)]">{counts.proposed}</span> pendientes · {counts.format} formato · {counts.manual} revisión · <span className="text-[var(--bs-cool-sage)]">{counts.approved}</span> aprobados</p>
            {canReview && <Button className="mt-3" variant="outline" onClick={() => void refreshProposals()} disabled={busy === 'refresh'}><RefreshCw className={`mr-2 h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />Buscar nuevas variantes</Button>}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--bs-text-muted)]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar etiqueta o detalle operacional" className="h-10 w-full bg-[var(--bs-surface-secondary)] pl-10 pr-3 text-sm text-[var(--bs-text-primary)] outline-none placeholder:text-[var(--bs-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--bs-cool-sky)]" />
          </div>
          <button type="button" onClick={() => setShowResolved((value) => !value)} className="min-h-10 px-3 text-xs text-[var(--bs-text-secondary)] hover:text-[var(--bs-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bs-cool-sky)]">
            {showResolved ? 'Mostrar solo pendientes' : `Ver resueltos (${counts.approved + counts.rejected})`}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-[var(--bs-surface-secondary)] text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">
            <tr><th className="px-5 py-3 font-normal">Etiqueta original</th><th className="px-5 py-3 font-normal">Alias canónico propuesto</th><th className="px-5 py-3 font-normal">Evidencia</th><th className="px-5 py-3 font-normal">Estado</th><th className="px-5 py-3 text-right font-normal">Decisión</th></tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => <tr key={row.id} className={`${index % 2 ? 'bg-[var(--bs-surface-secondary)]/40' : 'bg-[var(--bs-surface-primary)]'} align-top`}>
              <td className="px-5 py-4"><p className="text-[var(--bs-text-primary)]">{row.source_label}</p><p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.source_frequency} apariciones · {row.source_mapping_status}</p>{row.source_operational_label && <p className="mt-2 text-xs text-[var(--bs-text-secondary)]">Detalle: {row.source_operational_label}</p>}</td>
              <td className="px-5 py-4"><p className="text-[var(--bs-text-primary)]">{row.canonical_label}</p><p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.canonical_division_name ?? 'P&L pendiente'}{row.canonical_category_name ? ` · ${row.canonical_category_name}` : ''}</p>{row.canonical_operational_label && <p className="mt-2 text-xs text-[var(--bs-text-secondary)]">Detalle: {row.canonical_operational_label}</p>}</td>
              <td className="px-5 py-4"><p className={row.proposal_kind === 'format_normalization' ? 'text-xs text-[var(--bs-cool-sage)]' : 'text-xs text-[var(--bs-warm-yellow)]'}>{kindLabel(row.proposal_kind)} · {Math.round(Number(row.confidence) * 100)}%</p><p className="mt-2 max-w-80 text-xs leading-5 text-[var(--bs-text-secondary)]">{row.proposal_reason}</p></td>
              <td className="px-5 py-4"><span className={row.status === 'proposed' ? 'text-[var(--bs-warm-yellow)]' : row.status === 'approved' ? 'text-[var(--bs-cool-sage)]' : 'text-[var(--bs-text-muted)]'}>{row.status === 'proposed' ? 'Pendiente de Raimundo' : row.status === 'approved' ? 'Alias aprobado' : 'Descartado'}</span>{row.review_note && <p className="mt-2 max-w-64 text-xs text-[var(--bs-text-secondary)]">{row.review_note}</p>}</td>
              <td className="px-5 py-4 text-right">{row.status === 'proposed' ? <div className="flex justify-end gap-2"><Button size="sm" onClick={() => void review(row, 'approved')} disabled={!canReview || busy === row.id}><Check className="mr-2 h-4 w-4" />Aceptar alias</Button><Button size="sm" variant="outline" onClick={() => void review(row, 'rejected')} disabled={!canReview || busy === row.id}><X className="mr-2 h-4 w-4" />Descartar</Button></div> : <span className="text-xs text-[var(--bs-text-muted)]">Sin cambios a la etiqueta original</span>}</td>
            </tr>)}
            {!loading && visibleRows.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-[var(--bs-text-muted)]">No hay alias pendientes con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
