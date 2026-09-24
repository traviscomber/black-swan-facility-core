'use client'

import { useEffect, useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Statement = { id: string; original_filename: string; period_start: string; period_end: string; status: string; created_at: string }

export function BankStatementDropzone() {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Statement[]>([])

  async function load() {
    const response = await fetch('/api/finance/bank-statements')
    if (response.ok) setRows(((await response.json()) as { rows: Statement[] }).rows)
  }
  useEffect(() => { void load() }, [])

  async function upload() {
    if (!file || !start || !end) { toast.error('Selecciona una cartola y el período cubierto.'); return }
    setBusy(true)
    try {
      const body = new FormData()
      body.set('file', file); body.set('period_start', start); body.set('period_end', end)
      const response = await fetch('/api/finance/bank-statements', { method: 'POST', body })
      const result = await response.json() as { error?: string; status?: string }
      if (!response.ok) throw new Error(result.error ?? 'No fue posible guardar la cartola.')
      toast.success(result.status === 'duplicate' ? 'Esta cartola ya se había recibido.' : 'Cartola recibida y pendiente de revisión.')
      setFile(null); if (input.current) input.current.value = ''
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No fue posible guardar la cartola.') }
    finally { setBusy(false) }
  }

  return <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] p-5 md:mx-8 md:p-6">
    <p className="text-xs uppercase tracking-[.14em] text-[var(--bs-cool-sage)]">Entrada bancaria · Semanal</p>
    <h2 className="mt-2 text-xl text-[var(--bs-text-primary)]">Cartola o conciliación del banco</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--bs-text-secondary)]">Sube el PDF, CSV o XLSX original e indica el período. Se conserva privado como evidencia y queda pendiente de revisión; la carga no marca facturas como pagadas automáticamente.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_170px_auto] sm:items-end">
      <label className="text-xs text-[var(--bs-text-muted)]">Archivo PDF, CSV o XLSX<input ref={input} type="file" accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="mt-1 block h-10 w-full border border-[var(--bs-divider-subtle)] px-2 py-2 text-sm" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
      <label className="text-xs text-[var(--bs-text-muted)]">Desde<input type="date" value={start} onChange={event => setStart(event.target.value)} className="mt-1 h-10 w-full bg-[var(--bs-surface-secondary)] px-2 text-sm" /></label>
      <label className="text-xs text-[var(--bs-text-muted)]">Hasta<input type="date" value={end} onChange={event => setEnd(event.target.value)} className="mt-1 h-10 w-full bg-[var(--bs-surface-secondary)] px-2 text-sm" /></label>
      <Button onClick={() => void upload()} disabled={busy || !file}><FileUp className="mr-2 h-4 w-4" />{busy ? 'Guardando…' : 'Subir cartola'}</Button>
    </div>
    {rows.length > 0 && <div className="mt-6 border-t border-[var(--bs-divider-subtle)] pt-4"><h3 className="text-sm text-[var(--bs-text-primary)]">Últimas cartolas</h3><div className="mt-3 divide-y divide-[var(--bs-divider-subtle)]">{rows.map(row => <div key={row.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs text-[var(--bs-text-secondary)]"><span><a className="underline" href={`/api/finance/bank-statements/source?id=${encodeURIComponent(row.id)}`} target="_blank" rel="noreferrer">{row.original_filename}</a> · {row.period_start} → {row.period_end}</span><span>{row.status === 'pending_review' ? 'Pendiente de conciliación' : row.status === 'reviewed' ? 'Revisada' : 'Rechazada'}</span></div>)}</div></div>}
  </section>
}
