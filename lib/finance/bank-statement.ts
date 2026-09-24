import * as XLSX from 'xlsx'

export type BankStatementRow = {
  transaction_date: string
  amount: number
  currency: string
  direction: 'debit' | 'credit'
  description: string | null
  bank_reference: string | null
  counterparty_name: string | null
  raw_payload: Record<string, unknown>
}

const aliases = {
  date: ['fecha','date','transaction date','fecha movimiento','fecha transaccion','fecha transacción','posting date'],
  amount: ['monto','amount','importe','valor','monto clp'],
  debit: ['cargo','debit','debe','egreso','retiro','cargos'],
  credit: ['abono','credit','haber','ingreso','deposito','depósito','abonos'],
  description: ['descripcion','descripción','description','detalle','glosa','concepto'],
  reference: ['referencia','reference','ref','nro documento','n° documento','documento','folio'],
  counterparty: ['contraparte','counterparty','beneficiario','proveedor','nombre','destinatario'],
  currency: ['moneda','currency','divisa'],
} as const

function key(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function pick(row: Record<string, unknown>, names: readonly string[]) {
  const entries = Object.entries(row)
  for (const alias of names) {
    const normalized = key(alias)
    const found = entries.find(([name]) => key(name) === normalized)
    if (found && String(found[1] ?? '').trim()) return found[1]
  }
  return null
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const cleaned = raw.replace(/\s/g, '').replace(/\$/g, '').replace(/CLP|USD|EUR/gi, '')
  const negative = /^-/.test(cleaned) || /^\(.*\)$/.test(cleaned)
  const unsigned = cleaned.replace(/[()-]/g, '')
  let normalized = unsigned
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(unsigned)) normalized = unsigned.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(unsigned)) normalized = unsigned.replace(/,/g, '')
  else if (unsigned.includes(',') && !unsigned.includes('.')) normalized = unsigned.replace(',', '.')
  normalized = normalized.replace(/[^0-9.]/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return negative ? -parsed : parsed
}

function isoDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number' && value > 20000) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y.toString().padStart(4,'0')}-${String(parsed.m).padStart(2,'0')}-${String(parsed.d).padStart(2,'0')}`
  }
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const direct = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (direct) return `${direct[1]}-${direct[2].padStart(2,'0')}-${direct[3].padStart(2,'0')}`
  const latam = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (latam) return `${latam[3]}-${latam[2].padStart(2,'0')}-${latam[1].padStart(2,'0')}`
  const parsed = new Date(raw)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0,10) : null
}

function mapGenericRows(rows: Record<string, unknown>[]) {
  const parsed: BankStatementRow[] = []
  for (const raw of rows) {
    const date = isoDate(pick(raw, aliases.date))
    const debit = numberValue(pick(raw, aliases.debit))
    const credit = numberValue(pick(raw, aliases.credit))
    const amountRaw = numberValue(pick(raw, aliases.amount))
    let direction: 'debit' | 'credit'
    let amount: number | null
    if (debit != null && Math.abs(debit) > 0) {
      direction = 'debit'; amount = Math.abs(debit)
    } else if (credit != null && Math.abs(credit) > 0) {
      direction = 'credit'; amount = Math.abs(credit)
    } else if (amountRaw != null && amountRaw !== 0) {
      direction = amountRaw < 0 ? 'debit' : 'credit'
      amount = Math.abs(amountRaw)
    } else continue
    if (!date || !amount || !Number.isFinite(amount)) continue
    parsed.push({
      transaction_date: date,
      amount,
      currency: String(pick(raw, aliases.currency) ?? 'CLP').trim().toUpperCase().slice(0,3) || 'CLP',
      direction,
      description: String(pick(raw, aliases.description) ?? '').trim() || null,
      bank_reference: String(pick(raw, aliases.reference) ?? '').trim() || null,
      counterparty_name: String(pick(raw, aliases.counterparty) ?? '').trim() || null,
      raw_payload: raw,
    })
  }
  return parsed
}

