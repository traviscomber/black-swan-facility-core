'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Props = {
  uploadId: string
  filename: string
  onCompleted: (result: { document_id?: string | null; status?: string }) => void
}

type FormState = {
  supplier_name: string
  supplier_rut: string
  document_number: string
  document_date: string
  due_date: string
  document_type: 'invoice' | 'credit_note' | 'debit_note' | 'other'
  net_amount: string
  tax_amount: string
  total_amount: string
  currency: string
}

const initialState: FormState = {
  supplier_name: '',
  supplier_rut: '',
  document_number: '',
  document_date: '',
  due_date: '',
  document_type: 'invoice',
  net_amount: '',
  tax_amount: '',
  total_amount: '',
  currency: 'CLP',
}

function fieldClass() {
  return 'mt-1 h-10 w-full bg-[var(--bs-bg-primary)] px-3 text-sm text-[var(--bs-text-primary)] outline-none ring-0 focus:bg-[var(--bs-surface-elevated)]'
}

export function SiiPdfMetadataForm({ uploadId, filename, onCompleted }: Props) {
  const [form, setForm] = useState<FormState>(initialState)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit() {
    if (!form.supplier_name.trim() || !form.supplier_rut.trim() || !form.document_number.trim() || !form.document_date || !form.total_amount.trim()) {
      toast.error('Completa proveedor, RUT, folio, fecha y total.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/finance/sii-invoices', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          upload_id: uploadId,
          metadata: {
            ...form,
            net_amount: form.net_amount || null,
            tax_amount: form.tax_amount || null,
            due_date: form.due_date || null,
          },
        }),
      })
      const payload = await response.json() as { error?: string; result?: { document_id?: string | null; status?: string } }
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible completar la factura PDF.')

      toast.success(payload.result?.status === 'ready' ? 'Factura clasificada y enviada a decisión de Raimundo.' : 'Factura creada y enviada a clasificación.')
      window.dispatchEvent(new Event('finance-sii-uploaded'))
      window.dispatchEvent(new Event('finance-workbook-imported'))
      onCompleted(payload.result ?? {})
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible completar la factura PDF.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 bg-[var(--bs-surface-primary)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Completar PDF</p>
          <p className="mt-1 text-sm text-[var(--bs-text-primary)]">{filename}</p>
          <p className="mt-1 text-xs text-[var(--bs-text-secondary)]">Los datos se registran como metadata manual; Raimundo mantiene la aprobación final.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/finance/sii-invoices/source?uploadId=${encodeURIComponent(uploadId)}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir PDF</a>
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-[var(--bs-text-muted)]">Proveedor<input className={fieldClass()} value={form.supplier_name} onChange={(event) => update('supplier_name', event.target.value)} /></label>
        <label className="text-xs text-[var(--bs-text-muted)]">RUT proveedor<input className={fieldClass()} placeholder="12.345.678-9" value={form.supplier_rut} onChange={(event) => update('supplier_rut', event.target.value)} /></label>
        <label className="text-xs text-[var(--bs-text-muted)]">Folio<input className={fieldClass()} value={form.document_number} onChange={(event) => update('document_number', event.target.value)} /></label>
        <label className="text-xs text-[var(--bs-text-muted)]">Tipo<select className={fieldClass()} value={form.document_type} onChange={(event) => update('document_type', event.target.value as FormState['document_type'])}><option value="invoice">Factura</option><option value="credit_note">Nota de crédito</option><option value="debit_note">Nota de débito</option><option value="other">Otro</option></select></label>
        <label className="text-xs text-[var(--bs-text-muted)]">Fecha emisión<input type="date" className={fieldClass()} value={form.document_date} onChange={(event) => update('document_date', event.target.value)} /></label>
        <label className="text-xs text-[var(--bs-text-muted)]">Fecha vencimiento<input type="date" className={fieldClass()} value={form.due_date} onChange={(event) => update('due_date', event.target.value)} /></label>
        <label className="text-xs text-[var(--bs-text-muted)]">Neto<input inputMode="decimal" className={fieldClass()} value={form.net_amount} onChange={(event) => update('net_amount', event.target.value)} /></label>
        <label className="text-xs text-[var(--bs-text-muted)]">IVA<input inputMode="decimal" className={fieldClass()} value={form.tax_amount} onChange={(event) => update('tax_amount', event.target.value)} /></label>
        <label className="text-xs text-[var(--bs-text-muted)]">Total<input inputMode="decimal" className={fieldClass()} value={form.total_amount} onChange={(event) => update('total_amount', event.target.value)} /></label>
        <label className="text-xs text-[var(--bs-text-muted)]">Moneda<input maxLength={3} className={fieldClass()} value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></label>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={() => void submit()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{saving ? 'Guardando…' : 'Crear y clasificar factura'}</Button>
      </div>
    </div>
  )
}
