'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, FileSearch, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { financeAllocationLabel, financeDivisionLabel } from '@/lib/finance/budget-display'
import { FinanceDecisionContext } from '@/components/finance-decision-context'

type ClassificationStatus = 'ready' | 'exception' | 'manual_review' | 'approved' | 'rejected'
type ApprovalStatus = 'pending_mapping' | 'ready' | 'pending_valuation' | 'approved' | 'rejected'
type QueueView = 'review' | 'approved' | 'rejected'
type QueueRow = {
  id: string
  document_type: string
  supplier_name: string
  supplier_rut: string | null
  document_number: string
  document_date: string
  description: string | null
  net_amount: number | string | null
  total_amount: number | string
  currency: string
  classification_status: ClassificationStatus
  approval_status: ApprovalStatus
  valuation_status: string
  confidence: number | string | null
  confidence_label?: string | null
  classification_reason: string | null
  historical_count: number
  historical_dominance: number | string | null
  amount_in_range: boolean | null
  division_id: string | null
  division_name: string | null
  category_id: string | null
  category_name: string | null
  category_key: string | null
  category_role: string | null
  cost_center_name: string | null
  operational_label: string | null
  decision_notes: string | null
  cost_center_escalation_status: 'none' | 'pending_santiago' | 'resolved'
}
type Division = { id: string; name: string; source_key: string | null }
type Category = { id: string; division_id: string; name: string }
type AiSuggestion = {
  center_id: string
  center_label: string
  division_id: string
  division_name: string
  category_id: string
  category_name: string
  confidence: number
  reason: string
  source?: string
}

const pct = new Intl.NumberFormat('es-CL', { style: 'percent', maximumFractionDigits: 0 })
function n(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0 }
function formatMoney(value: unknown, currency: string) {
  try { return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: currency === 'CLP' ? 0 : 2 }).format(n(value)) }
  catch { return `${n(value).toLocaleString('es-CL')} ${currency}` }
}
function isCanonicalMapped(row: QueueRow) { return Boolean(row.division_name && row.category_name && row.category_key && row.category_role === 'cost') }

const tabs: Array<{ key: QueueView; label: string }> = [
  { key: 'review', label: 'Pendientes conmigo' },
  { key: 'approved', label: 'Aprobadas' },
  { key: 'rejected', label: 'Rechazadas' },
]

function classificationLabel(status: ClassificationStatus) {
  if (status === 'ready') return 'Historial consistente'
  if (status === 'exception') return 'Excepción histórica'
  if (status === 'manual_review') return 'Revisión manual'
  return status
}

