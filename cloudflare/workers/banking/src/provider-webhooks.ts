import { getProviderAdapter } from './providers'

export type WebhookEnv = {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  BANK_WEBHOOK_MACHINE_TOKEN?: string
  FINANCIAL_PROVIDER_WEBHOOK_SECRETS_JSON?: string
}

export class WebhookError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code) }
}

function connectionSecret(env: WebhookEnv, connectionId: string) {
  if (!env.FINANCIAL_PROVIDER_WEBHOOK_SECRETS_JSON) return null
  try {
    const map = JSON.parse(env.FINANCIAL_PROVIDER_WEBHOOK_SECRETS_JSON) as Record<string, string>
    return typeof map[connectionId] === 'string' ? map[connectionId] : null
  } catch {
    return null
  }
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function appendVerifiedEvent(
  env: WebhookEnv,
  connectionId: string,
  providerEventId: string,
  eventType: string,
  rawBody: string,
) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.BANK_WEBHOOK_MACHINE_TOKEN) {
    throw new WebhookError('bank_webhook_not_configured', 503)
  }

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/record_verified_bank_provider_event`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      p_machine_token: env.BANK_WEBHOOK_MACHINE_TOKEN,
      p_bank_connection_id: connectionId,
      p_provider_event_id: providerEventId,
      p_event_type: eventType,
      p_payload_hash: await sha256Hex(rawBody),
      p_raw_payload: JSON.parse(rawBody),
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error(JSON.stringify({ event: 'provider_webhook_append_failed', status: response.status, detail: detail.slice(0, 300) }))
    throw new WebhookError('provider_event_append_failed', 502)
  }

  return await response.json()
}

export async function handleProviderWebhook(request: Request, env: WebhookEnv, providerKey: string, connectionId: string) {
  const adapter = getProviderAdapter(providerKey)
  if (!adapter || !adapter.capabilities.webhooks) throw new WebhookError('provider_webhook_unsupported', 404)
  const secret = connectionSecret(env, connectionId)
  if (!secret) throw new WebhookError('provider_webhook_secret_missing', 503)

  const rawBody = await request.clone().text()
  const valid = await adapter.verifyWebhook(request.clone(), secret)
  if (!valid) throw new WebhookError('invalid_provider_signature', 401)

  let payload: Record<string, unknown>
  try { payload = JSON.parse(rawBody) as Record<string, unknown> } catch { throw new WebhookError('invalid_provider_payload', 400) }

  const normalized = adapter.parsePaymentEvent ? await adapter.parsePaymentEvent(request.clone()) : null
  const providerEventId = normalized?.providerEventId || String(payload.id || payload.payment_id || payload.token_ws || '')
  const eventType = normalized?.eventType || String(payload.type || payload.status || 'provider.event')
  if (!providerEventId) throw new WebhookError('provider_event_id_missing', 400)

  const result = await appendVerifiedEvent(env, connectionId, providerEventId, eventType, rawBody)
  return { provider: providerKey, connection_id: connectionId, event: normalized, ledger: result }
}
