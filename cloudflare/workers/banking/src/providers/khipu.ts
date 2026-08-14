import type { FinancialProviderAdapter, NormalizedPaymentEvent } from './types'

export const khipuAdapter: FinancialProviderAdapter = {
  key: 'khipu',
  capabilities: {
    bankMovements: true,
    balances: true,
    paymentInitiation: true,
    cardPayments: false,
    webhooks: true,
    polling: true,
    chileNative: true,
  },

  // Khipu v3 webhooks carry x-khipu-signature. The exact signing implementation
  // is intentionally activated only after the merchant secret is configured and
  // validated against Khipu's sandbox. Fail closed until then.
  async verifyWebhook() {
    return false
  },

  async parsePaymentEvent(request: Request): Promise<NormalizedPaymentEvent> {
    const payload = await request.clone().json() as Record<string, unknown>
    const paymentId = String(payload.payment_id || payload.id || '')
    const statusRaw = String(payload.status || payload.payment_status || '')
    return {
      providerEventId: String(payload.notification_id || payload.event_id || paymentId),
      providerPaymentId: paymentId,
      eventType: String(payload.event_type || 'payment.notification'),
      status: normalizeStatus(statusRaw),
      amount: typeof payload.amount === 'number' ? payload.amount : undefined,
      currency: typeof payload.currency === 'string' ? payload.currency : undefined,
      externalReference: typeof payload.transaction_id === 'string' ? payload.transaction_id : null,
      occurredAt: typeof payload.conciliation_date === 'string' ? payload.conciliation_date : typeof payload.created_at === 'string' ? payload.created_at : null,
      rawPayload: payload,
    }
  },
}

function normalizeStatus(value: string): NormalizedPaymentEvent['status'] {
  const v = value.toLowerCase()
  if (v.includes('done') || v.includes('paid') || v.includes('completed')) return 'paid'
  if (v.includes('fail') || v.includes('rejected')) return 'failed'
  if (v.includes('refund')) return 'refunded'
  if (v.includes('cancel')) return 'cancelled'
  if (v.includes('pending') || v.includes('created') || v.includes('verif')) return 'pending'
  return 'unknown'
}
