'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, FileText, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type PaymentStatus = 'not_ready' | 'pending_santiago' | 'authorized' | 'rejected' | 'paid'

type PaymentRow = {
  id: string
  supplier_name: string
  document_number: string
  document_date: string
  due_date: string | null
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
  cost_center_escalation_status: 'none' | 'pending_santiago' | 'resolved'
  cost_center_escalation_note: string | null
  cost_center_escalated_at: string | null
}

type Division = { id: string; name: string }
type Category = { id: string; division_id: string; name: string }

const tabs: Array<{ key: PaymentStatus; label: string }> = [
  { key: 'pending_santiago', label: 'Por autorizar' },
  { key: 'authorized', label: 'Autorizados' },
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
        .select('id,supplier_name,document_number,document_date,due_date,total_amount,currency,division_id,category_id,cost_center_id,operational_label,approved_at,payment_status,payment_decision_notes,payment_decided_at,paid_at,payment_method,payment_reference,cost_center_escalation_status,cost_center_escalation_note,cost_center_escalated_at')
        .or('payment_status.neq.not_ready,cost_center_escalation_status.eq.pending_santiago')
        .order('approved_at', { ascending: false }),
      supabase.from('budget_divisions').select('id,name'),
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
  const filtered = rows.filter((row) => row.payment_status === status)
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
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
    <div className="space-y-5 p-4 md:p-8">
      <section className="bg-[var(--bs-surface-primary)] p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-cool-sage)]">Control final · Santiago</p>
            <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Resolver imputaciones y ejecutar pagos</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">
              Si Raimundo no sabe a qué centro imputar una factura, puede escalarla aquí. Santiago asigna el centro y la factura vuelve a Raimundo para aprobación. Los gastos ya aprobados siguen después al flujo normal de autorización y pago.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs text-[var(--bs-cool-sage)]"><ShieldCheck className="h-4 w-4" />Control final habilitado</span>
            <Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          <Metric label="Por asignar centro" value={escalations.length} />
          <Metric label="Por autorizar" value={counts.pending_santiago ?? 0} />
          <Metric label="Autorizados" value={counts.authorized ?? 0} />
          <Metric label="Rechazados" value={counts.rejected ?? 0} />
          <Metric label="Pagados" value={counts.paid ?? 0} />
        </div>
      </section>

      {escalations.length > 0 && (
        <section className="bg-[var(--bs-surface-primary)]">
          <div className="p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Escalaciones de Raimundo</p>
            <h3 className="mt-2 text-lg font-normal text-[var(--bs-text-primary)]">Asignar centro de costo</h3>
            <p className="mt-1 text-sm text-[var(--bs-text-secondary)]">Santiago define únicamente la imputación. La aprobación del gasto sigue siendo de Raimundo.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">
                <tr><th className="px-4 py-3 font-normal">Factura</th><th className="px-4 py-3 font-normal">Contexto</th><th className="px-4 py-3 font-normal">Centro de costo</th><th className="px-4 py-3 text-right font-normal">Acción</th></tr>
              </thead>
              <tbody>
                {escalations.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--bs-divider-subtle)] align-top">
                    <td className="px-4 py-4">
                      <p className="text-[var(--bs-text-primary)]">{row.supplier_name}</p>
                      <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.document_number} · {money(row.total_amount, row.currency)}</p>
                      {sourceDocumentIds.has(row.id) && <a className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--bs-cool-sky)] underline" href={`/api/finance/sii-invoices/source?documentId=${encodeURIComponent(row.id)}`} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" />Ver factura</a>}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-[var(--bs-text-secondary)]">{row.cost_center_escalation_note || 'Raimundo solicita apoyo para definir la imputación.'}</p>
                      {row.cost_center_escalated_at && <p className="mt-2 text-[11px] text-[var(--bs-text-muted)]">{new Date(row.cost_center_escalated_at).toLocaleString('es-CL')}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <select value={assignmentCenter[row.id] ?? ''} onChange={(event) => setAssignmentCenter((current) => ({ ...current, [row.id]: event.target.value }))} className="h-9 w-full bg-[var(--bs-surface-secondary)] px-2 text-xs text-[var(--bs-text-primary)]">
                        <option value="">Seleccionar imputación del Budget</option>
                        {categories.map((category) => {
                          const division = divisions.find((item) => item.id === category.division_id)?.name ?? 'P&L'
                          return <option key={category.id} value={category.id}>{division} · {category.name}</option>
                        })}
                      </select>
                      <input value={assignmentNote[row.id] ?? ''} onChange={(event) => setAssignmentNote((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Nota opcional para Raimundo" className="mt-2 h-9 w-full bg-[var(--bs-surface-secondary)] px-2 text-xs text-[var(--bs-text-primary)]" />
                    </td>
                    <td className="px-4 py-4 text-right"><Button size="sm" onClick={() => void assignEscalatedCenter(row)} disabled={busy === row.id || !(assignmentCenter[row.id] ?? '')}><Check className="mr-2 h-4 w-4" />Asignar y devolver a Raimundo</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bg-[var(--bs-surface-primary)]">
        <div className="flex flex-wrap gap-2 p-4">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setStatus(tab.key)}
              className={`min-h-10 px-3 text-xs ${status === tab.key ? 'bg-[var(--bs-surface-elevated)] text-[var(--bs-text-primary)]' : 'bg-[var(--bs-surface-secondary)] text-[var(--bs-text-secondary)]'}`}>
              {tab.label} · {counts[tab.key] ?? 0}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">
              <tr><th className="px-4 py-3 font-normal">Proveedor / documento</th><th className="px-4 py-3 font-normal">Imputación validada</th><th className="px-4 py-3 text-right font-normal">Monto</th><th className="px-4 py-3 font-normal">Estado</th><th className="px-4 py-3 text-right font-normal">Acción</th></tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const division = divisions.find((item) => item.id === row.division_id)?.name ?? 'P&L'
                const category = categories.find((item) => item.id === row.category_id)?.name ?? 'Categoría'
                return (
                  <tr key={row.id} className="border-t border-[var(--bs-divider-subtle)] align-top">
                    <td className="px-4 py-4">
                      <p className="text-[var(--bs-text-primary)]">{row.supplier_name}</p>
                      <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.document_number} · {new Date(`${row.document_date}T00:00:00`).toLocaleDateString('es-CL')}</p>
                      {sourceDocumentIds.has(row.id) ? <a className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--bs-cool-sky)] underline" href={`/api/finance/sii-invoices/source?documentId=${encodeURIComponent(row.id)}`} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" />Ver factura</a> : <p className="mt-2 text-xs text-[var(--bs-text-muted)]">Sin archivo SII adjunto · evidencia histórica</p>}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[var(--bs-text-primary)]">{division} · {category}</p>
                      {row.operational_label && <p className="mt-1 text-xs text-[var(--bs-text-secondary)]">{row.operational_label}</p>}
                      {row.approved_at && <p className="mt-2 text-xs text-[var(--bs-cool-sage)]">Validado por Raimundo · {new Date(row.approved_at).toLocaleString('es-CL')}</p>}
                    </td>
                    <td className="px-4 py-4 text-right text-[var(--bs-text-primary)]">{money(row.total_amount, row.currency)}</td>
                    <td className="px-4 py-4 text-xs text-[var(--bs-text-secondary)]">
                      {row.payment_status === 'pending_santiago' && 'Esperando decisión de Santiago'}
                      {row.payment_status === 'authorized' && 'Autorizado · pendiente de ejecutar'}
                      {row.payment_status === 'rejected' && <>Pago rechazado{row.payment_decision_notes ? <span className="mt-1 block">{row.payment_decision_notes}</span> : null}</>}
                      {row.payment_status === 'paid' && <>Pagado{row.paid_at ? <span className="mt-1 block">{new Date(row.paid_at).toLocaleString('es-CL')}</span> : null}{row.payment_reference ? <span className="mt-1 block">Ref. {row.payment_reference}</span> : null}</>}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {row.payment_status === 'pending_santiago' && <div className="flex justify-end gap-2"><Button size="sm" onClick={() => void decide(row, 'authorized')} disabled={busy === row.id}><Check className="mr-2 h-4 w-4" />Aprobar pago</Button><Button size="sm" variant="outline" onClick={() => void decide(row, 'rejected')} disabled={busy === row.id}><X className="mr-2 h-4 w-4" />Rechazar pago</Button></div>}
                      {row.payment_status === 'authorized' && (
                        <div className="ml-auto w-[320px] space-y-2 text-left">
                          {payingId !== row.id ? <Button size="sm" onClick={() => setPayingId(row.id)}><CreditCard className="mr-2 h-4 w-4" />Registrar pago</Button> : <>
                            <select value={method} onChange={(event) => setMethod(event.target.value)} className="h-9 w-full bg-[var(--bs-surface-secondary)] px-2 text-xs text-[var(--bs-text-primary)]"><option value="transferencia_bancaria">Transferencia bancaria</option><option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="otro">Otro</option></select>
                            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referencia / comprobante" className="h-9 w-full bg-[var(--bs-surface-secondary)] px-2 text-xs text-[var(--bs-text-primary)]" />
                            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setPayingId(null); setReference('') }}>Cancelar</Button><Button size="sm" onClick={() => void recordPayment(row)} disabled={busy === row.id || !reference.trim()}>Confirmar pago</Button></div>
                          </>}
                        </div>
                      )}
                      {row.payment_status === 'rejected' && <span className="text-xs text-[var(--bs-text-muted)]">Sin pago</span>}
                      {row.payment_status === 'paid' && <span className="text-xs text-[var(--bs-cool-sage)]">Cerrado</span>}
                    </td>
                  </tr>
                )
              })}
              {!filtered.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-[var(--bs-text-muted)]">No hay documentos en esta etapa.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">{label}</p><p className="mt-2 text-xl text-[var(--bs-text-primary)]">{value}</p></div>
}
