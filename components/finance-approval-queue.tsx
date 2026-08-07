'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, FileSearch, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type QueueStatus = 'ready' | 'exception' | 'manual_review' | 'approved' | 'rejected'

type QueueRow = {
  id: string
  supplier_name: string
  supplier_rut: string | null
  document_number: string
  document_date: string
  due_date: string | null
  description: string | null
  net_amount: number | string | null
  tax_amount: number | string | null
  total_amount: number | string
  currency: string
  classification_status: QueueStatus
  confidence: number | string | null
  confidence_label?: string | null
  classification_reason: string | null
  historical_count: number
  historical_dominance: number | string | null
  historical_median: number | string | null
  accepted_min: number | string | null
  accepted_max: number | string | null
  amount_in_range: boolean | null
  division_name: string | null
  category_name: string | null
  cost_center_name: string | null
  cost_center_code: string | null
  decision_notes: string | null
}

const pct = new Intl.NumberFormat('es-CL', { style: 'percent', maximumFractionDigits: 0 })
function n(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0 }
function formatMoney(value: unknown, currency = 'EUR') {
  const code = currency || 'EUR'
  try { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: code, maximumFractionDigits: code === 'CLP' ? 0 : 2 }).format(n(value)) }
  catch { return `${n(value).toLocaleString('es-CL')} ${code}` }
}

const tabs: Array<{ key: QueueStatus; label: string }> = [
  { key: 'ready', label: 'Listas para aprobar' },
  { key: 'exception', label: 'Excepciones' },
  { key: 'manual_review', label: 'Revisión manual' },
  { key: 'approved', label: 'Aprobadas' },
  { key: 'rejected', label: 'Rechazadas' },
]

