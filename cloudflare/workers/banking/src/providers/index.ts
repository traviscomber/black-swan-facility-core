import type { FinancialProviderAdapter, ProviderKey } from './types'
import { fintocAdapter } from './fintoc'
import { khipuAdapter } from './khipu'
import { transbankAdapter } from './transbank'
import { stripeAdapter } from './stripe'
import { tuuAdapter } from './tuu'

const adapters: Record<ProviderKey, FinancialProviderAdapter> = {
  fintoc: fintocAdapter,
  khipu: khipuAdapter,
  transbank: transbankAdapter,
  stripe: stripeAdapter,
  tuu: tuuAdapter,
}

export function getProviderAdapter(key: string) {
  return adapters[key as ProviderKey] || null
}

export function listProviderCapabilities() {
  return Object.values(adapters).map((adapter) => ({
    key: adapter.key,
    capabilities: adapter.capabilities,
  }))
}

export type { FinancialProviderAdapter, ProviderKey } from './types'
