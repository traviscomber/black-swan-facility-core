'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type Center = {
  id: string
  historical_label: string
  operational_label: string | null
  division_id: string | null
  division_name: string | null
  category_id: string | null
  category_name: string | null
  mapping_status: string
  open_document_count: number
}

type Division = { id: string; name: string }
type Category = { id: string; division_id: string; name: string }
type Document = {
  id: string
  supplier_name: string
  document_number: string
  description: string | null
  total_amount: number | string
  currency: string
  source_payload: { historical_cost_center?: string } | null
}

type Choice = { division: string; category: string }

function money(value: unknown, currency: string) {
  const amount = Number(value ?? 0)
  try {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: currency === 'CLP' ? 0 : 2 }).format(amount)
  } catch {
    return `${amount.toLocaleString('es-CL')} ${currency}`
  }
}

export function RaimundoReviewInbox() {
  const supabase = useMemo(() => createClient(), [])
  const [centers, setCenters] = useState<Center[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [choice, setChoice] = useState<Record<string, Choice>>({})
  const [index, setIndex] = useState(0)
  const [editing, setEditing] = useState(false)
  const [canReview, setCanReview] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [centerResult, divisionResult, categoryResult, documentResult, permissionResult] = await Promise.all([
      supabase.from('finance_center_mapping_queue').select('*').gt('open_document_count', 0).order('open_document_count', { ascending: false }),
      supabase.from('budget_divisions').select('id,name').eq('is_active', true).eq('is_aggregate', false).not('source_key', 'is', null).order('sort_order'),
      supabase.from('budget_categories').select('id,division_id,name').eq('is_active', true).not('source_key', 'is', null).eq('category_role', 'cost').order('sort_order'),
      supabase.from('finance_documents').select('id,supplier_name,document_number,description,total_amount,currency,source_payload').eq('approval_status', 'pending_mapping'),
      supabase.rpc('can_finance_review_ambiguous'),
    ])

    const error = centerResult.error || divisionResult.error || categoryResult.error || documentResult.error || permissionResult.error
    if (error) {
      toast.error(error.message)
      return
    }

    const pending = ((centerResult.data ?? []) as Center[]).filter((row) => row.mapping_status !== 'mapped' || !row.category_id)
    pending.sort((a, b) => Number(Boolean(b.division_id)) - Number(Boolean(a.division_id)) || b.open_document_count - a.open_document_count)
    setCenters(pending)
    setDivisions((divisionResult.data ?? []) as Division[])
    setCategories((categoryResult.data ?? []) as Category[])
    setDocuments((documentResult.data ?? []) as Document[])
    setCanReview(Boolean(permissionResult.data))
    setChoice((current) => {
      const next = { ...current }
      for (const row of pending) if (!next[row.id]) next[row.id] = { division: row.division_id ?? '', category: row.category_id ?? '' }
      return next
    })
    setIndex((current) => Math.min(current, Math.max(0, pending.length - 1)))
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const handler = () => void load()
    window.addEventListener('finance-workbook-imported', handler)
    return () => window.removeEventListener('finance-workbook-imported', handler)
  }, [load])

  const row = centers[index]
  const selected = row ? (choice[row.id] ?? { division: row.division_id ?? '', category: row.category_id ?? '' }) : null
  const selectedDivision = row?.division_id ?? selected?.division ?? ''
  const availableCategories = categories.filter((category) => category.division_id === selectedDivision)
  const evidence = row ? documents.filter((document) => document.source_payload?.historical_cost_center === row.historical_label) : []
  const ready = Boolean(selectedDivision && selected?.category)

  async function confirm() {
    if (!row || !selected || !ready || !canReview) return
    setBusy(true)
    const { data, error } = await supabase.rpc('map_finance_historical_center', {
      p_center_id: row.id,
      p_division_id: selectedDivision,
      p_category_id: selected.category,
      p_note: 'Clasificación confirmada por Raimundo desde la bandeja simplificada',
    })
    if (error) toast.error(error.message)
    else {
      const result = data as { documents_updated?: number } | null
      toast.success(`Confirmado · ${result?.documents_updated ?? 0} documento${result?.documents_updated === 1 ? '' : 's'} actualizado${result?.documents_updated === 1 ? '' : 's'}`)
      setEditing(false)
      window.dispatchEvent(new Event('finance-workbook-imported'))
      await load()
    }
    setBusy(false)
  }

  if (!centers.length) {
    return (
      <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] p-6 md:mx-8">
        <div className="flex items-center gap-3 text-[var(--bs-cool-sage)]"><CheckCircle2 className="h-5 w-5" /><p className="text-sm">Raimundo no tiene clasificaciones pendientes.</p></div>
      </section>
    )
  }

  if (!row || !selected) return null

  return (
    <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] md:mx-8">
      <div className="p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Bandeja de Raimundo</p>
            <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Revisar y confirmar</h2>
            <p className="mt-1 text-sm text-[var(--bs-text-secondary)]">Un caso por vez. Confirma la clasificación o cámbiala antes de guardar.</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 text-xs text-[var(--bs-text-secondary)]"><ShieldCheck className="h-4 w-4" />{canReview ? 'Sesión habilitada' : 'Solo Raimundo puede confirmar'}</div>
            <p className="mt-2 text-sm text-[var(--bs-text-primary)]">Caso {index + 1} de {centers.length}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="bg-[var(--bs-surface-secondary)] p-5">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Origen</p>
            <p className="mt-2 text-lg text-[var(--bs-text-primary)]">{row.operational_label || row.historical_label}</p>
            {row.operational_label && <p className="mt-1 text-xs text-[var(--bs-text-muted)]">Histórico: {row.historical_label}</p>}
            <p className="mt-3 text-xs text-[var(--bs-text-secondary)]">{row.open_document_count} documento{row.open_document_count === 1 ? '' : 's'} pendiente{row.open_document_count === 1 ? '' : 's'}</p>

            <div className="mt-5 space-y-3">
              {evidence.slice(0, 3).map((document) => (
                <div key={document.id} className="border-t border-white/10 pt-3 first:border-0 first:pt-0">
                  <div className="flex justify-between gap-4"><p className="text-sm text-[var(--bs-text-primary)]">{document.supplier_name}</p><p className="shrink-0 text-sm text-[var(--bs-text-primary)]">{money(document.total_amount, document.currency)}</p></div>
                  <p className="mt-1 text-xs text-[var(--bs-text-muted)]">Documento {document.document_number}</p>
                  {document.description && <p className="mt-2 text-sm leading-5 text-[var(--bs-text-secondary)]">{document.description}</p>}
                </div>
              ))}
              {evidence.length > 3 && <p className="text-xs text-[var(--bs-text-muted)]">+{evidence.length - 3} documentos adicionales</p>}
            </div>
          </div>

          <div className="bg-[var(--bs-surface-secondary)] p-5">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Clasificación</p>
            {!editing && ready ? (
              <div className="mt-4 space-y-4">
                <div><p className="text-xs text-[var(--bs-text-muted)]">P&L</p><p className="mt-1 text-lg text-[var(--bs-text-primary)]">{divisions.find((division) => division.id === selectedDivision)?.name ?? row.division_name}</p></div>
                <div><p className="text-xs text-[var(--bs-text-muted)]">Categoría</p><p className="mt-1 text-lg text-[var(--bs-text-primary)]">{categories.find((category) => category.id === selected.category)?.name ?? row.category_name}</p></div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <label className="block text-xs text-[var(--bs-text-muted)]">P&L<select value={selectedDivision} disabled={Boolean(row.division_id) || !canReview} onChange={(event) => setChoice((current) => ({ ...current, [row.id]: { division: event.target.value, category: '' } }))} className="mt-2 h-11 w-full bg-[var(--bs-bg-primary)] px-3 text-sm text-[var(--bs-text-primary)] disabled:opacity-60"><option value="">Seleccionar P&L</option>{divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></label>
                <label className="block text-xs text-[var(--bs-text-muted)]">Categoría<select value={selected.category} disabled={!selectedDivision || !canReview} onChange={(event) => setChoice((current) => ({ ...current, [row.id]: { division: selectedDivision, category: event.target.value } }))} className="mt-2 h-11 w-full bg-[var(--bs-bg-primary)] px-3 text-sm text-[var(--bs-text-primary)] disabled:opacity-60"><option value="">Seleccionar categoría</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              </div>
            )}

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => setEditing((value) => !value)} disabled={!canReview}>{editing ? 'Cerrar cambio' : 'Cambiar clasificación'}</Button>
              <Button onClick={() => void confirm()} disabled={!canReview || !ready || busy}>{busy ? 'Guardando…' : 'Confirmar y siguiente'}</Button>
            </div>
            {!ready && <p className="mt-3 text-xs text-[var(--bs-warm-yellow)]">Completa P&L y categoría para confirmar.</p>}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={() => { setIndex((value) => Math.max(0, value - 1)); setEditing(false) }} disabled={index === 0} className="inline-flex min-h-10 items-center gap-2 px-2 text-xs text-[var(--bs-text-secondary)] disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Anterior</button>
          <div className="h-1.5 flex-1 bg-[var(--bs-surface-secondary)] mx-5"><div className="h-full bg-[var(--bs-cool-sage)]" style={{ width: `${((index + 1) / centers.length) * 100}%` }} /></div>
          <button type="button" onClick={() => { setIndex((value) => Math.min(centers.length - 1, value + 1)); setEditing(false) }} disabled={index === centers.length - 1} className="inline-flex min-h-10 items-center gap-2 px-2 text-xs text-[var(--bs-text-secondary)] disabled:opacity-30">Siguiente<ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  )
}