export async function parseBankStatement(bytes: Buffer, filename: string): Promise<BankStatementRow[]> {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'csv' || ext === 'xlsx') {
    const workbook = XLSX.read(bytes, { type: 'buffer', cellDates: true })
    const first = workbook.SheetNames[0]
    if (!first) return []
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[first], { defval: '' })
    return mapGenericRows(rows)
  }

  if (ext !== 'pdf') return []
  const endpoint = process.env.DOCUMENT_AI_ENDPOINT
  if (!endpoint) throw new Error('PDF_BANK_EXTRACTION_NOT_CONFIGURED')
  const token = process.env.DOCUMENT_AI_TOKEN
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      task: 'black_swan_bank_statement_extraction',
      schema_version: '1',
      file: { name: filename, content_type: 'application/pdf', base64: bytes.toString('base64') },
      schema: {
        transactions: [{
          transaction_date: 'YYYY-MM-DD',
          amount: 'positive number',
          direction: 'debit|credit',
          currency: 'ISO-4217',
          description: 'string|null',
          bank_reference: 'string|null',
          counterparty_name: 'string|null',
        }],
      },
      rules: [
        'Extract only transactions visible in the statement.',
        'Amounts must be positive; use direction to distinguish debit and credit.',
        'Do not invent missing references or counterparties.',
      ],
    }),
  })
  if (!response.ok) throw new Error(`Bank statement extraction failed (${response.status})`)
  const payload = await response.json() as { transactions?: unknown[]; data?: { transactions?: unknown[] } }
  const source = payload.transactions ?? payload.data?.transactions ?? []
  return mapGenericRows((Array.isArray(source) ? source : []).filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')))
}

function normalized(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export type FinanceMatchCandidate = {
  id: string
  supplier_name: string
  document_number: string
  document_date: string
  due_date: string | null
  total_amount: number | string
  currency: string
}

export function matchBankRow(row: BankStatementRow, candidates: FinanceMatchCandidate[]) {
  if (row.direction !== 'debit') return null
  const text = normalized([row.description,row.bank_reference,row.counterparty_name].filter(Boolean).join(' '))
  const eligible = candidates.filter((doc) => {
    if (String(doc.currency || 'CLP').toUpperCase() !== row.currency.toUpperCase()) return false
    if (Math.abs(Number(doc.total_amount) - row.amount) > 0.5) return false
    const docDate = new Date(`${doc.document_date}T00:00:00Z`).getTime()
    const txDate = new Date(`${row.transaction_date}T00:00:00Z`).getTime()
    return Number.isFinite(docDate) && Number.isFinite(txDate) && txDate >= docDate - 86400000 && txDate - docDate <= 120 * 86400000
  })
  if (!eligible.length) return null

  const scored = eligible.map((doc) => {
    let confidence = 0.65
    const number = normalized(doc.document_number)
    const supplier = normalized(doc.supplier_name)
    if (number && text.includes(number)) confidence += 0.2
    const supplierTokens = supplier.split(' ').filter((token) => token.length >= 4)
    const tokenHits = supplierTokens.filter((token) => text.includes(token)).length
    if (supplierTokens.length && tokenHits >= Math.min(2, supplierTokens.length)) confidence += 0.2
    const delta = Math.abs(new Date(`${row.transaction_date}T00:00:00Z`).getTime() - new Date(`${doc.document_date}T00:00:00Z`).getTime()) / 86400000
    if (delta <= 30) confidence += 0.1
    return { document: doc, confidence: Math.min(1, confidence) }
  }).sort((a,b) => b.confidence - a.confidence)

  const best = scored[0]
  const second = scored[1]
  if (!best || best.confidence < 0.85) return null
  if (second && best.confidence - second.confidence < 0.1) return null
  return { ...best, reason: 'amount_currency_date_plus_reference_or_supplier' }
}
