import type { FinancialProviderAdapter } from './types'

export const transbankAdapter: FinancialProviderAdapter = {
  key: 'transbank',
  capabilities: {
    bankMovements: false,
    balances: false,
    paymentInitiation: false,
    cardPayments: true,
    webhooks: true,
    polling: false,
    chileNative: true,
  },

  // Webpay confirmation is adapter-specific and must be validated through the
  // official transaction commit/status flow with the configured commerce code
  // and API key. Until those credentials exist, generic webhook trust is denied.
  async verifyWebhook() {
    return false
  },
}
