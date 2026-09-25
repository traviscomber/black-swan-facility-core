import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  parseManualPdfMetadata,
  parseSiiXml,
  siiBaseName,
  siiExtension,
} from '../lib/finance/sii-invoice.ts'

const routeUrl = new URL('../app/api/finance/sii-invoices/route.ts', import.meta.url)
const dropzoneUrl = new URL('../components/sii-invoice-dropzone.tsx', import.meta.url)
const loginUrl = new URL('../app/auth/login/page.tsx', import.meta.url)
const approvalQueueUrl = new URL('../components/finance-approval-queue.tsx', import.meta.url)
const approvalsPageUrl = new URL('../app/budgets/approvals/page.tsx', import.meta.url)
const raimundoHomeMigrationUrl = new URL('../supabase/migrations/20260925205500_santiago_focused_workspace.sql', import.meta.url)

test('SII file extension and pairing normalization are strict', () => {
  assert.equal(siiExtension('FACTURA.PDF'), 'pdf')
  assert.equal(siiExtension('factura.xml'), 'xml')
  assert.equal(siiExtension('factura.exe'), null)
  assert.equal(siiBaseName('  FACTURA-123.PDF  '), 'factura-123')
  assert.equal(siiBaseName('factura-123.xml'), 'factura-123')
})

test('SII XML parser extracts canonical Chilean invoice fields', () => {
  const xml = '<?xml version="1.0" encoding="ISO-8859-1"?>' +
    '<DTE><Documento><Encabezado>' +
    '<IdDoc><TipoDTE>33</TipoDTE><Folio>12345</Folio><FchEmis>2026-09-24</FchEmis><FchVenc>2026-10-24</FchVenc></IdDoc>' +
    '<Emisor><RUTEmisor>76.123.456-7</RUTEmisor><RznSoc>Proveedor QA SpA</RznSoc></Emisor>' +
    '<Totales><MntNeto>100000</MntNeto><IVA>19000</IVA><MntTotal>119000</MntTotal></Totales>' +
    '</Encabezado></Documento></DTE>'
  const parsed = parseSiiXml(xml)

  assert.equal(parsed.document_type, 'invoice')
  assert.equal(parsed.sii_document_type, '33')
  assert.equal(parsed.document_number, '12345')
  assert.equal(parsed.document_date, '2026-09-24')
  assert.equal(parsed.due_date, '2026-10-24')
  assert.equal(parsed.supplier_rut, '76.123.456-7')
  assert.equal(parsed.supplier_name, 'Proveedor QA SpA')
  assert.equal(parsed.net_amount, 100000)
  assert.equal(parsed.tax_amount, 19000)
  assert.equal(parsed.total_amount, 119000)
  assert.equal(parsed.currency, 'CLP')
})

test('SII XML parser maps notes and rejects missing canonical identifiers at route contract', () => {
  assert.equal(parseSiiXml('<DTE><TipoDTE>61</TipoDTE></DTE>').document_type, 'credit_note')
  assert.equal(parseSiiXml('<DTE><TipoDTE>56</TipoDTE></DTE>').document_type, 'debit_note')

  const source = readFileSync(routeUrl, 'utf8')
  assert.match(source, /!parsedPayload\.sii_document_type\s*\|\|\s*!parsedPayload\.supplier_rut\s*\|\|\s*!parsedPayload\.document_number/)
  assert.match(source, /El XML no parece contener una DTE SII válida/)
})

test('manual PDF fiscal metadata accepts complete data and rejects unsafe shapes', () => {
  const valid = parseManualPdfMetadata({
    supplier_name: 'Proveedor QA SpA',
    supplier_rut: '76.123.456-7',
    document_number: '12345',
    document_date: '2026-09-24',
    due_date: '2026-10-24',
    document_type: 'invoice',
    net_amount: 100000,
    tax_amount: 19000,
    total_amount: 119000,
    currency: 'clp',
  })

  assert.ok(valid)
  assert.equal(valid.currency, 'CLP')
  assert.equal(valid.total_amount, 119000)

  assert.equal(parseManualPdfMetadata({ supplier_name: 'Proveedor' }), null)
  assert.equal(parseManualPdfMetadata({
    supplier_name: 'Proveedor',
    supplier_rut: '1-9',
    document_number: '1',
    document_date: '24-09-2026',
    document_type: 'invoice',
    total_amount: 1,
    currency: 'CLP',
  }), null)
  assert.equal(parseManualPdfMetadata({
    supplier_name: 'Proveedor',
    supplier_rut: '1-9',
    document_number: '1',
    document_date: '2026-09-24',
    document_type: 'invoice',
    total_amount: -1,
    currency: 'CLP',
  }), null)
})

