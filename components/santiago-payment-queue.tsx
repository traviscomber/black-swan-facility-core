'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { financeAllocationLabel } from '@/lib/finance/budget-display'
import { FinanceDecisionContext } from '@/components/finance-decision-context'

type PaymentStatus = 'not_ready' | 'pending_santiago' | 'authorized' | 'rejected' | 'paid'

type PaymentRow = {
  id: string
  supplier_name: string
  document_number: string
  document_date: string
  due_date: string | null
  description: string | null
  classification_reason: string | null
  confidence: number | string | null
  total_amount: number | string
  currency: string
  division_id: string | null
  category_id: string | null
  cost_center_id: string | null
  operational_label: string | null
  approved_at: string | null
  payment_status: PaymentStatus
  payment_decision_notes: string | null
  payment_decided_at: string | null
  paid_at: string | null
  payment_method: string | null
  payment_reference: string | null
  reconciliation_status: 'unknown' | 'unpaid' | 'paid_observed' | 'reconciled' | 'exception'
  cost_center_escalation_status: 'none' | 'pending_santiago' | 'resolved'
  cost_center_escalation_note: string | null
  cost_center_escalated_at: string | null
  infrastructure_review_status: 'not_required' | 'pending_tomas' | 'approved_by_tomas' | 'rejected_by_tomas'
  infrastructure_review_notes: string | null
  infrastructure_reviewed_at: string | null
}

type Division = { id: string; name: string; source_key: string | null }
type Category = { id: string; division_id: string; name: string }

const tabs: Array<{ key: PaymentStatus; label: string }> = [
  { key: 'pending_santiago', label: 'Pagos por autorizar' },
  { key: 'authorized', label: 'Listos para pagar' },
  { key: 'rejected', label: 'Rechazados' },
  { key: 'paid', label: 'Pagados' },
]

function money(value: unknown, currency: string) {
  const amount = Number(value ?? 0)
  try {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: currency === 'CLP' ? 0 : 2 }).format(amount)
  } catch {
    return `${amount.toLocaleString('es-CL')} ${currency}`
  }
}

