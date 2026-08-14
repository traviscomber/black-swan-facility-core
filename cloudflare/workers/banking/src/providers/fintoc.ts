import { hmacSha256Hex, timingSafeEqualHex } from './crypto'
import type { FinancialProviderAdapter, NormalizedPaymentEvent } from './types'

const MAX_WEBHOOK_AGE_SECONDS = 300

export const fintocAdapter: FinancialProviderAdapter = {
  key: 'fintoc',
  capabilities: {
    bankMovements: true,
    balances: true,
    paymentInitiation: true,
    cardPayments: false,
    webhooks: true,
    polling: true,
    chileNative: true,
  },

  async verifyWebhook(request: Request, secret: string) {
    const header = request.headers.get('fintoc-signature')
    if (!header || !secret) return false
    const parts = Object.fromEntries(
      header.split(',').map((part) => {
        const [key, ...rest] = part.trim().split('=')
        return [key, rest.join('=')]
      }),
    )
    const timestamp = parts.t
    const expected = parts.v1
    if (!timestamp || !expected) return false

    const timestampNumber = Number(timestamp)
    if (!Number.isFinite(timestampNumber)) return false
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestampNumber)
    if (age > MAX_WEBHOOK_AGE_SECONDS) return false

    const rawBody = await request.clone().text()
    const actual = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`)
    return timingSafeEqualHex(actual, expected)
  },

  async parsePaymentEvent(request: Request): Promise<NormalizedPaymentEvent> {
    const payload = await request.clone().json() as Record<string, unknown>
    const data = (payload.data && typeof payload.data === 'object' ? payload.data : {}) as Record<string, unknown>
    return {
      providerEventId: String(payload.id || ''),
      providerPaymentId: String(data.id || data.payment_id || data.transfer_id || ''),
      eventType: String(payload.type || 'unknown'),
      status: normalizeStatus(String(data.status || payload.type || '')),
      amount: typeof data.amount === 'number' ? data.amount : undefined,
      currency: typeof data.currency === 'string' ? data.currency : undefined,
      externalReference: typeof data.reference === 'string' ? data.reference : null,
      occurredAt: typeof payload.created_at === 'string' ? payload.created_at : null,
      rawPayload: payload,
    }
  },
}

function normalizeStatus(value: string): NormalizedPaymentEvent['status'] {
  const v = value.toLowerCase()
  if (v.includes('succeed') || v.includes('paid') || v.includes('completed')) return 'paid'
  if (v.includes('fail') || v.includes('reject')) return 'failed'
  if (v.includes('refund') || v.includes('return')) return 'refunded'
  if (v.includes('cancel')) return 'cancelled'
  if (v.includes('pending') || v.includes('created') || v.includes('processing')) return 'pending'
  return 'unknown'
}