test('upload route enforces Maribel-compatible least privilege and safe file handling', () => {
  const source = readFileSync(routeUrl, 'utf8')

  assert.match(source, /finance\.document_upload/)
  assert.match(source, /finance\.adjust/)
  assert.match(source, /MAX_FILE_BYTES\s*=\s*15\s*\*\s*1024\s*\*\s*1024/)
  assert.match(source, /MAX_FILES\s*=\s*10/)
  assert.match(source, /bytes\.subarray\(0,\s*5\)\.toString\('ascii'\)\s*!==\s*'%PDF-'/)
  assert.match(source, /createHash\('sha256'\)/)
  assert.match(source, /\.eq\('file_hash',\s*hash\)/)
  assert.match(source, /register_sii_finance_upload/)
  assert.match(source, /storage\.from\(BUCKET\)\.remove\(\[storagePath\]\)/)
  assert.match(source, /\.eq\('uploaded_by',\s*authorization\.user\.id\)/)
  assert.match(source, /Only PDF uploads use manual metadata completion/)
})


test('PDF intake attempts automatic fiscal extraction before manual fallback', () => {
  const source = readFileSync(routeUrl, 'utf8')
  const extractionSource = readFileSync(new URL('../lib/finance/sii-pdf-extraction.ts', import.meta.url), 'utf8')

  assert.match(source, /extractSiiPdfFiscalMetadata/)
  assert.match(source, /finalize_sii_pdf_upload/)
  assert.match(extractionSource, /OPENAI_API_KEY/)
  assert.match(extractionSource, /api\.openai\.com\/v1\/responses/)
  assert.match(extractionSource, /type: 'input_file'/)
  assert.match(extractionSource, /data:application\/pdf;base64/)
  assert.match(extractionSource, /detail: 'high'/)
  assert.doesNotMatch(extractionSource, /DOCUMENT_AI_ENDPOINT/)
  assert.doesNotMatch(extractionSource, /from 'ai'/)
  assert.match(extractionSource, /supplier_name/)
  assert.match(extractionSource, /supplier_rut/)
  assert.match(extractionSource, /document_number/)
  assert.match(extractionSource, /document_date/)
  assert.match(extractionSource, /net_amount/)
  assert.match(extractionSource, /tax_amount/)
  assert.match(extractionSource, /total_amount/)
  assert.match(extractionSource, /No inventes, no completes por contexto y no uses placeholders/)
})


test('finance uploader can see persisted invoice upload history', () => {
  const source = readFileSync(dropzoneUrl, 'utf8')

  assert.match(source, /Mis facturas subidas/)
  assert.match(source, /finance_sii_uploads/)
  assert.match(source, /original_filename,status,finance_document_id,upload_kind,error_message,created_at/)
  assert.match(source, /uploadId=/)
  assert.match(source, /Ver original/)
  assert.match(source, /refreshUploads/)
})


test('Raimundo login honors canonical start path and approvals are the first task', () => {
  const loginSource = readFileSync(loginUrl, 'utf8')
  const queueSource = readFileSync(approvalQueueUrl, 'utf8')
  const pageSource = readFileSync(approvalsPageUrl, 'utf8')
  const migrationSource = readFileSync(raimundoHomeMigrationUrl, 'utf8')

  assert.match(loginSource, /user_access_profiles/)
  assert.match(loginSource, /os_start_path/)
  assert.match(loginSource, /localizedProfileStart/)
  assert.match(migrationSource, /raimundo@blackswn\.org/)
  assert.match(migrationSource, /os_persona_key='raimundo'/)
  assert.match(migrationSource, /os_start_path='\/os'/)

  assert.match(queueSource, /type QueueView = 'review'/)
  assert.match(queueSource, /approval_status === 'pending_mapping' \|\| row\.approval_status === 'ready'/)
  assert.match(queueSource, /Raimundo siempre es el primero en revisar el centro de costo sugerido/)
  assert.match(queueSource, /Pendientes conmigo/)
  assert.match(queueSource, /Asignar imputación/)
  assert.match(queueSource, /Asignar y aprobar/)
  assert.match(queueSource, /Aprobar y enviar a pago/)
  assert.match(queueSource, /Cambiar imputación/)
  assert.match(queueSource, /Cambiar y aprobar/)
  assert.match(queueSource, /assign_finance_document_budget_mapping/)

  assert.ok(pageSource.indexOf('<FinanceApprovalQueue />') < pageSource.indexOf('<SiiSourceReview />'))
})
