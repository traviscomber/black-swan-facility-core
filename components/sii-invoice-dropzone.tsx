'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileText, Loader2, UploadCloud, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'
import { SiiPdfMetadataForm } from '@/components/sii-pdf-metadata-form'

type UploadResult = {
  filename: string
  upload_id?: string
  document_id?: string | null
  status: string
  classification_status?: string
  duplicate?: boolean
  error?: string
}

type PendingPdf = {
  id: string
  original_filename: string
  created_at: string
}

function statusCopy(row: UploadResult) {
  if (row.status === 'ready' || row.status === 'classified') return 'Clasificada · lista para decisión de Raimundo'
  if (row.status === 'pending_mapping' || row.status === 'linked') return 'Recibida · clasificación canónica pendiente'
  if (row.status === 'needs_metadata') return 'PDF guardado · completa los datos fiscales para enviarlo a clasificación'
  if (row.status === 'duplicate') return 'Ya existía · no se creó un segundo documento'
  if (row.status === 'failed') return row.error ?? 'No fue posible procesar el archivo'
  return row.status
}

export function SiiInvoiceDropzone() {
  const { language } = useLanguage()
  const supabase = useMemo(() => createClient(), [])
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const [pendingPdfs, setPendingPdfs] = useState<PendingPdf[]>([])

  const loadPending = useCallback(async () => {
    const { data, error } = await supabase
      .from('finance_sii_uploads')
      .select('id,original_filename,created_at')
      .eq('upload_kind', 'pdf')
      .eq('status', 'needs_metadata')
      .is('finance_document_id', null)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!error) setPendingPdfs((data ?? []) as PendingPdf[])
  }, [supabase])

  useEffect(() => { void loadPending() }, [loadPending])
  useEffect(() => {
    const refresh = () => void loadPending()
    window.addEventListener('finance-sii-uploaded', refresh)
    return () => window.removeEventListener('finance-sii-uploaded', refresh)
  }, [loadPending])

  const upload = useCallback(async (files: File[]) => {
    if (!files.length || uploading) return
    if (files.length > 10) {
      toast.error('Puedes subir hasta 10 archivos por lote.')
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      files.forEach((file) => form.append('files', file))
      const response = await fetch('/api/finance/sii-invoices', { method: 'POST', body: form })
      const payload = await response.json() as { error?: string; results?: UploadResult[] }
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible subir las facturas.')

      const next = payload.results ?? []
      setResults(next)
      const created = next.filter((row) => row.document_id && !row.duplicate).length
      const pending = next.filter((row) => row.status === 'needs_metadata').length
      const failed = next.filter((row) => row.status === 'failed').length
      if (created) toast.success(`${created} documento${created === 1 ? '' : 's'} recibido${created === 1 ? '' : 's'} por Finance.`)
      if (pending) toast.success(`${pending} PDF${pending === 1 ? '' : 's'} guardado${pending === 1 ? '' : 's'} · completa los datos fiscales abajo.`)
      if (failed) toast.error(failed === 1 ? '1 archivo no pudo procesarse.' : `${failed} archivos no pudieron procesarse.`)
      window.dispatchEvent(new Event('finance-workbook-imported'))
      window.dispatchEvent(new Event('finance-sii-uploaded'))
      await loadPending()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible subir las facturas.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [loadPending, uploading])

  return (
    <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] md:mx-8">
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Entrada SII · Manual</p>
            <h2 className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">Subir facturas para clasificación y aprobación</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">
              Arrastra PDF o XML del SII. El XML extrae los datos fiscales; un PDF solo queda guardado de forma privada y solicita los datos mínimos antes de entrar a clasificación. Raimundo conserva la decisión final.
            </p>
          </div>
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {uploading ? 'Procesando…' : 'Seleccionar archivos'}
          </Button>
        </div>

        <input ref={inputRef} type="file" multiple accept=".pdf,.xml,application/pdf,application/xml,text/xml" className="hidden" onChange={(event) => void upload(Array.from(event.target.files ?? []))} />

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={(event) => { event.preventDefault(); setDragging(false) }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)) }}
          className={`mt-5 flex min-h-40 w-full flex-col items-center justify-center px-6 text-center transition-colors ${dragging ? 'bg-[var(--bs-surface-elevated)]' : 'bg-[var(--bs-surface-secondary)] hover:bg-[var(--bs-surface-elevated)]'} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {uploading ? <Loader2 className="h-7 w-7 animate-spin text-[var(--bs-warm-yellow)]" /> : <UploadCloud className="h-7 w-7 text-[var(--bs-warm-yellow)]" />}
          <p className="mt-3 text-sm text-[var(--bs-text-primary)]">Arrastra aquí las facturas SII</p>
          <p className="mt-1 text-xs text-[var(--bs-text-muted)]">PDF o XML · máximo 15 MB por archivo · hasta 10 por lote</p>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-[var(--bs-text-secondary)]">PDF-only también funciona: el archivo se conserva privado y el sistema pide proveedor, RUT, folio, fecha y total antes de crear el documento canónico.</p>
        </button>

        {results.length > 0 && (
          <div className="mt-5 divide-y divide-[var(--bs-divider-subtle)] bg-[var(--bs-surface-secondary)]">
            {results.map((row, index) => {
              const failed = row.status === 'failed'
              return (
                <div key={`${row.filename}-${index}`} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {failed ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-warm-orange)]" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-cool-sage)]" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--bs-text-primary)]">{row.filename}</p>
                      <p className="mt-1 text-xs text-[var(--bs-text-secondary)]">{statusCopy(row)}</p>
                    </div>
                  </div>
                  {row.document_id && (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" asChild><a href={`/api/finance/sii-invoices/source?documentId=${encodeURIComponent(row.document_id)}`} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />Ver original</a></Button>
                      <Button size="sm" asChild><a href={`/${language}/budgets/approvals`}>Ir a aprobación</a></Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {pendingPdfs.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--bs-warm-yellow)]">PDF pendientes de datos fiscales · {pendingPdfs.length}</p>
            <div className="mt-3 space-y-3">
              {pendingPdfs.map((pdf) => (
                <SiiPdfMetadataForm
                  key={pdf.id}
                  uploadId={pdf.id}
                  filename={pdf.original_filename}
                  onCompleted={() => {
                    setPendingPdfs((current) => current.filter((row) => row.id !== pdf.id))
                    void loadPending()
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
