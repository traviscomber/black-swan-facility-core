import { handleProviderWebhook, WebhookError } from './provider-webhooks'
import { listProviderCapabilities } from './providers'
import { createTuuRemotePayment, getTuuRemotePayment } from './providers/tuu'

type JsonRecord = Record<string, unknown>

export interface Env {
  API_VERSION: string
  ENVIRONMENT: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  BANK_WEBHOOK_MACHINE_TOKEN?: string
  FINANCIAL_PROVIDER_WEBHOOK_SECRETS_JSON?: string
  TUU_API_KEY?: string
  TUU_DEVICE_SERIAL?: string
}

class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) { super(message) }
}

const json = (body: JsonRecord, status = 200, requestId?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
  })

const bearer = (request: Request) => {
  const header = request.headers.get('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : null
}

async function supabaseFetch(env: Env, path: string, token: string, init: RequestInit = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new ApiError('supabase_not_configured', 503)
  return fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
}

async function requireUser(request: Request, env: Env) {
  const token = bearer(request)
  if (!token) throw new ApiError('unauthorized', 401)
  const response = await supabaseFetch(env, '/auth/v1/user', token)
  if (!response.ok) throw new ApiError('unauthorized', 401)
  return token
}

async function rpc(env: Env, token: string, name: string, payload: JsonRecord) {
  const response = await supabaseFetch(env, `/rest/v1/rpc/${name}`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const detail = await response.text()
    if (response.status === 401) throw new ApiError('unauthorized', 401)
    if (response.status === 403) throw new ApiError('forbidden', 403)
    throw new ApiError('banking_operation_failed', 409, detail.slice(0, 200) || name)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function listCash(env: Env, token: string, entityId: string | null) {
  const filter = entityId ? `&legal_entity_id=eq.${encodeURIComponent(entityId)}` : ''
  const response = await supabaseFetch(
    env,
    `/rest/v1/cash_transactions?select=id,legal_entity_id,bank_account_id,transaction_date,value_date,direction,amount,currency,bank_reference,description,reconciliation_status,status,provider_transaction_id,created_at&order=transaction_date.desc${filter}`,
    token,
  )
  if (!response.ok) throw new ApiError('cash_lookup_failed', 502)
  return await response.json()
}

async function listProposals(env: Env, token: string, cashId: string) {
  const response = await supabaseFetch(
    env,
    `/rest/v1/accounting_reconciliation_matches?select=id,legal_entity_id,cash_transaction_id,accounting_document_id,matched_amount,match_method,confidence,status,proposed_by,reviewed_by,reviewed_at,notes,created_at&cash_transaction_id=eq.${encodeURIComponent(cashId)}&order=confidence.desc`,
    token,
  )
  if (!response.ok) throw new ApiError('reconciliation_lookup_failed', 502)
  return await response.json()
}

async function reviewProposal(env: Env, token: string, matchId: string, request: Request) {
  const payload = await request.json() as JsonRecord
  const decision = typeof payload.decision === 'string' ? payload.decision : ''
  if (!new Set(['approved', 'rejected']).has(decision)) throw new ApiError('invalid_decision', 400)
  return rpc(env, token, 'review_reconciliation_match', {
    p_match_id: matchId,
    p_decision: decision,
    p_notes: typeof payload.notes === 'string' ? payload.notes : null,
  })
}

function requireTuu(env: Env) {
  if (!env.TUU_API_KEY || !env.TUU_DEVICE_SERIAL) throw new ApiError('tuu_not_configured', 503)
  return { apiKey: env.TUU_API_KEY, device: env.TUU_DEVICE_SERIAL }
}

async function createTuuPayment(env: Env, token: string, request: Request) {
  const body = await request.json() as JsonRecord
  const registrationId = typeof body.registration_id === 'string' ? body.registration_id : ''
  const amount = Number(body.amount_clp)
  if (!registrationId) throw new ApiError('registration_required', 400)
  if (!Number.isInteger(amount) || amount < 100 || amount > 99999999) throw new ApiError('invalid_amount', 400)
  const tuu = requireTuu(env)

  const prepared = await rpc(env, token, 'prepare_tuu_remote_payment', {
    p_registration_id: registrationId,
    p_amount_clp: amount,
    p_dte_type: body.dte_type == null ? 0 : Number(body.dte_type),
    p_payment_method: body.payment_method == null || body.payment_method === '' ? null : Number(body.payment_method),
    p_description: typeof body.description === 'string' ? body.description : null,
  }) as JsonRecord

  const requestId = String(prepared.request_id || '')
  try {
    const provider = await createTuuRemotePayment(tuu.apiKey, {
      idempotencyKey: String(prepared.idempotency_key),
      amount: Number(prepared.amount_clp),
      device: tuu.device,
      description: String(prepared.description || 'Black Swan event payment'),
      dteType: Number(prepared.dte_type ?? 0),
      paymentMethod: prepared.payment_method == null ? null : Number(prepared.payment_method),
    })
    const recorded = await rpc(env, token, 'record_tuu_remote_payment_result', {
      p_request_id: requestId,
      p_provider_status: provider.normalizedStatus,
      p_provider_status_code: provider.statusCode,
      p_provider_request_id: provider.providerRequestId,
      p_sequence_number: provider.sequenceNumber,
      p_provider_payload: provider.raw,
      p_last_error: null,
    })
    return { request: recorded, provider: provider.raw, device_serial_configured: true }
  } catch (error) {
    const details = error as Error & { status?: number; payload?: JsonRecord }
    await rpc(env, token, 'record_tuu_remote_payment_result', {
      p_request_id: requestId,
      p_provider_status: 'failed',
      p_provider_status_code: null,
      p_provider_request_id: null,
      p_sequence_number: null,
      p_provider_payload: details.payload || {},
      p_last_error: details.message,
    }).catch(() => undefined)
    if (details.status === 429) throw new ApiError('tuu_rate_limited', 429, details.message)
    if (details.status === 401) throw new ApiError('tuu_unauthorized', 502, details.message)
    throw new ApiError('tuu_create_failed', 502, details.message)
  }
}

async function refreshTuuPayment(env: Env, token: string, requestId: string) {
  const tuu = requireTuu(env)
  const current = await rpc(env, token, 'get_tuu_remote_payment', { p_request_id: requestId }) as JsonRecord
  const idempotencyKey = String(current.idempotency_key || '')
  if (!idempotencyKey) throw new ApiError('tuu_idempotency_missing', 409)
  try {
    const provider = await getTuuRemotePayment(tuu.apiKey, idempotencyKey)
    return await rpc(env, token, 'record_tuu_remote_payment_result', {
      p_request_id: requestId,
      p_provider_status: provider.normalizedStatus,
      p_provider_status_code: provider.statusCode,
      p_provider_request_id: provider.providerRequestId,
      p_sequence_number: provider.sequenceNumber,
      p_provider_payload: provider.raw,
      p_last_error: null,
    })
  } catch (error) {
    const details = error as Error & { status?: number; payload?: JsonRecord }
    if (details.status === 404) throw new ApiError('tuu_payment_not_found', 404)
    if (details.status === 401) throw new ApiError('tuu_unauthorized', 502)
    throw new ApiError('tuu_status_failed', 502, details.message)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = request.headers.get('cf-ray') || request.headers.get('x-request-id') || crypto.randomUUID()
    const version = env.API_VERSION || 'v1'
    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === `/${version}/health`) {
        return json({ status: 'ok', service: 'black-swan-banking', request_id: id }, 200, id)
      }

      if (request.method === 'GET' && url.pathname === `/${version}/banking/providers`) {
        return json({ data: listProviderCapabilities(), request_id: id }, 200, id)
      }

      const webhookMatch = url.pathname.match(new RegExp(`^/${version}/banking/webhooks/(fintoc|khipu|transbank|stripe)/([0-9a-fA-F-]{36})$`))
      if (webhookMatch && request.method === 'POST') {
        const data = await handleProviderWebhook(request, env, webhookMatch[1], webhookMatch[2])
        return json({ data, request_id: id }, 200, id)
      }

      const token = await requireUser(request, env)

      if (request.method === 'POST' && url.pathname === `/${version}/banking/tuu/payments`) {
        return json({ data: await createTuuPayment(env, token, request), request_id: id }, 201, id)
      }

      const tuuStatus = url.pathname.match(new RegExp(`^/${version}/banking/tuu/payments/([0-9a-fA-F-]{36})$`))
      if (tuuStatus && request.method === 'GET') {
        return json({ data: await refreshTuuPayment(env, token, tuuStatus[1]), request_id: id }, 200, id)
      }

      if (request.method === 'GET' && url.pathname === `/${version}/banking/cash-transactions`) {
        return json({ data: await listCash(env, token, url.searchParams.get('entity_id')), request_id: id }, 200, id)
      }

      const proposals = url.pathname.match(new RegExp(`^/${version}/banking/cash-transactions/([0-9a-fA-F-]{36})/reconciliation-proposals$`))
      if (proposals && request.method === 'GET') {
        return json({ data: await listProposals(env, token, proposals[1]), request_id: id }, 200, id)
      }
      if (proposals && request.method === 'POST') {
        return json({ data: await rpc(env, token, 'propose_reconciliation_matches', { p_cash_transaction_id: proposals[1] }), request_id: id }, 200, id)
      }

      const reviewMatch = url.pathname.match(new RegExp(`^/${version}/banking/reconciliation-matches/([0-9a-fA-F-]{36})/review$`))
      if (reviewMatch && request.method === 'POST') {
        return json({ data: await reviewProposal(env, token, reviewMatch[1], request), request_id: id }, 200, id)
      }

      throw new ApiError('not_found', 404)
    } catch (error) {
      const normalized = error instanceof WebhookError
        ? new ApiError(error.code, error.status)
        : error instanceof ApiError
          ? error
          : new ApiError('internal_error', 500)
      console.error(JSON.stringify({
        level: normalized.status >= 500 ? 'error' : 'warning',
        service: 'black-swan-banking',
        request_id: id,
        method: request.method,
        route: url.pathname,
        error_code: normalized.code,
        status_code: normalized.status,
      }))
      return json({ error: { code: normalized.code, message: normalized.message, request_id: id } }, normalized.status, id)
    }
  },
}
