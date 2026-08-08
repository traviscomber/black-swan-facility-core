'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, FileText, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type UploadRow = {
  id: string
  original_filename: string
  upload_kind: 'pdf' | 'xml'
  status: string
  finance_document_id: string | null
  created_at: string
}

type DocumentRow = {
  id: string
  supplier_name: string
  document_number: string
  total_amount: number | string
  currency: string
  approval_status: string
}

function amount(value: number | string, currency: string) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  try { return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: currency === 'CLP' ? 0 : 2 }).format(number) }
  catch { return `${number.toLocaleString('es-CL')} ${currency}` }
}

export function SiiSourceReview() {
  const supabase = useMemo(() => createClient(), [])
  const [uploads, setUploads] = useState<UploadRow[]>([])
  const [documents, setDocuments] = useState<Map<string, DocumentRow>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: uploadData } = await supabase
      .from('finance_sii_uploads')
      .select('id,original_filename,upload_kind,status,finance_document_id,created_at')
      .not('finance_document_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(40)

    const rawUploads = (uploadData ?? []) as UploadRow[]
    const bestByDocument = new Map<string, UploadRow>()
    for (const upload of rawUploads) {
      if (!upload.finance_document_id) continue
      const current = bestByDocument.get(upload.finance_document_id)
      if (!current || (upload.upload_kind === 'pdf' && current.upload_kind !== 'pdf')) bestByDocument.set(upload.finance_document_id, upload)
    }
    const nextUploads = Array.from(bestByDocument.values()).slice(0, 12)
    setUploads(nextUploads)

    const ids = nextUploads.map((row) => row.finance_document_id).filter((id): id is string => Boolean(id))
    if (!ids.length) {
      setDocuments(new Map())
      setLoading(false)
      return
    }

    const { data: documentData } = await supabase
      .from('finance_documents')
      .select('id,supplier_name,document_number,total_amount,currency,approval_status')
      .in('id', ids)

    setDocuments(new Map(((documentData ?? []) as DocumentRow[]).map((row) => [row.id, row])))
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const refresh = () => void load()
    window.addEventListener('finance-sii-uploaded', refresh)
    window.addEventListener('finance-workbook-imported', refresh)
    return () => {
      window.removeEventListener('finance-sii-uploaded', refresh)
      window.removeEventListener('finance-workbook-imported', refresh)
    }
  }, [load])

  if (!loading && !uploads.length) return null

  return (
    <section className="mx-4 mt-4 bg-[var(--bs-surface-primary)] md:mx-8">
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-text-muted)]">Evidencia SII</p>
          <p className="mt-1 text-sm text-[var(--bs-text-primary)]">Facturas recientes con archivo fuente privado</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</Button>
      </div>

      <div className="divide-y divide-[var(--bs-divider-subtle)] border-t border-[var(--bs-divider-subtle)]">
        {uploads.map((upload) => {
          const document = upload.finance_document_id ? documents.get(upload.finance_document_id) : null
          return (
            <div key={upload.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bs-cool-sky)]" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--bs-text-primary)]">{document ? `${document.supplier_name} · ${document.document_number}` : upload.original_filename}</p>
                  <p className="mt-1 text-xs text-[var(--bs-text-secondary)]">{document ? `${amount(document.total_amount, document.currency)} · ${document.approval_status}` : upload.status} · fuente {upload.upload_kind.toUpperCase()}</p>
                </div>
              </div>
              {upload.finance_document_id && <Button variant="outline" size="sm" asChild><a href={`/api/finance/sii-invoices/source?documentId=${encodeURIComponent(upload.finance_document_id)}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Ver factura original</a></Button>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
