import { hmacSha256Hex, timingSafeEqualHex } from './crypto'
import type { FinancialProviderAdapter, NormalizedPaymentEvent } from './types'

const MAX_WEBHOOK_AGE_SECONDS = 300

export const stripeAdapter: FinancialProviderAdapter = {
  key: 'stripe',
  capabilities: {
    bankMovements: false,
    balances: false,
    paymentInitiation: false,
    cardPayments: true,
    webhooks: true,
    polling: true,
    chileNative: false,
  },

  async verifyWebhook(request: Request, secret: string) {
    const header = request.headers.get('stripe-signature')
    if (!header || !secret) return false
    const values = header.split(',').map((v) => v.trim())
    const timestamp = values.find((v) => v.startsWith('t='))?.slice(2)
    const signatures = values.filter((v) => v.startsWith('v1=')).map((v) => v.slice(3))
    if (!timestamp || signatures.length === 0) return false
    const ts = Number(timestamp)
    if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_WEBHOOK_AGE_SECONDS) return false
    const rawBody = await request.clone().text()
    const actual = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`)
    return signatures.some((signature) => timingSafeEqualHex(actual, signature))
  },

  async parsePaymentEvent(request: Request): Promise<NormalizedPaymentEvent> {
    const payload = await request.clone().json() as Record<string, unknown>
    const dataEnvelope = (payload.data && typeof payload.data === 'object' ? payload.data : {}) as Record<string, unknown>
    const object = (dataEnvelope.object && typeof dataEnvelope.object === 'object' ? dataEnvelope.object : {}) as Record<string, unknown>
    const type = String(payload.type || 'unknown')
    return {
      providerEventId: String(payload.id || ''),
      providerPaymentId: String(object.payment_intent || object.id || ''),
      eventType: type,
      status: normalizeStatus(type, String(object.status || '')),
      amount: typeof object.amount_received === 'number' ? Number(object.amount_received) / 100 : typeof object.amount === 'number' ? Number(object.amount) / 100 : undefined,
      currency: typeof object.currency === 'string' ? object.currency.toUpperCase() : undefined,
      externalReference: typeof object.client_reference_id === 'string' ? object.client_reference_id : typeof object.description === 'string' ? object.description : null,
      occurredAt: typeof payload.created === 'number' ? new Date(Number(payload.created) * 1000).toISOString() : null,
      rawPayload: payload,
    }
  },
}

function normalizeStatus(type: string, status: string): NormalizedPaymentEvent['status'] {
  const v = `${type} ${status}`.toLowerCase()
  if (v.includes('succeeded') || v.includes('paid')) return 'paid'
  if (v.includes('failed')) return 'failed'
  if (v.includes('refund')) return 'refunded'
  if (v.includes('cancel')) return 'cancelled'
  if (v.includes('pending') || v.includes('processing') || v.includes('requires_')) return 'pending'
  return 'unknown'
}
