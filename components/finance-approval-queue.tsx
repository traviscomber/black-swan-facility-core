'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, FileSearch, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type ClassificationStatus = 'ready' | 'exception' | 'manual_review' | 'approved' | 'rejected'
type ApprovalStatus = 'pending_mapping' | 'ready' | 'pending_valuation' | 'approved' | 'rejected'
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
  division_name: string | null
  category_name: string | null
  category_key: string | null
  category_role: string | null
  cost_center_name: string | null
  decision_notes: string | null
}

const pct = new Intl.NumberFormat('es-CL', { style: 'percent', maximumFractionDigits: 0 })
function n(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0 }
function formatMoney(value: unknown, currency = 'EUR') {
  try { return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: currency === 'CLP' ? 0 : 2 }).format(n(value)) }
  catch { return `${n(value).toLocaleString('es-CL')} ${currency}` }
}
function isCanonicalMapped(row: QueueRow) { return Boolean(row.division_name && row.category_name && row.category_key && row.category_role === 'cost') }

const tabs: Array<{ key: ApprovalStatus; label: string }> = [
  { key: 'pending_mapping', label: 'Por clasificar' },
  { key: 'ready', label: 'Para decidir' },
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
  const [status, setStatus] = useState<ApprovalStatus>('ready')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('finance_approval_queue').select('*').order('queue_order').order('document_date', { ascending: false })
    if (error) toast.error(error.message)
    else setRows((data ?? []) as QueueRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const onImported = () => void load()
    window.addEventListener('finance-workbook-imported', onImported)
    const channel = supabase.channel('finance-approval-queue-live').on('postgres_changes', { event: '*', schema: 'public', table: 'finance_documents' }, () => void load()).subscribe()
    return () => { window.removeEventListener('finance-workbook-imported', onImported); void supabase.removeChannel(channel) }
  }, [load, supabase])
  useEffect(() => { setSelected(new Set()) }, [status])

  const filtered = useMemo(() => rows.filter((row) => row.approval_status === status), [rows, status])
  const eligible = useMemo(() => filtered.filter(isCanonicalMapped), [filtered])
  const counts = useMemo(() => rows.reduce<Record<string, number>>((acc, row) => { acc[row.approval_status] = (acc[row.approval_status] ?? 0) + 1; return acc }, {}), [rows])
  const decisionBreakdown = useMemo(() => rows.filter((row) => row.approval_status === 'ready').reduce<Record<string, number>>((acc, row) => { acc[row.classification_status] = (acc[row.classification_status] ?? 0) + 1; return acc }, {}), [rows])

  function toggle(id: string) {
    const row = filtered.find((item) => item.id === id)
    if (!row || !isCanonicalMapped(row) || row.approval_status !== 'ready') return
    setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleAllEligible() {
    const ids = eligible.filter((row) => row.approval_status === 'ready').map((row) => row.id)
    setSelected((current) => ids.length > 0 && ids.every((id) => current.has(id)) ? new Set() : new Set(ids))
  }

  async function approve(ids: string[]) {
    const validIds = ids.filter((id) => rows.some((row) => row.id === id && row.approval_status === 'ready' && isCanonicalMapped(row)))
    if (!validIds.length) { toast.error('No hay documentos canónicamente listos para aprobar.'); return }
    setBusy(true)
    let approved = 0
    let valuation = 0
    for (const id of validIds) {
      const { data, error } = await supabase.rpc('approve_finance_document', { p_document_id: id, p_notes: null })
      if (error) { toast.error(error.message); break }
      const result = data as { approval_status?: string } | null
      if (result?.approval_status === 'pending_valuation') valuation += 1
      approved += 1
    }
    if (approved) toast.success(`${approved} documento${approved === 1 ? '' : 's'} aprobado${approved === 1 ? '' : 's'}${valuation ? ` · ${valuation} pendiente${valuation === 1 ? '' : 's'} de valorización EUR` : ''}.`)
    setSelected(new Set()); await load(); setBusy(false)
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
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Paso 2 · Decidir</p>
            <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Clasificación y aprobación son estados distintos</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">El historial explica qué tan confiable es una clasificación. Raimundo aprueba o rechaza después. Si el documento viene en CLP, la aprobación no altera el Budget hasta registrar una valorización EUR trazable.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Por clasificar</p><p className="mt-2 text-xl text-[var(--bs-warm-yellow)]">{counts.pending_mapping ?? 0}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Para decidir</p><p className="mt-2 text-xl text-[var(--bs-cool-sage)]">{counts.ready ?? 0}</p><p className="mt-1 text-xs text-[var(--bs-text-secondary)]">{decisionBreakdown.ready ?? 0} consistentes · {decisionBreakdown.exception ?? 0} excepciones · {decisionBreakdown.manual_review ?? 0} manuales</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Valorar en EUR</p><p className="mt-2 text-xl text-[var(--bs-cool-sky)]">{counts.pending_valuation ?? 0}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Cerradas</p><p className="mt-2 text-xl text-[var(--bs-text-primary)]">{(counts.approved ?? 0) + (counts.rejected ?? 0)}</p></div>
        </div>
      </section>

      <section className="bg-[var(--bs-surface-primary)]">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setStatus(tab.key)} className={`min-h-10 px-3 text-xs ${status === tab.key ? 'bg-[var(--bs-surface-elevated)] text-[var(--bs-text-primary)]' : 'bg-[var(--bs-surface-secondary)] text-[var(--bs-text-secondary)] hover:text-[var(--bs-text-primary)]'}`}>{tab.label} · {counts[tab.key] ?? 0}</button>)}</div>
          {status === 'ready' && eligible.length > 0 && <Button onClick={() => void approve(Array.from(selected.size ? selected : new Set(eligible.map((row) => row.id))))} disabled={busy}><CheckCircle2 className="mr-2 h-4 w-4" />{selected.size ? `Aprobar ${selected.size}` : `Aprobar elegibles (${eligible.length})`}</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]"><tr>{status === 'ready' && <th className="w-12 px-4 py-3 font-normal"><input type="checkbox" checked={eligible.length > 0 && eligible.every((row) => selected.has(row.id))} onChange={toggleAllEligible} disabled={!eligible.length} aria-label="Seleccionar todos los elegibles" /></th>}<th className="px-4 py-3 font-normal">Documento</th><th className="px-4 py-3 font-normal">Budget</th><th className="px-4 py-3 font-normal">Clasificación histórica</th><th className="px-4 py-3 text-right font-normal">Monto</th><th className="px-4 py-3 font-normal">Evidencia</th><th className="px-4 py-3 text-right font-normal">Acción</th></tr></thead>
            <tbody>
              {filtered.map((row) => {
                const mapped = isCanonicalMapped(row)
                return <tr key={row.id} className="border-t border-[var(--bs-divider-subtle)] align-top">
                  {status === 'ready' && <td className="px-4 py-4"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} disabled={!mapped} aria-label={`Seleccionar ${row.document_number}`} /></td>}
                  <td className="px-4 py-4"><p className="text-[var(--bs-text-primary)]">{row.supplier_name}</p><p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.document_number} · {new Date(`${row.document_date}T00:00:00`).toLocaleDateString('es-CL')}</p>{row.description && <p className="mt-2 max-w-72 text-xs leading-5 text-[var(--bs-text-secondary)]">{row.description}</p>}</td>
                  <td className="px-4 py-4"><p className={mapped ? 'text-[var(--bs-text-primary)]' : 'text-[var(--bs-warm-yellow)]'}>{row.division_name ?? 'P&L pendiente'}</p><p className="mt-1 text-xs text-[var(--bs-text-secondary)]">{row.category_name ?? 'Categoría canónica pendiente'}</p>{row.cost_center_name && <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.cost_center_name}</p>}</td>
                  <td className="px-4 py-4"><div className="flex gap-2 text-xs leading-5 text-[var(--bs-text-secondary)]">{row.classification_status === 'ready' ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-cool-sage)]" /> : row.classification_status === 'exception' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-warm-orange)]" /> : <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-cool-sky)]" />}<span><span className="block text-[var(--bs-text-primary)]">{classificationLabel(row.classification_status)}</span>{row.classification_reason ?? 'Sin explicación registrada.'}</span></div></td>
                  <td className="px-4 py-4 text-right"><p className="text-[var(--bs-text-primary)]">{formatMoney(row.total_amount, row.currency)}</p>{row.amount_eur != null && <p className="mt-1 text-xs text-[var(--bs-cool-sage)]">{formatMoney(row.amount_eur, 'EUR')}</p>}</td>
                  <td className="px-4 py-4 text-xs leading-5 text-[var(--bs-text-secondary)]"><p>{row.confidence_label ?? (row.confidence == null ? 'Sin confianza' : `Confianza ${pct.format(n(row.confidence))}`)}</p><p>{row.historical_count} antecedentes · {row.historical_dominance == null ? 'dominio —' : `dominio ${pct.format(n(row.historical_dominance))}`}</p><p className={row.amount_in_range === false ? 'text-[var(--bs-warm-orange)]' : row.amount_in_range === true ? 'text-[var(--bs-cool-sage)]' : 'text-[var(--bs-text-muted)]'}>{row.amount_in_range == null ? 'Sin rango' : row.amount_in_range ? 'Dentro de rango' : 'Fuera de rango'}</p></td>
                  <td className="px-4 py-4 text-right">{row.approval_status === 'pending_mapping' ? <span className="text-xs text-[var(--bs-text-muted)]">Mapear arriba</span> : row.approval_status === 'ready' ? <div className="flex justify-end gap-2"><Button size="sm" onClick={() => void approve([row.id])} disabled={busy || !mapped}><Check className="mr-2 h-4 w-4" />Aprobar</Button><Button size="sm" variant="outline" onClick={() => void reject(row)} disabled={busy}><X className="mr-2 h-4 w-4" />Rechazar</Button></div> : row.approval_status === 'pending_valuation' ? <Button size="sm" onClick={() => void valueInEur(row)} disabled={busy}>Valorizar EUR</Button> : <span className="text-xs text-[var(--bs-text-muted)]">{row.approval_status === 'approved' ? 'Posteado al Budget' : 'Rechazado'}</span>}</td>
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
