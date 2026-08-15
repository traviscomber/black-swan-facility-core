import type { FinancialProviderAdapter } from './types'

type JsonRecord = Record<string, unknown>

export type TuuRemotePaymentInput = {
  idempotencyKey: string
  amount: number
  device: string
  description?: string | null
  dteType?: number
  paymentMethod?: number | null
}

export type TuuRemotePaymentResult = {
  normalizedStatus: 'pending' | 'sent' | 'cancelled' | 'processing' | 'failed' | 'completed'
  statusCode: number | null
  providerRequestId: string | null
  sequenceNumber: string | null
  raw: JsonRecord
}

const CREATE_URL = 'https://integrations.payment.haulmer.com/RemotePayment/v2/Create'
const STATUS_URL = 'https://integrations.payment.haulmer.com/RemotePayment/v2/GetPaymentRequest'

function object(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function first(record: JsonRecord, keys: string[]) {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key]
  return undefined
}

export function normalizeTuuStatus(payload: JsonRecord): TuuRemotePaymentResult {
  const nested = object(first(payload, ['data', 'paymentRequest', 'result']))
  const merged = { ...payload, ...nested }
  const rawStatus = first(merged, ['status', 'Status', 'paymentStatus', 'paymentRequestStatus', 'state', 'State'])
  const numeric = typeof rawStatus === 'number' ? rawStatus : typeof rawStatus === 'string' && /^\d+$/.test(rawStatus) ? Number(rawStatus) : null
  const label = String(rawStatus ?? '').toLowerCase()

  let normalizedStatus: TuuRemotePaymentResult['normalizedStatus'] = 'pending'
  if (numeric === 1 || label === 'sent') normalizedStatus = 'sent'
  else if (numeric === 2 || label === 'canceled' || label === 'cancelled') normalizedStatus = 'cancelled'
  else if (numeric === 3 || label === 'processing') normalizedStatus = 'processing'
  else if (numeric === 4 || label === 'failed') normalizedStatus = 'failed'
  else if (numeric === 5 || label === 'completed') normalizedStatus = 'completed'

  return {
    normalizedStatus,
    statusCode: numeric,
    providerRequestId: String(first(merged, ['id', 'paymentRequestId', 'requestId', 'Id']) ?? '') || null,
    sequenceNumber: String(first(merged, ['sequenceNumber', 'SequenceNumber', 'transactionSequenceNumber']) ?? '') || null,
    raw: payload,
  }
}

async function tuuFetch(url: string, apiKey: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'X-API-Key': apiKey,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  let body: JsonRecord = {}
  try { body = text ? JSON.parse(text) as JsonRecord : {} } catch { body = { raw_text: text } }
  if (!response.ok) {
    const error = new Error(`TUU ${response.status}: ${text.slice(0, 400)}`)
    ;(error as Error & { status?: number; payload?: JsonRecord }).status = response.status
    ;(error as Error & { status?: number; payload?: JsonRecord }).payload = body
    throw error
  }
  return body
}

export async function createTuuRemotePayment(apiKey: string, input: TuuRemotePaymentInput) {
  const body: JsonRecord = {
    IdempotencyKey: input.idempotencyKey,
    Amount: Math.trunc(input.amount),
    Device: input.device,
    Description: input.description || 'Black Swan payment',
    DteType: input.dteType ?? 0,
  }
  if (input.paymentMethod != null) body.PaymentMethod = input.paymentMethod
  body.extraData = {
    sourceName: 'BlackSwanOS',
    sourceVersion: 'v1',
    customFields: [],
  }
  const raw = await tuuFetch(CREATE_URL, apiKey, { method: 'POST', body: JSON.stringify(body) })
  return normalizeTuuStatus(raw)
}

export async function getTuuRemotePayment(apiKey: string, idempotencyKey: string) {
  const raw = await tuuFetch(`${STATUS_URL}/${encodeURIComponent(idempotencyKey)}`, apiKey, { method: 'GET' })
  return normalizeTuuStatus(raw)
}

export const tuuAdapter: FinancialProviderAdapter = {
  key: 'tuu',
  capabilities: {
    bankMovements: false,
    balances: false,
    paymentInitiation: true,
    cardPayments: true,
    webhooks: false,
    polling: true,
    chileNative: true,
  },
  async verifyWebhook() { return false },
}
