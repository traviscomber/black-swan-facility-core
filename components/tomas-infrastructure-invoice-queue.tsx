'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, FileText, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { financeAllocationLabel } from '@/lib/finance/budget-display'

type InfrastructureInvoice = {
  id: string
  supplierName: string
  documentNumber: string
  documentDate: string
  dueDate: string | null
  description: string | null
  totalAmount: number | string
  currency: string
  divisionName: string | null
  divisionKey: string | null
  categoryName: string | null
  operationalLabel: string | null
  reviewStatus: string
  reviewNotes: string | null
  hasSourceFile: boolean
}

function money(value: unknown, currency: string) {
  const amount = Number(value ?? 0)
  try {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: currency === 'CLP' ? 0 : 2 }).format(amount)
  } catch {
    return `${amount.toLocaleString('es-CL')} ${currency}`
  }
}

export function TomasInfrastructureInvoiceQueue() {
  const supabase = useMemo(() => createClient(), [])
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [rows, setRows] = useState<InfrastructureInvoice[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const permission = await supabase.rpc('can_review_infrastructure_invoices')
    if (permission.error || !permission.data) {
      setAllowed(false)
      return
    }
    setAllowed(true)
    const result = await supabase.rpc('get_infrastructure_invoice_review_queue')
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    setRows((result.data ?? []) as InfrastructureInvoice[])
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function decide(row: InfrastructureInvoice, decision: 'approved' | 'rejected') {
    const notes = decision === 'rejected'
      ? window.prompt(`Motivo para observar/rechazar ${row.supplierName} · ${row.documentNumber}`)
      : null
    if (decision === 'rejected' && !notes?.trim()) return

    setBusy(row.id)
    const result = await supabase.rpc('review_infrastructure_finance_document', {
      p_document_id: row.id,
      p_decision: decision,
      p_notes: notes?.trim() || null,
    })
    if (result.error) toast.error(result.error.message)
    else toast.success(decision === 'approved'
      ? 'Revisada · enviada a Santiago para pago.'
      : 'Observada · enviada a Santiago con el motivo.')
    await load()
    setBusy(null)
  }

  if (allowed === false) return null
  if (allowed === null) return <div className="p-6 text-sm text-muted-foreground">Cargando facturas de infraestructura…</div>

  return (
    <div className="space-y-4 p-4 md:p-8">
      <section className="bg-[var(--bs-surface-primary)] p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Tomás · Infraestructura</p>
            <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Facturas por revisar</h2>
            <p className="mt-1 text-sm text-[var(--bs-text-secondary)]">Revisa la factura. Aprueba u observa. En ambos casos continúa Santiago.</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-4 text-2xl text-[var(--bs-text-primary)]">{rows.length}</p>
      </section>

      <section className="divide-y bg-[var(--bs-surface-primary)]">
        {rows.map((row) => (
          <article key={row.id} className="grid gap-4 p-4 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
            <div className="min-w-0">
              <p className="font-medium text-[var(--bs-text-primary)]">{row.supplierName}</p>
              <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{row.documentNumber} · {new Date(`${row.documentDate}T00:00:00`).toLocaleDateString('es-CL')}</p>
              {row.description && <p className="mt-2 line-clamp-2 text-xs text-[var(--bs-text-secondary)]">{row.description}</p>}
            </div>
            <div>
              <p className="text-sm text-[var(--bs-text-primary)]">{money(row.totalAmount, row.currency)}</p>
              <p className="mt-1 text-xs text-[var(--bs-text-muted)]">{[financeAllocationLabel(row.divisionName, row.categoryName, row.divisionKey), row.operationalLabel].filter(Boolean).join(' · ')}</p>
              {row.hasSourceFile && <a className="mt-2 inline-flex items-center gap-1 text-xs underline" href={`/api/finance/sii-invoices/source?documentId=${encodeURIComponent(row.id)}`} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" />Ver factura</a>}
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex">
              <Button size="sm" onClick={() => void decide(row, 'approved')} disabled={busy === row.id}><Check className="mr-1 h-4 w-4" />Aprobar</Button>
              <Button size="sm" variant="outline" onClick={() => void decide(row, 'rejected')} disabled={busy === row.id}><X className="mr-1 h-4 w-4" />Observar</Button>
            </div>
          </article>
        ))}
        {!rows.length && <p className="p-6 text-sm text-[var(--bs-text-secondary)]">Sin facturas de infraestructura pendientes.</p>}
      </section>
    </div>
  )
}