export function SantiagoPaymentQueue() {
  const supabase = useMemo(() => createClient(), [])
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [status, setStatus] = useState<PaymentStatus>('pending_santiago')
  const [busy, setBusy] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [method, setMethod] = useState('transferencia_bancaria')
  const [reference, setReference] = useState('')
  const [sourceDocumentIds, setSourceDocumentIds] = useState<Set<string>>(new Set())
  const [assignmentCenter, setAssignmentCenter] = useState<Record<string, string>>({})
  const [assignmentNote, setAssignmentNote] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const permission = await supabase.rpc('can_finance_payment_authorize')
    if (permission.error) {
      setAllowed(false)
      return
    }
    const canPay = Boolean(permission.data)
    setAllowed(canPay)
    if (!canPay) return

    const [documents, divisionResult, categoryResult, sourceResult] = await Promise.all([
      supabase.from('finance_documents')
        .select('id,supplier_name,document_number,document_date,due_date,description,classification_reason,confidence,total_amount,currency,division_id,category_id,cost_center_id,operational_label,approved_at,payment_status,payment_decision_notes,payment_decided_at,paid_at,payment_method,payment_reference,reconciliation_status,cost_center_escalation_status,cost_center_escalation_note,cost_center_escalated_at,infrastructure_review_status,infrastructure_review_notes,infrastructure_reviewed_at')
        .or('payment_status.neq.not_ready,cost_center_escalation_status.eq.pending_santiago')
        .order('approved_at', { ascending: false }),
      supabase.from('budget_divisions').select('id,name,source_key'),
      supabase.from('budget_categories').select('id,division_id,name').eq('is_active', true).not('source_key', 'is', null).eq('category_role', 'cost').order('sort_order'),
      supabase.from('finance_sii_uploads').select('finance_document_id').not('finance_document_id', 'is', null),
    ])
    const error = documents.error || divisionResult.error || categoryResult.error || sourceResult.error
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((documents.data ?? []) as PaymentRow[])
    setDivisions((divisionResult.data ?? []) as Division[])
    setCategories((categoryResult.data ?? []) as Category[])
    setSourceDocumentIds(new Set((sourceResult.data ?? []).map((row) => row.finance_document_id).filter((value): value is string => typeof value === 'string')))
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const channel = supabase.channel('santiago-payment-queue-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_documents' }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  const escalations = rows.filter((row) => row.cost_center_escalation_status === 'pending_santiago')
  const paymentRows = rows.filter((row) => row.reconciliation_status !== 'paid_observed' && row.reconciliation_status !== 'reconciled')
  const filtered = paymentRows.filter((row) => row.payment_status === status)
  const counts = paymentRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.payment_status] = (acc[row.payment_status] ?? 0) + 1
    return acc
  }, {})

  async function assignEscalatedCenter(row: PaymentRow) {
    const categoryId = assignmentCenter[row.id] ?? ''
    if (!categoryId) {
      toast.error('Selecciona el centro de costo antes de guardar.')
      return
    }
    const note = (assignmentNote[row.id] ?? '').trim()
    setBusy(row.id)
    const { error } = await supabase.rpc('santiago_assign_finance_document_budget_mapping', {
      p_document_id: row.id,
      p_category_id: categoryId,
      p_note: note || null,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Centro asignado. La factura volvió a Raimundo para aprobación.')
      setAssignmentCenter((current) => ({ ...current, [row.id]: '' }))
      setAssignmentNote((current) => ({ ...current, [row.id]: '' }))
      await load()
    }
    setBusy(null)
  }

  async function decide(row: PaymentRow, decision: 'authorized' | 'rejected') {
    const notes = decision === 'rejected'
      ? window.prompt(`Motivo para rechazar el pago de ${row.supplier_name} · ${row.document_number}`)
      : null
    if (decision === 'rejected' && !notes?.trim()) return

    setBusy(row.id)
    const { error } = await supabase.rpc('decide_finance_payment', {
      p_document_id: row.id,
      p_decision: decision,
      p_notes: notes?.trim() || null,
    })
    if (error) toast.error(error.message)
    else toast.success(decision === 'authorized' ? 'Pago autorizado. Queda listo para ejecutar.' : 'Pago rechazado. El gasto aprobado por Raimundo se conserva sin ejecutar.')
    await load()
    setBusy(null)
  }

  async function recordPayment(row: PaymentRow) {
    if (!method.trim() || !reference.trim()) {
      toast.error('Registra método y referencia bancaria antes de marcar el pago.')
      return
    }
    setBusy(row.id)
    const { error } = await supabase.rpc('record_finance_payment', {
      p_document_id: row.id,
      p_payment_method: method.trim(),
      p_payment_reference: reference.trim(),
      p_paid_at: new Date().toISOString(),
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Pago registrado. Quedó trazable para conciliación bancaria.')
      setPayingId(null)
      setReference('')
      await load()
    }
    setBusy(null)
  }

  if (allowed === false) return null
  if (allowed === null) {
    return <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] p-6 md:mx-8"><p className="text-sm text-[var(--bs-text-secondary)]">Cargando control de pagos…</p></section>
  }

  return (
    <div className="space-y-3 p-4 md:p-8">
      <section className="flex items-center justify-between gap-3 bg-[var(--bs-surface-primary)] p-4">
        <div>
          <h2 className="text-lg font-medium text-[var(--bs-text-primary)]">Pagos</h2>
          <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{counts.pending_santiago ?? 0} por autorizar · {counts.authorized ?? 0} por pagar</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </section>

      {escalations.length > 0 && (
        <section className="bg-[var(--bs-surface-primary)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-[var(--bs-text-primary)]">Centros por resolver</p>
              <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{escalations.length} pendiente{escalations.length === 1 ? '' : 's'}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {escalations.map((row) => (
              <article key={row.id} className="bg-[var(--bs-surface-secondary)] p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div>
                    <p className="text-sm font-medium text-[var(--bs-text-primary)]">{row.supplier_name}</p>
                    <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.document_number} · {money(row.total_amount, row.currency)}</p>
                    {row.cost_center_escalation_note && <p className="mt-2 text-xs text-[var(--bs-text-secondary)]">{row.cost_center_escalation_note}</p>}
                  </div>

                  <select
                    value={assignmentCenter[row.id] ?? ''}
                    onChange={(event) => setAssignmentCenter((current) => ({ ...current, [row.id]: event.target.value }))}
                    className="h-11 w-full bg-[var(--bs-bg-primary)] px-3 text-sm text-[var(--bs-text-primary)]"
                  >
                    <option value="">Imputación</option>
                    {categories.map((category) => {
                      const division = divisions.find((item) => item.id === category.division_id)
                      return <option key={category.id} value={category.id}>{financeAllocationLabel(division?.name, category.name, division?.source_key)}</option>
                    })}
                  </select>

                  <Button onClick={() => void assignEscalatedCenter(row)} disabled={busy === row.id || !(assignmentCenter[row.id] ?? '')}>
                    <Check className="mr-2 h-4 w-4" />Asignar
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={`min-h-10 shrink-0 px-3 text-xs ${status === tab.key ? 'bg-[var(--bs-surface-elevated)] text-[var(--bs-text-primary)]' : 'bg-[var(--bs-surface-secondary)] text-[var(--bs-text-secondary)]'}`}
          >
            {tab.label} · {counts[tab.key] ?? 0}
          </button>
        ))}
      </div>

      <section className="space-y-2">
        {filtered.map((row) => {
          const division = divisions.find((item) => item.id === row.division_id)
          const category = categories.find((item) => item.id === row.category_id)?.name ?? 'Categoría'
          const reviewLabel = row.infrastructure_review_status === 'approved_by_tomas'
            ? 'Revisada por Tomás'
            : row.infrastructure_review_status === 'rejected_by_tomas'
              ? 'Observada por Tomás'
              : row.approved_at
                ? 'Validada por Raimundo'
                : null

          return (
            <article key={row.id} className="bg-[var(--bs-surface-primary)] p-4 md:p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--bs-text-primary)]">{row.supplier_name}</p>
                      <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.document_number} · {new Date(`${row.document_date}T00:00:00`).toLocaleDateString('es-CL')}</p>
                    </div>
                    <p className="text-base font-medium text-[var(--bs-text-primary)]">{money(row.total_amount, row.currency)}</p>
                  </div>

                  <div className="mt-3">
                    <FinanceDecisionContext
                      description={row.description}
                      allocation={financeAllocationLabel(division?.name, category, division?.source_key)}
                      operationalLabel={row.operational_label}
                      reason={row.infrastructure_review_notes || row.classification_reason}
                      hasSourceFile={sourceDocumentIds.has(row.id)}
                      sourceHref={`/api/finance/sii-invoices/source?documentId=${encodeURIComponent(row.id)}`}
                      evidenceLabel={sourceDocumentIds.has(row.id) ? 'Factura + revisión' : 'Datos + historial'}
                    />
                  </div>

                  {reviewLabel && (
                    <p className={`mt-3 text-xs ${row.infrastructure_review_status === 'rejected_by_tomas' ? 'text-[var(--bs-warm-yellow)]' : 'text-[var(--bs-cool-sage)]'}`}>
                      {reviewLabel}{row.infrastructure_review_status === 'rejected_by_tomas' && row.infrastructure_review_notes ? ` · ${row.infrastructure_review_notes}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex min-w-[190px] flex-col gap-2 lg:items-end">
                  {row.payment_status === 'pending_santiago' && (
                    <>
                      <Button className="w-full lg:w-auto" onClick={() => void decide(row, 'authorized')} disabled={busy === row.id}>
                        <Check className="mr-2 h-4 w-4" />{row.infrastructure_review_status === 'rejected_by_tomas' ? 'Autorizar igual' : 'Autorizar'}
                      </Button>
                      <Button className="w-full lg:w-auto" size="sm" variant="outline" onClick={() => void decide(row, 'rejected')} disabled={busy === row.id}>No pagar</Button>
                    </>
                  )}

                  {row.payment_status === 'authorized' && payingId !== row.id && (
                    <Button className="w-full lg:w-auto" onClick={() => setPayingId(row.id)}>
                      <CreditCard className="mr-2 h-4 w-4" />Registrar pago
                    </Button>
                  )}

                  {row.payment_status === 'rejected' && <span className="text-xs text-[var(--bs-text-muted)]">No pagar</span>}
                  {row.payment_status === 'paid' && <span className="text-xs text-[var(--bs-cool-sage)]">Pagado</span>}
                </div>
              </div>

              {row.payment_status === 'authorized' && payingId === row.id && (
                <div className="mt-4 border-t border-[var(--bs-divider-subtle)] pt-4">
                  <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
                    <label className="block text-xs text-[var(--bs-text-muted)]">
                      Método
                      <select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-2 h-11 w-full bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)]">
                        <option value="transferencia_bancaria">Transferencia</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="otro">Otro</option>
                      </select>
                    </label>
                    <label className="block text-xs text-[var(--bs-text-muted)]">
                      Referencia
                      <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Comprobante" className="mt-2 h-11 w-full bg-[var(--bs-surface-secondary)] px-3 text-sm text-[var(--bs-text-primary)]" />
                    </label>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => { setPayingId(null); setReference('') }}>Cancelar</Button>
                      <Button onClick={() => void recordPayment(row)} disabled={busy === row.id || !reference.trim()}>Confirmar</Button>
                    </div>
                  </div>
                </div>
              )}

              {(row.payment_status === 'rejected' || row.payment_status === 'paid') && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-[var(--bs-text-muted)]">Más</summary>
                  <div className="mt-2 text-xs text-[var(--bs-text-secondary)]">
                    {row.payment_decision_notes && <p>{row.payment_decision_notes}</p>}
                    {row.paid_at && <p>Pagado {new Date(row.paid_at).toLocaleString('es-CL')}</p>}
                    {row.payment_reference && <p>Ref. {row.payment_reference}</p>}
                  </div>
                </details>
              )}
            </article>
          )
        })}

        {!filtered.length && <div className="bg-[var(--bs-surface-primary)] p-8 text-center text-sm text-[var(--bs-text-muted)]">Sin pendientes.</div>}
      </section>
    </div>
  )
}
