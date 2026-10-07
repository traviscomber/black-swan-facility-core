'use client'

import { useRef, useState } from 'react'
import { ChevronDown, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { parseRaimundoFinanceWorkbook, type RaimundoFinancePreview } from '@/lib/raimundo-finance-workbook'

export function RaimundoFinanceImport() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<RaimundoFinancePreview | null>(null)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [open, setOpen] = useState(false)

  async function inspect(nextFile: File) {
    setReading(true)
    setFile(nextFile)
    try {
      setPreview(await parseRaimundoFinanceWorkbook(await nextFile.arrayBuffer()))
      setOpen(true)
    } catch (error) {
      setPreview(null)
      setFile(null)
      toast.error(error instanceof Error ? error.message : 'No fue posible leer el workbook.')
    } finally {
      setReading(false)
    }
  }

  async function importWorkbook() {
    if (!preview) return
    setImporting(true)
    try {
      const supabase = createClient()
      if (preview.format === 'operational_report') {
        const { data, error } = await supabase.rpc('import_raimundo_operational_report', {
          p_workbook_hash: preview.workbookHash,
          p_centers: preview.centers,
          p_documents: preview.documents,
          p_paid_observations: preview.paidObservations,
        })
        if (error) throw error
        const result = data as {
          pending_inserted?: number
          pending_updated?: number
          paid_observed?: number
          unmatched_paid?: number
        } | null
        toast.success(
          `Conciliación cargada · ${result?.pending_inserted ?? 0} pendientes nuevos · ${result?.pending_updated ?? 0} actualizados · ${result?.paid_observed ?? 0} pagos observados${result?.unmatched_paid ? ` · ${result.unmatched_paid} pagos históricos sin documento canónico` : ''}.`,
        )
      } else {
        const { data, error } = await supabase.rpc('import_raimundo_finance_workbook', {
          p_workbook_hash: preview.workbookHash,
          p_centers: preview.centers,
          p_rules: preview.rules,
          p_documents: preview.documents,
        })
        if (error) throw error
        const result = data as { centers?: number; rules?: number; documents_inserted?: number } | null
        toast.success(`Importación lista: ${result?.rules ?? preview.rules.length} reglas y ${result?.documents_inserted ?? 0} documentos nuevos.`)
      }

      window.dispatchEvent(new Event('finance-workbook-imported'))
      setPreview(null)
      setFile(null)
      setOpen(false)
      if (inputRef.current) inputRef.current.value = ''
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible importar el workbook.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="mx-4 mb-8 bg-[var(--bs-surface-primary)] md:mx-8">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between p-5 text-left">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-text-muted)]">Fuente financiera</p>
          <p className="mt-1 text-sm text-[var(--bs-text-primary)]">Actualizar conciliación Valentina → Raimundo</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-[var(--bs-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && <div className="border-t border-[var(--bs-divider-subtle)] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <p className="max-w-3xl text-sm leading-6 text-[var(--bs-text-secondary)]">
            Acepta el workbook canónico y el INFORME operacional con hojas PAGADO y PENDIENTE AGRICOLA(LISTADO).
            Los centros ya confirmados se reutilizan; sólo las imputaciones nuevas o ambiguas vuelven a Raimundo.
            Un pago visto en el informe queda como evidencia observada y no reemplaza la conciliación bancaria.
          </p>
          <div className="flex gap-2">
            <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={(event) => { const next = event.target.files?.[0]; if (next) void inspect(next) }} />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={reading || importing}><UploadCloud className="mr-2 h-4 w-4" />{reading ? 'Leyendo…' : 'Seleccionar Excel'}</Button>
            {preview && <Button onClick={() => void importWorkbook()} disabled={importing}><FileSpreadsheet className="mr-2 h-4 w-4" />{importing ? 'Importando…' : preview.format === 'operational_report' ? 'Cargar conciliación' : 'Importar'}</Button>}
          </div>
        </div>

        {preview && <div className="mt-5 grid gap-3 md:grid-cols-5">
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs text-[var(--bs-text-muted)]">Archivo</p><p className="mt-2 truncate text-sm text-[var(--bs-text-primary)]">{file?.name}</p><p className="mt-1 text-[11px] text-[var(--bs-text-muted)]">{preview.format === 'operational_report' ? 'Informe operacional' : 'Workbook canónico'}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs text-[var(--bs-text-muted)]">Centros</p><p className="mt-2 text-lg text-[var(--bs-text-primary)]">{preview.centers.length}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs text-[var(--bs-text-muted)]">Pendientes</p><p className="mt-2 text-lg text-[var(--bs-warm-yellow)]">{preview.counts.pending_observed}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs text-[var(--bs-text-muted)]">Pagos observados</p><p className="mt-2 text-lg text-[var(--bs-cool-sage)]">{preview.counts.paid_observed}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs text-[var(--bs-text-muted)]">{preview.format === 'canonical' ? 'Reglas históricas' : 'Confirmación'}</p><p className="mt-2 text-lg text-[var(--bs-text-primary)]">{preview.format === 'canonical' ? preview.rules.length : 'Raimundo'}</p></div>
        </div>}
      </div>}
    </section>
  )
}
