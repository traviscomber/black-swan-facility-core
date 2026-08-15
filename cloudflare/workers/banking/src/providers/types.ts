export type ProviderKey = 'fintoc' | 'khipu' | 'transbank' | 'stripe' | 'tuu'

export type NormalizedBankTransaction = {
  legalEntityId: string
  bankAccountId: string
  providerTransactionId: string
  transactionDate: string
  valueDate?: string | null
  bookedAt?: string | null
  direction: 'inflow' | 'outflow'
  amount: number
  currency: string
  description?: string | null
  bankReference?: string | null
  status?: string
  rawPayload: Record<string, unknown>
}

export type NormalizedBalance = {
  bankAccountId: string
  balanceType: 'available' | 'current' | 'ledger'
  amount: number
  currency: string
  asOf: string
  rawPayload: Record<string, unknown>
}

export type NormalizedPaymentEvent = {
  providerEventId: string
  providerPaymentId: string
  eventType: string
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled' | 'unknown'
  amount?: number
  currency?: string
  externalReference?: string | null
  occurredAt?: string | null
  rawPayload: Record<string, unknown>
}

export type ProviderCapabilities = {
  bankMovements: boolean
  balances: boolean
  paymentInitiation: boolean
  cardPayments: boolean
  webhooks: boolean
  polling: boolean
  chileNative: boolean
}

export interface FinancialProviderAdapter {
  readonly key: ProviderKey
  readonly capabilities: ProviderCapabilities
  verifyWebhook(request: Request, secret: string): Promise<boolean>
  parsePaymentEvent?(request: Request): Promise<NormalizedPaymentEvent>
}