export function FinanceApprovalQueue() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<QueueStatus>('ready')
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

  const filtered = useMemo(() => rows.filter((row) => row.classification_status === status), [rows, status])
  const counts = useMemo(() => rows.reduce<Record<string, number>>((acc, row) => { acc[row.classification_status] = (acc[row.classification_status] ?? 0) + 1; return acc }, {}), [rows])
  const sums = useMemo(() => {
    const byCurrency = new Map<string, { ready: number; pending: number }>()
    for (const row of rows) {
      const current = byCurrency.get(row.currency) ?? { ready: 0, pending: 0 }
      if (row.classification_status === 'ready') current.ready += n(row.total_amount)
      if (['ready', 'exception', 'manual_review'].includes(row.classification_status)) current.pending += n(row.total_amount)
      byCurrency.set(row.currency, current)
    }
    return Array.from(byCurrency.entries())
  }, [rows])

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  function toggleAll() { setSelected((current) => current.size === filtered.length ? new Set() : new Set(filtered.map((row) => row.id))) }

  async function approve(ids: string[]) {
    if (!ids.length) return
    setBusy(true)
    let approved = 0
    for (const id of ids) {
      const row = rows.find((item) => item.id === id)
      if (!row?.division_name || !row.category_name) { toast.error('Falta mapear centro P&L o categoría Budget antes de aprobar.'); break }
      const { error } = await supabase.rpc('approve_finance_document', { p_document_id: id, p_notes: null })
      if (error) { toast.error(error.message); break }
      approved += 1
    }
    if (approved) toast.success(`${approved} documento${approved === 1 ? '' : 's'} aprobado${approved === 1 ? '' : 's'}.`)
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

  return (
    <div className="space-y-5 p-4 md:p-8">
      <section className="bg-[var(--bs-surface-primary)] p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Raimundo · Administración del campo</p>
            <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Aprobación financiera rápida</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">La clasificación histórica se conserva tal como viene de Valentina. Una factura solo puede aprobarse contra Budget cuando centro P&L y categoría canónica están validados.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Listas para aprobar</p><p className="mt-2 text-xl text-[var(--bs-cool-sage)]">{counts.ready ?? 0}</p><div className="mt-1 space-y-1 text-xs text-[var(--bs-text-secondary)]">{sums.map(([currency, total]) => total.ready > 0 && <p key={currency}>{formatMoney(total.ready, currency)}</p>)}</div></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Excepciones</p><p className="mt-2 text-xl text-[var(--bs-warm-orange)]">{counts.exception ?? 0}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Pendiente total</p><div className="mt-2 space-y-1 text-lg text-[var(--bs-text-primary)]">{sums.map(([currency, total]) => total.pending > 0 && <p key={currency}>{formatMoney(total.pending, currency)}</p>)}</div></div>
        </div>
      </section>

      <section className="bg-[var(--bs-surface-primary)]">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setStatus(tab.key)} className={`min-h-10 px-3 text-xs ${status === tab.key ? 'bg-[var(--bs-surface-elevated)] text-[var(--bs-text-primary)]' : 'bg-[var(--bs-surface-secondary)] text-[var(--bs-text-secondary)] hover:text-[var(--bs-text-primary)]'}`}>{tab.label} · {counts[tab.key] ?? 0}</button>)}</div>
          {status === 'ready' && filtered.length > 0 && <Button onClick={() => void approve(Array.from(selected.size ? selected : new Set(filtered.map((row) => row.id))))} disabled={busy}><CheckCircle2 className="mr-2 h-4 w-4" />{selected.size ? `Aprobar ${selected.size}` : `Aprobar todas (${filtered.length})`}</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]"><tr>{['ready','exception','manual_review'].includes(status) && <th className="w-12 px-4 py-3 font-normal"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} aria-label="Seleccionar todos" /></th>}<th className="px-4 py-3 font-normal">Proveedor / documento</th><th className="px-4 py-3 font-normal">Centro / categoría</th><th className="px-4 py-3 text-right font-normal">Total</th><th className="px-4 py-3 font-normal">Evidencia</th><th className="px-4 py-3 font-normal">Razón</th><th className="px-4 py-3 text-right font-normal">Acción</th></tr></thead>
            <tbody>
              {filtered.map((row) => {
                const canDecide = ['ready','exception','manual_review'].includes(row.classification_status)
                const mapped = Boolean(row.division_name && row.category_name)
                return <tr key={row.id} className="border-t border-[var(--bs-divider-subtle)] align-top">
                  {canDecide && <td className="px-4 py-4"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`Seleccionar ${row.document_number}`} /></td>}
                  <td className="px-4 py-4"><p className="text-[var(--bs-text-primary)]">{row.supplier_name}</p><p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.document_number} · {new Date(`${row.document_date}T00:00:00`).toLocaleDateString('es-CL')}{row.supplier_rut ? ` · ${row.supplier_rut}` : ''}</p>{row.description && <p className="mt-2 max-w-72 text-xs leading-5 text-[var(--bs-text-secondary)]">{row.description}</p>}</td>
                  <td className="px-4 py-4"><p className="text-[var(--bs-text-primary)]">{row.division_name ?? 'Centro P&L por validar'}</p><p className="mt-1 text-xs text-[var(--bs-text-secondary)]">{row.category_name ?? 'Categoría Budget pendiente'}</p>{row.cost_center_name && <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.cost_center_code ? `${row.cost_center_code} · ` : ''}{row.cost_center_name}</p>}</td>
                  <td className="px-4 py-4 text-right"><p className="text-[var(--bs-text-primary)]">{formatMoney(row.total_amount, row.currency)}</p>{row.net_amount != null && <p className="mt-1 text-xs text-[var(--bs-text-muted)]">Neto {formatMoney(row.net_amount, row.currency)}</p>}</td>
                  <td className="px-4 py-4 text-xs leading-5 text-[var(--bs-text-secondary)]"><p>Confianza {row.confidence_label ?? (row.confidence == null ? '—' : pct.format(n(row.confidence)))}</p><p>{row.historical_count} antecedentes · dominio {row.historical_dominance == null ? '—' : pct.format(n(row.historical_dominance))}</p><p className={row.amount_in_range === false ? 'text-[var(--bs-warm-orange)]' : row.amount_in_range === true ? 'text-[var(--bs-cool-sage)]' : 'text-[var(--bs-text-muted)]'}>{row.amount_in_range == null ? 'Rango no disponible' : row.amount_in_range ? 'Monto dentro de rango' : 'Monto fuera de rango'}</p></td>
                  <td className="px-4 py-4"><div className="flex max-w-80 gap-2 text-xs leading-5 text-[var(--bs-text-secondary)]">{row.classification_status === 'ready' ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-cool-sage)]" /> : row.classification_status === 'exception' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-warm-orange)]" /> : <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-cool-sky)]" />}<span>{row.classification_reason ?? row.decision_notes ?? 'Sin explicación registrada.'}{!mapped ? ' · Falta mapeo canónico para postear al Budget.' : ''}</span></div></td>
                  <td className="px-4 py-4 text-right">{canDecide ? <div className="flex justify-end gap-2"><Button size="sm" onClick={() => void approve([row.id])} disabled={busy || !mapped}><Check className="mr-2 h-4 w-4" />Aprobar</Button><Button size="sm" variant="outline" onClick={() => void reject(row)} disabled={busy}><X className="mr-2 h-4 w-4" />Rechazar</Button></div> : <span className="text-xs text-[var(--bs-text-muted)]">{row.classification_status === 'approved' ? 'Cerrado' : 'Rechazado'}</span>}</td>
                </tr>
              })}
              {!loading && !filtered.length && <tr><td colSpan={7} className="px-5 py-12 text-center text-[var(--bs-text-muted)]">No hay documentos en esta cola.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
