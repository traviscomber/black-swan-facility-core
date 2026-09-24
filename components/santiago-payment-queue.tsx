'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Check, CreditCard, FileText, RefreshCw, ShieldCheck, X } from 'lucide-react'
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
  reconciliation_status: 'unknown' | 'unpaid' | 'paid_observed' | 'reconciled' | 'exception'
  reconciliation_checked_at: string | null
  reconciliation_notes: string | null
}

type Division = { id: string; name: string }
type Category = { id: string; name: string }
type BankStatement = { period_end: string; processed_at: string | null; matched_count: number; unmatched_count: number; processing_error: string | null }
type FinanceAlert = {
  id: string
  document_id: string
  change_kind: string
  old_value: string | null
  new_value: string | null
  title: string
  detail: string | null
  created_at: string
  read_at: string | null
}

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
  const [alerts, setAlerts] = useState<FinanceAlert[]>([])
  const [latestStatement, setLatestStatement] = useState<BankStatement | null>(null)

  const load = useCallback(async () => {
    const permission = await supabase.rpc('can_finance_payment_authorize')
    if (permission.error) {
      setAllowed(false)
      return
    }
    const canPay = Boolean(permission.data)
    setAllowed(canPay)
    if (!canPay) return

    const [documents, divisionResult, categoryResult, sourceResult, alertResult, statementResult] = await Promise.all([
      supabase.from('finance_documents')
        .select('id,supplier_name,document_number,document_date,due_date,total_amount,currency,division_id,category_id,cost_center_id,operational_label,approved_at,payment_status,payment_decision_notes,payment_decided_at,paid_at,payment_method,payment_reference,reconciliation_status,reconciliation_checked_at,reconciliation_notes')
        .neq('payment_status', 'not_ready')
        .order('approved_at', { ascending: false }),
      supabase.from('budget_divisions').select('id,name'),
      supabase.from('budget_categories').select('id,name'),
      supabase.from('finance_sii_uploads').select('finance_document_id').not('finance_document_id', 'is', null),
      supabase.from('finance_document_alerts').select('id,document_id,change_kind,old_value,new_value,title,detail,created_at,read_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('finance_bank_statement_uploads').select('period_end,processed_at,matched_count,unmatched_count,processing_error').order('period_end', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    const error = documents.error || divisionResult.error || categoryResult.error || sourceResult.error || alertResult.error || statementResult.error
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((documents.data ?? []) as PaymentRow[])
    setDivisions((divisionResult.data ?? []) as Division[])
    setCategories((categoryResult.data ?? []) as Category[])
    setSourceDocumentIds(new Set((sourceResult.data ?? []).map((row) => row.finance_document_id).filter((value): value is string => typeof value === 'string')))
    setAlerts((alertResult.data ?? []) as FinanceAlert[])
    setLatestStatement((statementResult.data ?? null) as BankStatement | null)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const channel = supabase.channel('santiago-payment-queue-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_documents' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_document_alerts' }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  const filtered = rows.filter((row) => row.payment_status === status)
  const unreadAlerts = alerts.filter((alert) => !alert.read_at)
  const withoutBankProof = rows.filter((row) => row.reconciliation_status === 'unknown' || row.reconciliation_status === 'unpaid').length
  const bankObserved = rows.filter((row) => row.reconciliation_status === 'paid_observed').length
  const reconciled = rows.filter((row) => row.reconciliation_status === 'reconciled').length
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.payment_status] = (acc[row.payment_status] ?? 0) + 1
    return acc
  }, {})

  async function markAlertRead(alert: FinanceAlert) {
    if (alert.read_at) return
    const { error } = await supabase.from('finance_document_alerts').update({ read_at: new Date().toISOString() }).eq('id', alert.id)
    if (error) toast.error(error.message)
    else await load()
  }

  async function markAllAlertsRead() {
    const ids = unreadAlerts.map((alert) => alert.id)
    if (!ids.length) return
    const { error } = await supabase.from('finance_document_alerts').update({ read_at: new Date().toISOString() }).in('id', ids)
    if (error) toast.error(error.message)
    else await load()
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
            <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Qué está pagado y qué sigue pendiente</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">La vista cruza los gastos aprobados con la última cartola bancaria. Santiago actúa sobre lo pendiente; el banco confirma la realidad del pago.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs text-[var(--bs-cool-sage)]"><ShieldCheck className="h-4 w-4" />Control final habilitado</span>
            <Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Metric label="Sin pago conciliado" value={withoutBankProof} />
          <Metric label="Pago observado" value={bankObserved} />
          <Metric label="Conciliados" value={reconciled} />
          <Metric label="Por decidir" value={counts.pending_santiago ?? 0} />
        </div>
        <p className="mt-4 text-xs text-[var(--bs-text-muted)]">{latestStatement ? latestStatement.processing_error ? `Última cartola: ${latestStatement.period_end} · cruce pendiente` : `Banco actualizado al ${latestStatement.period_end} · ${latestStatement.matched_count} pagos observados` : 'Aún no hay cartola bancaria cargada.'}</p>
      </section>

      <section className="bg-[var(--bs-surface-primary)] p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Atención</p>
            <h3 className="mt-2 text-lg text-[var(--bs-text-primary)]">Cambios relevantes · {unreadAlerts.length}</h3>
            <p className="mt-1 text-sm text-[var(--bs-text-secondary)]">Solo cambios de estado que Santiago necesita conocer.</p>
          </div>
          {unreadAlerts.length > 0 && <Button variant="outline" onClick={() => void markAllAlertsRead()}>Marcar leídas</Button>}
        </div>
        <div className="mt-4 divide-y divide-[var(--bs-divider-subtle)]">
          {alerts.filter((alert) => !alert.read_at).slice(0, 5).map((alert) => <button key={alert.id} type="button" onClick={() => void markAlertRead(alert)} className="flex w-full items-start gap-3 py-3 text-left">
            <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${alert.read_at ? 'text-[var(--bs-text-muted)]' : 'text-[var(--bs-warm-yellow)]'}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-[var(--bs-text-primary)]">{alert.title}</span>
              <span className="mt-1 block text-xs text-[var(--bs-text-secondary)]">{alert.detail ?? 'Documento financiero'} · {new Date(alert.created_at).toLocaleString('es-CL')}</span>
            </span>
            {!alert.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--bs-warm-yellow)]" />}
          </button>)}
          {!unreadAlerts.length && <p className="py-5 text-sm text-[var(--bs-text-muted)]">Sin alertas pendientes.</p>}
        </div>
      </section>

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
              <tr><th className="px-4 py-3 font-normal">Proveedor / documento</th><th className="px-4 py-3 text-right font-normal">Monto</th><th className="px-4 py-3 font-normal">Banco</th><th className="px-4 py-3 font-normal">Pago</th><th className="px-4 py-3 text-right font-normal">Acción</th></tr>
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
                    <td className="px-4 py-4 text-right text-[var(--bs-text-primary)]">{money(row.total_amount, row.currency)}</td>
                    <td className="px-4 py-4 text-xs">
                      <p className={row.reconciliation_status === 'reconciled' ? 'text-[var(--bs-cool-sage)]' : row.reconciliation_status === 'paid_observed' ? 'text-[var(--bs-cool-sky)]' : row.reconciliation_status === 'exception' ? 'text-[var(--bs-warm-orange)]' : 'text-[var(--bs-text-secondary)]'}>
                        {row.reconciliation_status === 'reconciled' ? 'Conciliado' : row.reconciliation_status === 'paid_observed' ? 'Pago observado' : row.reconciliation_status === 'exception' ? 'Excepción' : 'Sin pago conciliado'}
                      </p>
                      {row.reconciliation_checked_at && <p className="mt-1 text-[11px] text-[var(--bs-text-muted)]">{new Date(row.reconciliation_checked_at).toLocaleString('es-CL')}</p>}
                    </td>
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
              {!filtered.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-[var(--bs-text-muted)]">{status === 'pending_santiago' ? 'No hay pagos pendientes. Los cambios de estado igualmente aparecerán arriba como alertas.' : 'No hay documentos en esta etapa.'}</td></tr>}
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
