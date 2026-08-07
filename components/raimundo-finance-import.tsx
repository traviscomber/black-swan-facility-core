'use client'

import { useRef, useState } from 'react'
import { FileSpreadsheet, UploadCloud } from 'lucide-react'
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

  async function inspect(nextFile: File) {
    setReading(true)
    setFile(nextFile)
    try {
      setPreview(await parseRaimundoFinanceWorkbook(await nextFile.arrayBuffer()))
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
      const { data, error } = await supabase.rpc('import_raimundo_finance_workbook', {
        p_workbook_hash: preview.workbookHash,
        p_centers: preview.centers,
        p_rules: preview.rules,
        p_documents: preview.documents,
      })
      if (error) throw error
      const result = data as { centers?: number; rules?: number; documents_inserted?: number } | null
      toast.success(`Importación lista: ${result?.rules ?? preview.rules.length} reglas y ${result?.documents_inserted ?? 0} documentos nuevos.`)
      window.dispatchEvent(new Event('finance-workbook-imported'))
      setPreview(null)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible importar el workbook.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] p-5 md:mx-8 md:mt-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Motor Valentina → Raimundo</p>
          <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Importar reglas históricas y bandeja de aprobación</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">
            Acepta el workbook canónico con las hojas APROBACION RAIMUNDO, REGLAS RECURRENTES, CATALOGO CENTROS COSTO y CRITERIO CANONICO. La importación conserva los centros históricos literalmente y no inventa una categoría Budget cuando todavía no existe un mapeo validado.
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={(event) => { const next = event.target.files?.[0]; if (next) void inspect(next) }} />
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={reading || importing}>
            <UploadCloud className="mr-2 h-4 w-4" />{reading ? 'Leyendo…' : 'Seleccionar Excel'}
          </Button>
          {preview && <Button onClick={() => void importWorkbook()} disabled={importing}><FileSpreadsheet className="mr-2 h-4 w-4" />{importing ? 'Importando…' : 'Importar'}</Button>}
        </div>
      </div>

      {preview && (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Archivo</p><p className="mt-2 truncate text-sm text-[var(--bs-text-primary)]">{file?.name}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Reglas</p><p className="mt-2 text-xl text-[var(--bs-text-primary)]">{preview.rules.length}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Centros históricos</p><p className="mt-2 text-xl text-[var(--bs-text-primary)]">{preview.centers.length}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Listas / excepción</p><p className="mt-2 text-xl text-[var(--bs-text-primary)]">{preview.counts.ready} / {preview.counts.exception}</p></div>
          <div className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Revisión manual</p><p className="mt-2 text-xl text-[var(--bs-text-primary)]">{preview.counts.manual_review}</p></div>
        </div>
      )}

      {preview && <p className="mt-3 font-mono text-[10px] text-[var(--bs-text-muted)]">SHA-256 {preview.workbookHash}</p>}
    </section>
  )
}
