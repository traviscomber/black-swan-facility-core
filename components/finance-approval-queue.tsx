'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, FileSearch, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type ClassificationStatus = 'ready' | 'exception' | 'manual_review' | 'approved' | 'rejected'
type ApprovalStatus = 'pending_mapping' | 'ready' | 'pending_valuation' | 'approved' | 'rejected'
type QueueView = 'review' | 'pending_valuation' | 'approved' | 'rejected'
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
  amount_eur: number | string | null
  fx_rate_to_eur: number | string | null
  fx_date: string | null
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
}
type Division = { id: string; name: string }
type Category = { id: string; division_id: string; name: string }
type HistoricalCenter = { id: string; historical_label: string; operational_label: string | null; division_id: string; category_id: string }
type AiSuggestion = {
  center_id: string
  center_label: string
  division_id: string
  division_name: string
  category_id: string
  category_name: string
  confidence: number
  reason: string
}

const pct = new Intl.NumberFormat('es-CL', { style: 'percent', maximumFractionDigits: 0 })
function n(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0 }
function formatMoney(value: unknown, currency = 'EUR') {
  try { return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: currency === 'CLP' ? 0 : 2 }).format(n(value)) }
  catch { return `${n(value).toLocaleString('es-CL')} ${currency}` }
}
function isCanonicalMapped(row: QueueRow) { return Boolean(row.division_name && row.category_name && row.category_key && row.category_role === 'cost') }

