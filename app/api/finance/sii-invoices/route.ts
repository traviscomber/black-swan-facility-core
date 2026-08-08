import { createHash, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'finance-sii-invoices'
const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_FILES = 10

type ParsedSiiInvoice = {
  supplier_name: string | null
  supplier_rut: string | null
  document_number: string | null
  document_date: string | null
  due_date: string | null
  document_type: 'invoice' | 'credit_note' | 'debit_note' | 'other'
  sii_document_type: string | null
  net_amount: number | null
  tax_amount: number | null
  total_amount: number | null
  currency: string
  extraction_method: 'sii_xml'
}

function extension(name: string) {
  const value = name.toLowerCase().split('.').pop()
  return value === 'pdf' || value === 'xml' ? value : null
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '').trim().toLowerCase()
}

function xmlValue(xml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = xml.match(new RegExp(`<(?:(?:[\\w.-]+):)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${escaped}>`, 'i'))
  if (!match) return null
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim() || null
}

function money(value: string | null) {
  if (!value) return null
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function mapDocumentType(tipoDte: string | null): ParsedSiiInvoice['document_type'] {
  if (tipoDte === '33' || tipoDte === '34' || tipoDte === '46') return 'invoice'
  if (tipoDte === '61') return 'credit_note'
  if (tipoDte === '56') return 'debit_note'
  return 'other'
}

function parseSiiXml(xml: string): ParsedSiiInvoice {
  const tipoDte = xmlValue(xml, 'TipoDTE')
  return {
    supplier_name: xmlValue(xml, 'RznSoc') ?? xmlValue(xml, 'RznSocEmisor'),
    supplier_rut: xmlValue(xml, 'RUTEmisor') ?? xmlValue(xml, 'RutEmisor'),
    document_number: xmlValue(xml, 'Folio'),
    document_date: xmlValue(xml, 'FchEmis'),
    due_date: xmlValue(xml, 'FchVenc'),
    document_type: mapDocumentType(tipoDte),
    sii_document_type: tipoDte,
    net_amount: money(xmlValue(xml, 'MntNeto')),
    tax_amount: money(xmlValue(xml, 'IVA')),
    total_amount: money(xmlValue(xml, 'MntTotal')),
    currency: (xmlValue(xml, 'TpoMoneda') ?? 'CLP').toUpperCase(),
    extraction_method: 'sii_xml',
  }
}

async function authorizeFinance() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }

  const { data: allowed, error: permissionError } = await supabase.rpc('can_app_action', { p_action_key: 'finance.adjust' })
  if (permissionError || !allowed) return { error: NextResponse.json({ error: 'Finance permission required' }, { status: 403 }) }
  return { user: authData.user }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration is incomplete')
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(request: Request) {
  const authorization = await authorizeFinance()
  if ('error' in authorization) return authorization.error

  try {
    const formData = await request.formData()
    const files = formData.getAll('files').filter((item): item is File => item instanceof File)
    if (!files.length) return NextResponse.json({ error: 'At least one PDF or XML file is required' }, { status: 400 })
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Maximum ${MAX_FILES} files per upload` }, { status: 400 })

    const invalid = files.find((file) => !extension(file.name) || file.size <= 0 || file.size > MAX_FILE_BYTES)
    if (invalid) return NextResponse.json({ error: `Invalid file: ${invalid.name}. Use PDF/XML up to 15 MB each.` }, { status: 400 })

    const admin = adminClient()
    const orderedFiles = [...files].sort((a, b) => Number(extension(b.name) === 'xml') - Number(extension(a.name) === 'xml'))
    const documentByBase = new Map<string, string>()
    const results: Array<Record<string, unknown>> = []

    for (const file of orderedFiles) {
      const ext = extension(file.name)!
      const bytes = Buffer.from(await file.arrayBuffer())
      if (ext === 'pdf' && bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
        results.push({ filename: file.name, status: 'failed', error: 'El archivo no contiene una cabecera PDF válida.' })
        continue
      }

      let parsedPayload: ParsedSiiInvoice | Record<string, never> = {}
      if (ext === 'xml') {
        const xml = bytes.toString('utf8')
        parsedPayload = parseSiiXml(xml)
        if (!parsedPayload.sii_document_type || !parsedPayload.supplier_rut || !parsedPayload.document_number) {
          results.push({ filename: file.name, status: 'failed', error: 'El XML no parece contener una DTE SII válida.' })
          continue
        }
      }

      const hash = createHash('sha256').update(bytes).digest('hex')
      const { data: existingUpload } = await admin
        .from('finance_sii_uploads')
        .select('id,status,finance_document_id')
        .eq('file_hash', hash)
        .maybeSingle()

      if (existingUpload) {
        results.push({ filename: file.name, upload_id: existingUpload.id, document_id: existingUpload.finance_document_id, status: 'duplicate', duplicate: true })
        if (existingUpload.finance_document_id) documentByBase.set(baseName(file.name), existingUpload.finance_document_id)
        continue
      }

      const now = new Date()
      const storagePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${hash}-${randomUUID()}.${ext}`
      const contentType = ext === 'pdf' ? 'application/pdf' : 'application/xml'
      const { error: storageError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType, upsert: false })
      if (storageError) {
        results.push({ filename: file.name, status: 'failed', error: storageError.message })
        continue
      }

      const { data: registration, error: registrationError } = await admin.rpc('register_sii_finance_upload', {
        p_file_hash: hash,
        p_storage_path: storagePath,
        p_original_filename: file.name,
        p_mime_type: contentType,
        p_size_bytes: file.size,
        p_upload_kind: ext,
        p_uploaded_by: authorization.user.id,
        p_parsed_payload: parsedPayload,
      })

      if (registrationError) {
        await admin.storage.from(BUCKET).remove([storagePath])
        results.push({ filename: file.name, status: 'failed', error: registrationError.message })
        continue
      }

      const result = registration as { upload_id?: string; document_id?: string | null; status?: string; classification_status?: string; duplicate?: boolean }
      if (result.document_id) documentByBase.set(baseName(file.name), result.document_id)
      results.push({ filename: file.name, ...result })
    }

    for (const result of results) {
      if (typeof result.filename !== 'string' || !result.upload_id || result.document_id || result.status === 'failed') continue
      const documentId = documentByBase.get(baseName(result.filename))
      if (!documentId || !String(result.filename).toLowerCase().endsWith('.pdf')) continue
      const { error } = await admin.from('finance_sii_uploads').update({ finance_document_id: documentId, status: 'linked', updated_at: new Date().toISOString() }).eq('id', result.upload_id)
      if (!error) {
        result.document_id = documentId
        result.status = 'linked'
      }
    }

    return NextResponse.json({ ok: results.some((row) => row.status !== 'failed'), results })
  } catch (error) {
    console.error('[finance/sii-invoices] upload failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 })
  }
}
