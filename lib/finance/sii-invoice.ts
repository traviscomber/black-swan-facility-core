export type ParsedSiiInvoice = {
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

export type ManualPdfMetadata = {
  supplier_name: string
  supplier_rut: string
  document_number: string
  document_date: string
  due_date?: string | null
  document_type: 'invoice' | 'credit_note' | 'debit_note' | 'other'
  net_amount?: number | null
  tax_amount?: number | null
  total_amount: number
  currency: string
}

export function siiExtension(name: string) {
  const value = name.toLowerCase().split('.').pop()
  return value === 'pdf' || value === 'xml' ? value : null
}

export function siiBaseName(name: string) {
  return name.replace(/\.[^.]+$/, '').trim().toLowerCase()
}

function xmlValue(xml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
  const pattern = '<(?:(?:[\\w.-]+):)?' + escaped + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?' + escaped + '>'
  const match = xml.match(new RegExp(pattern, 'i'))
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

export function parseSiiXml(xml: string): ParsedSiiInvoice {
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

export function parseManualPdfMetadata(value: unknown): ManualPdfMetadata | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const supplierName = typeof row.supplier_name === 'string' ? row.supplier_name.trim() : ''
  const supplierRut = typeof row.supplier_rut === 'string' ? row.supplier_rut.trim() : ''
  const documentNumber = typeof row.document_number === 'string' ? row.document_number.trim() : ''
  const documentDate = typeof row.document_date === 'string' ? row.document_date.trim() : ''
  const dueDate = typeof row.due_date === 'string' && row.due_date.trim() ? row.due_date.trim() : null
  const documentType = typeof row.document_type === 'string' ? row.document_type : 'invoice'
  const currency = typeof row.currency === 'string' ? row.currency.trim().toUpperCase() : 'CLP'
  const totalAmount = Number(row.total_amount)
  const netAmount = row.net_amount === '' || row.net_amount == null ? null : Number(row.net_amount)
  const taxAmount = row.tax_amount === '' || row.tax_amount == null ? null : Number(row.tax_amount)

  if (!supplierName || !supplierRut || !documentNumber || !/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) return null
  if (!['invoice', 'credit_note', 'debit_note', 'other'].includes(documentType)) return null
  if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(totalAmount) || totalAmount < 0) return null
  if (netAmount != null && (!Number.isFinite(netAmount) || netAmount < 0)) return null
  if (taxAmount != null && (!Number.isFinite(taxAmount) || taxAmount < 0)) return null

  return {
    supplier_name: supplierName,
    supplier_rut: supplierRut,
    document_number: documentNumber,
    document_date: documentDate,
    due_date: dueDate,
    document_type: documentType as ManualPdfMetadata['document_type'],
    net_amount: netAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    currency,
  }
}