const tabs: Array<{ key: QueueView; label: string }> = [
  { key: 'review', label: 'Por revisar' },
  { key: 'pending_valuation', label: 'Valorar EUR' },
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
  const [historicalCenters, setHistoricalCenters] = useState<HistoricalCenter[]>([])
  const [reassignCenterId, setReassignCenterId] = useState('')
  const [reassignNote, setReassignNote] = useState('')
  const [canApprove, setCanApprove] = useState(false)
  const [canAdmin, setCanAdmin] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiSuggestion | null>>({})
  const [suggestionLoadingIds, setSuggestionLoadingIds] = useState<Set<string>>(new Set())
  const requestedSuggestions = useRef(new Set<string>())

  const load = useCallback(async () => {
    setLoading(true)
    const [queueResult, divisionResult, categoryResult, centerResult, approvePermission, adminPermission] = await Promise.all([
      supabase.from('finance_approval_queue').select('*').order('queue_order').order('document_date', { ascending: false }),
      supabase.from('budget_divisions').select('id,name').eq('is_active', true).eq('is_aggregate', false).not('source_key', 'is', null).order('sort_order'),
      supabase.from('budget_categories').select('id,division_id,name').eq('is_active', true).not('source_key', 'is', null).eq('category_role', 'cost').order('sort_order'),
      supabase.from('finance_historical_cost_centers').select('id,historical_label,operational_label,division_id,category_id').eq('mapping_status','mapped').not('division_id','is',null).not('category_id','is',null).order('historical_label'),
      supabase.rpc('can_finance_approve'),
      supabase.rpc('can_finance_admin'),
    ])
    const error = queueResult.error || divisionResult.error || categoryResult.error || centerResult.error || approvePermission.error || adminPermission.error
    if (error) toast.error(error.message)
    else {
      const queueRows = (queueResult.data ?? []) as QueueRow[]
      setRows(queueRows)
      setDivisions((divisionResult.data ?? []) as Division[])
      setCategories((categoryResult.data ?? []) as Category[])
      setHistoricalCenters((centerResult.data ?? []) as HistoricalCenter[])
      setCanApprove(Boolean(approvePermission.data))
      setCanAdmin(Boolean(adminPermission.data))
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
    const pending = rows.filter((row) => row.approval_status === 'pending_mapping').slice(0, 10)
    for (const row of pending) {
      if (requestedSuggestions.current.has(row.id)) continue
      requestedSuggestions.current.add(row.id)
      setSuggestionLoadingIds((current) => new Set(current).add(row.id))

      void fetch('/api/finance/cost-center-suggestion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document_id: row.id }),
      }).then(async (response) => {
        const payload = await response.json() as { suggestion?: AiSuggestion | null }
        setAiSuggestions((current) => ({ ...current, [row.id]: response.ok ? (payload.suggestion ?? null) : null }))
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

  const filtered = useMemo(() => status === 'review'
    ? rows.filter((row) => row.approval_status === 'pending_mapping' || row.approval_status === 'ready')
    : rows.filter((row) => row.approval_status === status), [rows, status])
  const counts = useMemo(() => rows.reduce<Record<string, number>>((acc, row) => { acc[row.approval_status] = (acc[row.approval_status] ?? 0) + 1; return acc }, {}), [rows])
  const reviewCount = (counts.pending_mapping ?? 0) + (counts.ready ?? 0)

  async function approve(ids: string[]) {
    const validIds = ids.filter((id) => rows.some((row) => row.id === id && row.approval_status === 'ready' && isCanonicalMapped(row)))
    if (!validIds.length) { toast.error('No hay documentos canónicamente listos para aprobar.'); return }
    setBusy(true)
    let approved = 0
    let valuation = 0
    for (const id of validIds) {
      const { data, error } = await supabase.rpc('approve_finance_document', { p_document_id: id, p_notes: null })
      if (error) { toast.error(error.message); break }
      const result = data as { approval_status?: string; payment_status?: string } | null
      if (result?.approval_status === 'pending_valuation') valuation += 1
      approved += 1
    }
    if (approved) toast.success(`${approved} documento${approved === 1 ? '' : 's'} aprobado${approved === 1 ? '' : 's'} · enviado${approved === 1 ? '' : 's'} a Santiago para revisión y pago${valuation ? ` · ${valuation} pendiente${valuation === 1 ? '' : 's'} de valorización EUR para Budget` : ''}.`)
    await load(); setBusy(false)
  }

  function startReassign(row: QueueRow) {
    setReassigningId(row.id)
    const current = historicalCenters.find((center) => center.division_id === row.division_id && center.category_id === row.category_id && center.operational_label === row.operational_label)
    const aiSuggestion = aiSuggestions[row.id]
    setReassignCenterId(current?.id ?? aiSuggestion?.center_id ?? '')
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
    setBusy(true)
    const { error: reassignError } = await supabase.rpc('reassign_finance_document_center', {
      p_document_id: row.id,
      p_target_center_id: targetCenterId,
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
    const { data: approvalData, error: approvalError } = await supabase.rpc('approve_finance_document', {
      p_document_id: row.id,
      p_notes: approvalNote,
    })

    if (approvalError) {
      toast.error(`Centro guardado, pero la aprobación no avanzó a Santiago: ${approvalError.message}`)
    } else {
      const approval = approvalData as { approval_status?: string; payment_status?: string } | null
      const budgetNote = approval?.approval_status === 'pending_valuation' ? ' · valorización EUR pendiente para Budget' : ''
      toast.success(`Centro confirmado y gasto aprobado · enviado a Santiago para revisión y pago${budgetNote}.`)
    }

    setReassigningId(null)
    setReassignNote('')
    await load()
    setStatus('review')
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

  async function valueInEur(row: QueueRow) {
    const amountRaw = window.prompt(`Monto canónico en EUR para ${row.document_number}`)
    if (!amountRaw) return
    const rateRaw = window.prompt(`Tipo de cambio: EUR por 1 ${row.currency}`)
    if (!rateRaw) return
    const dateRaw = window.prompt('Fecha del tipo de cambio (AAAA-MM-DD)', row.document_date)
    if (!dateRaw) return
    const amount = Number(amountRaw.replace(',', '.'))
    const rate = Number(rateRaw.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) { toast.error('Monto EUR o tipo de cambio inválido.'); return }
    setBusy(true)
    const { error } = await supabase.rpc('value_finance_document_eur', { p_document_id: row.id, p_amount_eur: amount, p_fx_rate_to_eur: rate, p_fx_date: dateRaw, p_notes: 'Valorización EUR validada desde aprobación financiera' })
    if (error) toast.error(error.message); else toast.success('Valorización EUR registrada y posteada al Budget.')
    await load(); setBusy(false)
  }

  return (
    <div className="space-y-5 p-4 md:p-8">
      <section className="bg-[var(--bs-surface-primary)] p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Raimundo · Primera tarea</p>
            <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Revisar todas las facturas nuevas</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">La IA sugiere el centro de costo de cada factura. Raimundo aprueba la sugerencia en un clic o cambia el centro y aprueba; solo entonces el gasto pasa a Santiago para revisión final y pago.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="bg-[var(--bs-surface-secondary)] p-4 md:col-span-2"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Por revisar</p><p className="mt-2 text-xl text-[var(--bs-warm-yellow)]">{reviewCount}</p><p className="mt-1 text-xs text-[var(--bs-text-secondary)]">{counts.pending_mapping ?? 0} sin centro confirmado · {counts.ready ?? 0} con centro sugerido por IA</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Valorar en EUR</p><p className="mt-2 text-xl text-[var(--bs-cool-sky)]">{counts.pending_valuation ?? 0}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Cerradas</p><p className="mt-2 text-xl text-[var(--bs-text-primary)]">{(counts.approved ?? 0) + (counts.rejected ?? 0)}</p></div>
        </div>
      </section>

      <section className="bg-[var(--bs-surface-primary)]">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">{tabs.map((tab) => {
            const count = tab.key === 'review' ? reviewCount : (counts[tab.key] ?? 0)
            return <button key={tab.key} type="button" onClick={() => setStatus(tab.key)} className={`min-h-10 px-3 text-xs ${status === tab.key ? 'bg-[var(--bs-surface-elevated)] text-[var(--bs-text-primary)]' : 'bg-[var(--bs-surface-secondary)] text-[var(--bs-text-secondary)] hover:text-[var(--bs-text-primary)]'}`}>{tab.label} · {count}</button>
          })}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]"><tr><th className="px-4 py-3 font-normal">Documento</th><th className="px-4 py-3 font-normal">Centro de costo / imputación</th><th className="px-4 py-3 font-normal">Clasificación histórica</th><th className="px-4 py-3 text-right font-normal">Monto</th><th className="px-4 py-3 font-normal">Evidencia</th><th className="px-4 py-3 text-right font-normal">Acción</th></tr></thead>
            <tbody>
              {filtered.map((row) => {
                const mapped = isCanonicalMapped(row)
                return <tr key={row.id} className="border-t border-[var(--bs-divider-subtle)] align-top">
                  <td className="px-4 py-4"><p className="text-[var(--bs-text-primary)]">{row.supplier_name}</p><p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.document_number} · {new Date(`${row.document_date}T00:00:00`).toLocaleDateString('es-CL')}</p>{row.description && <p className="mt-2 max-w-72 text-xs leading-5 text-[var(--bs-text-secondary)]">{row.description}</p>}</td>
                  <td className="px-4 py-4">{(() => {
                    const aiSuggestion = aiSuggestions[row.id]
                    if (row.approval_status === 'pending_mapping' && aiSuggestion) {
                      return <>
                        <p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-[var(--bs-cool-sage)]">IA sugiere · {pct.format(aiSuggestion.confidence)}</p>
                        <p className="text-[var(--bs-text-primary)]">{aiSuggestion.division_name}</p>
                        <p className="mt-1 text-xs text-[var(--bs-text-secondary)]">{aiSuggestion.category_name}</p>
                        <p className="mt-2 text-xs text-[var(--bs-warm-yellow)]">Centro · {aiSuggestion.center_label}</p>
                        <p className="mt-1 max-w-72 text-[11px] leading-4 text-[var(--bs-text-muted)]">{aiSuggestion.reason}</p>
                      </>
                    }
                    if (row.approval_status === 'pending_mapping' && suggestionLoadingIds.has(row.id)) {
                      return <p className="text-xs text-[var(--bs-text-secondary)]">IA analizando factura…</p>
                    }
                    if (row.approval_status === 'pending_mapping' && requestedSuggestions.current.has(row.id) && aiSuggestions[row.id] === null) {
                      return <>
                        <p className="text-xs text-[var(--bs-warm-yellow)]">Sin sugerencia IA segura</p>
                        <p className="mt-1 text-[11px] text-[var(--bs-text-muted)]">Raimundo debe seleccionar el centro manualmente.</p>
                      </>
                    }
                    return <>
                      {row.approval_status === 'ready' && mapped && <p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-[var(--bs-cool-sage)]">Sugerencia por historial</p>}
                      <p className={mapped ? 'text-[var(--bs-text-primary)]' : 'text-[var(--bs-warm-yellow)]'}>{row.division_name ?? 'P&L pendiente'}</p>
                      <p className="mt-1 text-xs text-[var(--bs-text-secondary)]">{row.category_name ?? 'Categoría canónica pendiente'}</p>
                      {row.operational_label && <p className="mt-2 text-xs text-[var(--bs-warm-yellow)]">Detalle operativo · {row.operational_label}</p>}
                      {row.cost_center_name && row.cost_center_name !== row.operational_label && <p className="mt-1 text-[11px] text-[var(--bs-text-muted)]">Origen · {row.cost_center_name}</p>}
                    </>
                  })()}</td>
                  <td className="px-4 py-4"><div className="flex gap-2 text-xs leading-5 text-[var(--bs-text-secondary)]">{row.classification_status === 'ready' ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-cool-sage)]" /> : row.classification_status === 'exception' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-warm-orange)]" /> : <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-cool-sky)]" />}<span><span className="block text-[var(--bs-text-primary)]">{classificationLabel(row.classification_status)}</span>{row.classification_reason ?? 'Sin explicación registrada.'}</span></div></td>
                  <td className="px-4 py-4 text-right"><p className="text-[var(--bs-text-primary)]">{formatMoney(row.total_amount, row.currency)}</p>{row.amount_eur != null && <p className="mt-1 text-xs text-[var(--bs-cool-sage)]">{formatMoney(row.amount_eur, 'EUR')}</p>}</td>
                  <td className="px-4 py-4 text-xs leading-5 text-[var(--bs-text-secondary)]"><p>{row.confidence_label ?? (row.confidence == null ? 'Sin confianza' : `Confianza ${pct.format(n(row.confidence))}`)}</p><p>{row.historical_count} antecedentes · {row.historical_dominance == null ? 'dominio —' : `dominio ${pct.format(n(row.historical_dominance))}`}</p><p className={row.amount_in_range === false ? 'text-[var(--bs-warm-orange)]' : row.amount_in_range === true ? 'text-[var(--bs-cool-sage)]' : 'text-[var(--bs-text-muted)]'}>{row.amount_in_range == null ? 'Sin rango' : row.amount_in_range ? 'Dentro de rango' : 'Fuera de rango'}</p></td>
                  <td className="px-4 py-4 text-right">{row.approval_status === 'pending_mapping' ? (
                    <div className="space-y-2">
                      {reassigningId !== row.id && aiSuggestions[row.id] && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => void saveCenterAndApprove(row, aiSuggestions[row.id]!.center_id)} disabled={busy || !canApprove}><Check className="mr-2 h-4 w-4" />Aprobar sugerencia → Santiago</Button>
                          <Button size="sm" variant="outline" onClick={() => startReassign(row)} disabled={busy || !canApprove}>Cambiar centro</Button>
                        </div>
                      )}
                      {reassigningId !== row.id && !aiSuggestions[row.id] && !suggestionLoadingIds.has(row.id) && (
                        <Button size="sm" onClick={() => startReassign(row)} disabled={busy || !canApprove}>Asignar centro de costo</Button>
                      )}
                      {reassigningId !== row.id && suggestionLoadingIds.has(row.id) && (
                        <span className="text-xs text-[var(--bs-text-muted)]">Generando sugerencia IA…</span>
                      )}
                      {reassigningId === row.id && (
                        <div className="ml-auto w-[340px] space-y-2 bg-[var(--bs-surface-secondary)] p-3 text-left">
                          <p className="text-xs text-[var(--bs-text-secondary)]">Selecciona el centro correcto. Al confirmar, el gasto se aprueba y pasa directamente a Santiago para revisión y pago.</p>
                          <select value={reassignCenterId} onChange={(event) => setReassignCenterId(event.target.value)} className="h-9 w-full bg-[var(--bs-bg-primary)] px-2 text-xs text-[var(--bs-text-primary)]">
                            <option value="">Seleccionar centro de costo</option>
                            {historicalCenters.map((center) => {
                              const division = divisions.find((item) => item.id === center.division_id)?.name ?? 'P&L'
                              const category = categories.find((item) => item.id === center.category_id)?.name ?? 'Categoría'
                              return <option key={center.id} value={center.id}>{center.operational_label ?? center.historical_label} · {division} · {category}</option>
                            })}
                          </select>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setReassigningId(null)} disabled={busy}>Cancelar</Button>
                            <Button size="sm" onClick={() => void saveCenterAndApprove(row)} disabled={busy || !reassignCenterId}>Asignar y aprobar → Santiago</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : row.approval_status === 'ready' ? (
                    <div className="space-y-2">
                      <div className="flex justify-end gap-2">
                        {canApprove && <Button size="sm" onClick={() => void approve([row.id])} disabled={busy || !mapped}><Check className="mr-2 h-4 w-4" />Aprobar sugerencia → Santiago</Button>}
                        {canApprove && <Button size="sm" variant="outline" onClick={() => startReassign(row)} disabled={busy}>Cambiar centro</Button>}
                        {canApprove && <Button size="sm" variant="outline" onClick={() => void reject(row)} disabled={busy}><X className="mr-2 h-4 w-4" />Rechazar gasto</Button>}
                        {!canApprove && <span className="text-xs text-[var(--bs-text-muted)]">Solo lectura</span>}
                      </div>
                      {reassigningId === row.id && (
                        <div className="ml-auto w-[340px] space-y-2 bg-[var(--bs-surface-secondary)] p-3 text-left">
                          <p className="text-xs text-[var(--bs-text-secondary)]">Selecciona el centro correcto y registra por qué cambiaste la sugerencia. Al confirmar, el gasto queda aprobado y pasa a Santiago.</p>
                          <select value={reassignCenterId} onChange={(event) => setReassignCenterId(event.target.value)} className="h-9 w-full bg-[var(--bs-bg-primary)] px-2 text-xs text-[var(--bs-text-primary)]">
                            <option value="">Seleccionar centro de costo</option>
                            {historicalCenters.map((center) => {
                              const division = divisions.find((item) => item.id === center.division_id)?.name ?? 'P&L'
                              const category = categories.find((item) => item.id === center.category_id)?.name ?? 'Categoría'
                              return <option key={center.id} value={center.id}>{center.operational_label ?? center.historical_label} · {division} · {category}</option>
                            })}
                          </select>
                          <input value={reassignNote} onChange={(event) => setReassignNote(event.target.value)} placeholder="Motivo de la reasignación" className="h-9 w-full bg-[var(--bs-bg-primary)] px-2 text-xs text-[var(--bs-text-primary)]" />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setReassigningId(null)} disabled={busy}>Cancelar</Button>
                            <Button size="sm" onClick={() => void saveCenterAndApprove(row)} disabled={busy || !reassignCenterId || !reassignNote.trim()}>Cambiar y aprobar → Santiago</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : row.approval_status === 'pending_valuation' ? (canAdmin ? <Button size="sm" onClick={() => void valueInEur(row)} disabled={busy}>Valorizar EUR</Button> : <span className="text-xs text-[var(--bs-text-muted)]">Aprobado por Raimundo</span>) : <span className="text-xs text-[var(--bs-text-muted)]">{row.approval_status === 'approved' ? 'Posteado al Budget' : 'Rechazado'}</span>}</td>
                </tr>
              })}
              {!loading && !filtered.length && <tr><td colSpan={7} className="px-5 py-12 text-center text-[var(--bs-text-muted)]">No hay documentos en esta etapa.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