export function FinanceApprovalQueue() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<QueueView>('review')
  const [busy, setBusy] = useState(false)
  const [divisions, setDivisions] = useState<Division[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [reassigningId, setReassigningId] = useState<string | null>(null)
  const [reassignCenterId, setReassignCenterId] = useState('')
  const [reassignNote, setReassignNote] = useState('')
  const [canApprove, setCanApprove] = useState(false)
  const [sourceDocumentIds, setSourceDocumentIds] = useState<Set<string>>(new Set())
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiSuggestion | null>>({})
  const [suggestionLoadingIds, setSuggestionLoadingIds] = useState<Set<string>>(new Set())
  const requestedSuggestions = useRef(new Set<string>())
  const requestedValuations = useRef(new Set<string>())

  const approveDocument = useCallback(async (documentId: string, notes: string | null = null) => {
    const response = await fetch('/api/finance/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ document_id: documentId, notes }),
    })
    const payload = await response.json() as {
      error?: string
      valuation?: string
      result?: {
        approval_status?: string
        payment_status?: string
      }
    }
    if (!response.ok) throw new Error(payload.error || 'No se pudo aprobar el documento.')
    return payload
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [queueResult, divisionResult, categoryResult, approvePermission, sourceResult] = await Promise.all([
      supabase.from('finance_approval_queue').select('*').order('queue_order').order('document_date', { ascending: false }),
      supabase.from('budget_divisions').select('id,name,source_key').eq('is_active', true).eq('is_aggregate', false).not('source_key', 'is', null).order('sort_order'),
      supabase.from('budget_categories').select('id,division_id,name').eq('is_active', true).not('source_key', 'is', null).eq('category_role', 'cost').order('sort_order'),
      supabase.rpc('can_finance_approve'),
      supabase.from('finance_sii_uploads').select('finance_document_id').not('finance_document_id', 'is', null),
    ])
    const error = queueResult.error || divisionResult.error || categoryResult.error || approvePermission.error || sourceResult.error
    if (error) toast.error(error.message)
    else {
      const queueRows = ((queueResult.data ?? []) as QueueRow[]).filter((row) => row.category_key !== 'buildings')
      setRows(queueRows)
      setDivisions((divisionResult.data ?? []) as Division[])
      setCategories((categoryResult.data ?? []) as Category[])
      setCanApprove(Boolean(approvePermission.data))
      setSourceDocumentIds(new Set((sourceResult.data ?? []).map((row) => row.finance_document_id).filter((value): value is string => typeof value === 'string')))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const onImported = () => void load()
    window.addEventListener('finance-workbook-imported', onImported)
    const channel = supabase.channel('finance-approval-queue-live').on('postgres_changes', { event: '*', schema: 'public', table: 'finance_documents' }, () => void load()).subscribe()
    return () => { window.removeEventListener('finance-workbook-imported', onImported); void supabase.removeChannel(channel) }
  }, [load, supabase])

  useEffect(() => {
    if (!canApprove) return
    const pending = rows.filter((row) => row.approval_status === 'pending_mapping').slice(0, 24)
    for (const row of pending) {
      if (requestedSuggestions.current.has(row.id)) continue
      requestedSuggestions.current.add(row.id)
      setSuggestionLoadingIds((current) => new Set(current).add(row.id))

      void fetch('/api/finance/cost-center-suggestion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document_id: row.id }),
      }).then(async (response) => {
        const payload = await response.json() as { suggestion?: AiSuggestion | null; source?: string }
        const suggestion = response.ok && payload.suggestion
          ? { ...payload.suggestion, source: payload.source }
          : null
        setAiSuggestions((current) => ({ ...current, [row.id]: suggestion }))
      }).catch(() => {
        setAiSuggestions((current) => ({ ...current, [row.id]: null }))
      }).finally(() => {
        setSuggestionLoadingIds((current) => {
          const next = new Set(current)
          next.delete(row.id)
          return next
        })
      })
    }
  }, [canApprove, rows])

  useEffect(() => {
    if (!canApprove) return
    const pending = rows.filter((row) =>
      row.approval_status === 'pending_valuation'
      && row.currency.toUpperCase() === 'CLP'
      && !requestedValuations.current.has(row.id)
    )
    if (!pending.length) return

    for (const row of pending) requestedValuations.current.add(row.id)

    void (async () => {
      let converted = 0
      let failed = 0
      for (const row of pending) {
        try {
          const result = await approveDocument(row.id, 'Valorización interna automática')
          if (result.valuation === 'automatic' || result.valuation === 'not_required') converted += 1
          else failed += 1
        } catch {
          failed += 1
        }
      }
      if (converted) await load()
      if (failed) console.warn('[finance] background valuation retry deferred', { failed })
    })()
  }, [approveDocument, canApprove, load, rows])

  const filtered = useMemo(() => status === 'review'
    ? rows.filter((row) => (row.approval_status === 'pending_mapping' || row.approval_status === 'ready') && row.cost_center_escalation_status !== 'pending_santiago')
    : rows.filter((row) => row.approval_status === status), [rows, status])
  const counts = useMemo(() => rows.reduce<Record<string, number>>((acc, row) => { acc[row.approval_status] = (acc[row.approval_status] ?? 0) + 1; return acc }, {}), [rows])
  const escalatedCount = rows.filter((row) => row.cost_center_escalation_status === 'pending_santiago').length
  const reviewCount = rows.filter((row) => (row.approval_status === 'pending_mapping' || row.approval_status === 'ready') && row.cost_center_escalation_status !== 'pending_santiago').length
  const aiSuggestionCount = Object.values(aiSuggestions).filter(Boolean).length
  const aiAnalyzedCount = Object.keys(aiSuggestions).length

  async function approve(ids: string[]) {
    const validIds = ids.filter((id) => rows.some((row) => row.id === id && row.approval_status === 'ready' && isCanonicalMapped(row)))
    if (!validIds.length) { toast.error('No hay documentos canónicamente listos para aprobar.'); return }
    setBusy(true)
    let approved = 0
    for (const id of validIds) {
      try {
        await approveDocument(id)
        approved += 1
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo completar la aprobación.')
        break
      }
    }
    if (approved) toast.success(`${approved} documento${approved === 1 ? '' : 's'} aprobado${approved === 1 ? '' : 's'} · enviado${approved === 1 ? '' : 's'} a Santiago.`)
    await load()
    setBusy(false)
  }

  function startReassign(row: QueueRow) {
    setReassigningId(row.id)
    const current = categories.find((category) => category.id === row.category_id && category.division_id === row.division_id)
    const aiSuggestion = aiSuggestions[row.id]
    setReassignCenterId(current?.id ?? aiSuggestion?.category_id ?? '')
    setReassignNote('')
  }

  async function saveCenterAndApprove(row: QueueRow, targetCenterId = reassignCenterId, manualNote = reassignNote.trim()) {
    const initialAssignment = row.approval_status === 'pending_mapping'
    const aiSuggestion = aiSuggestions[row.id]
    const acceptedAiSuggestion = initialAssignment && Boolean(aiSuggestion && aiSuggestion.center_id === targetCenterId)
    const note = acceptedAiSuggestion
      ? `Sugerencia IA confirmada por Raimundo · ${aiSuggestion?.reason ?? 'centro sugerido'}`
      : initialAssignment
        ? 'Centro de costo asignado y aprobado por Raimundo'
        : manualNote
    if (!targetCenterId || (!initialAssignment && !note)) {
      toast.error(initialAssignment ? 'Selecciona el centro de costo correcto.' : 'Selecciona el centro de costo correcto y registra el motivo del cambio.')
      return
    }
    const targetCategory = categories.find((category) => category.id === targetCenterId)
    if (!targetCategory) {
      toast.error('La imputación seleccionada no existe en el Budget canónico.')
      return
    }

    setBusy(true)
    const { error: reassignError } = await supabase.rpc('assign_finance_document_budget_mapping', {
      p_document_id: row.id,
      p_division_id: targetCategory.division_id,
      p_category_id: targetCategory.id,
      p_note: note,
    })
    if (reassignError) {
      toast.error(reassignError.message)
      setBusy(false)
      return
    }

    const approvalNote = acceptedAiSuggestion
      ? 'Sugerencia IA de centro de costo confirmada por Raimundo antes de envío a Santiago'
      : initialAssignment
        ? 'Centro de costo asignado por Raimundo antes de envío a Santiago'
        : `Centro de costo corregido por Raimundo · ${note}`
    try {
      await approveDocument(row.id, approvalNote)
      toast.success('Centro confirmado y gasto aprobado · enviado a Santiago para revisión y pago.')
    } catch (error) {
      toast.error(`Centro guardado, pero la aprobación no avanzó a Santiago: ${error instanceof Error ? error.message : 'falló la aprobación'}`)
    }

    setReassigningId(null)
    setReassignNote('')
    await load()
    setStatus('review')
    setBusy(false)
  }

  async function escalateToSantiago(row: QueueRow) {
    setBusy(true)
    const { error } = await supabase.rpc('escalate_finance_document_cost_center', {
      p_document_id: row.id,
      p_note: 'Raimundo solicita a Santiago definir la imputación del centro de costo',
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Escalado a Santiago para asignar centro de costo. Volverá a Raimundo para aprobación.')
      setReassigningId(null)
      setReassignNote('')
      await load()
    }
    setBusy(false)
  }

  async function reject(row: QueueRow) {
    const notes = window.prompt(`Motivo de rechazo para ${row.supplier_name} · ${row.document_number}`)
    if (!notes?.trim()) return
    setBusy(true)
    const { error } = await supabase.rpc('reject_finance_document', { p_document_id: row.id, p_notes: notes.trim() })
    if (error) toast.error(error.message); else toast.success('Documento rechazado.')
    await load(); setBusy(false)
  }


  return (
    <div className="space-y-3 px-4 pb-8 md:px-8">
      <section className="flex items-center justify-between gap-3 bg-[var(--bs-surface-primary)] p-4">
        <div>
          <h2 className="text-lg font-medium text-[var(--bs-text-primary)]">Aprobaciones</h2>
          <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{reviewCount} pendiente{reviewCount === 1 ? '' : 's'}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const count = tab.key === 'review' ? reviewCount : (counts[tab.key] ?? 0)
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatus(tab.key)}
              className={`min-h-10 shrink-0 px-3 text-xs ${status === tab.key ? 'bg-[var(--bs-surface-elevated)] text-[var(--bs-text-primary)]' : 'bg-[var(--bs-surface-secondary)] text-[var(--bs-text-secondary)]'}`}
            >
              {tab.label} · {count}
            </button>
          )
        })}
      </div>

      <section className="space-y-2">
        {filtered.map((row) => {
          const mapped = isCanonicalMapped(row)
          const aiSuggestion = aiSuggestions[row.id]
          const allocation = aiSuggestion
            ? financeAllocationLabel(aiSuggestion.division_name, aiSuggestion.category_name)
            : row.division_name && row.category_name
              ? financeAllocationLabel(row.division_name, row.category_name)
              : null
          const sourceHref = `/api/finance/sii-invoices/source?documentId=${encodeURIComponent(row.id)}`

          return (
            <article key={row.id} className="bg-[var(--bs-surface-primary)] p-4 md:p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--bs-text-primary)]">{row.supplier_name}</p>
                      <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.document_number} · {new Date(`${row.document_date}T00:00:00`).toLocaleDateString('es-CL')}</p>
                    </div>
                    <p className="text-base font-medium text-[var(--bs-text-primary)]">{formatMoney(row.total_amount, row.currency)}</p>
                  </div>

                  <div className="mt-3">
                    <FinanceDecisionContext
                      description={row.description}
                      allocation={allocation}
                      operationalLabel={row.operational_label}
                      reason={aiSuggestion?.reason || row.classification_reason}
                      hasSourceFile={sourceDocumentIds.has(row.id)}
                      sourceHref={sourceHref}
                      evidenceLabel={aiSuggestion?.source === 'pdf_plus_historical_text' ? 'PDF + historial' : sourceDocumentIds.has(row.id) ? 'Factura + historial' : 'Datos + historial'}
                    />
                  </div>
                </div>

                <div className="flex min-w-[190px] flex-col gap-2 lg:items-end">
                  {row.approval_status === 'pending_mapping' ? (
                    <>
                      {aiSuggestion && reassigningId !== row.id && (
                        <>
                          <Button className="w-full lg:w-auto" onClick={() => void saveCenterAndApprove(row, aiSuggestion.center_id)} disabled={busy || !canApprove}>
                            <Check className="mr-2 h-4 w-4" />Aprobar
                          </Button>
                          <Button className="w-full lg:w-auto" size="sm" variant="outline" onClick={() => startReassign(row)} disabled={busy || !canApprove}>Cambiar</Button>
                        </>
                      )}
                      {!aiSuggestion && !suggestionLoadingIds.has(row.id) && reassigningId !== row.id && (
                        <Button className="w-full lg:w-auto" onClick={() => startReassign(row)} disabled={busy || !canApprove}>Asignar</Button>
                      )}
                      {suggestionLoadingIds.has(row.id) && <span className="text-xs text-[var(--bs-text-muted)]">Analizando…</span>}
                    </>
                  ) : row.approval_status === 'ready' ? (
                    <>
                      {canApprove && <Button className="w-full lg:w-auto" onClick={() => void approve([row.id])} disabled={busy || !mapped}><Check className="mr-2 h-4 w-4" />Aprobar</Button>}
                      {canApprove && <Button className="w-full lg:w-auto" size="sm" variant="outline" onClick={() => startReassign(row)} disabled={busy}>Cambiar</Button>}
                    </>
                  ) : (
                    <span className="text-xs text-[var(--bs-text-muted)]">{row.approval_status === 'approved' ? 'Aprobado' : row.approval_status === 'rejected' ? 'Rechazado' : 'Enviado a Santiago'}</span>
                  )}

                  {(row.approval_status === 'pending_mapping' || row.approval_status === 'ready') && reassigningId !== row.id && canApprove && (
                    <details className="w-full lg:w-auto">
                      <summary className="cursor-pointer list-none text-center text-xs text-[var(--bs-text-muted)] lg:text-right">Más</summary>
                      <div className="mt-2 flex flex-col gap-2">
                        <Button size="sm" variant="ghost" onClick={() => void escalateToSantiago(row)} disabled={busy}>Enviar a Santiago</Button>
                        <Button size="sm" variant="ghost" onClick={() => void reject(row)} disabled={busy}>Rechazar</Button>
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {reassigningId === row.id && (
                <div className="mt-4 border-t border-[var(--bs-divider-subtle)] pt-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="block text-xs text-[var(--bs-text-muted)]">
                      Imputación
                      <select value={reassignCenterId} onChange={(event) => setReassignCenterId(event.target.value)} className="mt-2 h-11 w-full bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)]">
                        <option value="">Seleccionar</option>
                        {categories.map((category) => {
                          const division = divisions.find((item) => item.id === category.division_id)
                          return <option key={category.id} value={category.id}>{financeAllocationLabel(division?.name, category.name, division?.source_key)}</option>
                        })}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setReassigningId(null)} disabled={busy}>Cancelar</Button>
                      <Button onClick={() => void saveCenterAndApprove(row)} disabled={busy || !reassignCenterId || (row.approval_status === 'ready' && !reassignNote.trim())}>
                        Guardar y aprobar
                      </Button>
                    </div>
                  </div>
                  {row.approval_status === 'ready' && (
                    <input
                      value={reassignNote}
                      onChange={(event) => setReassignNote(event.target.value)}
                      placeholder="Motivo del cambio"
                      className="mt-3 h-11 w-full bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)]"
                    />
                  )}
                </div>
              )}
            </article>
          )
        })}

        {!loading && !filtered.length && (
          <div className="bg-[var(--bs-surface-primary)] p-8 text-center text-sm text-[var(--bs-text-muted)]">Sin pendientes.</div>
        )}
      </section>
    </div>
  )

}
