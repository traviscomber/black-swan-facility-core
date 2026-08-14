type JsonRecord = Record<string, unknown>

export interface Env {
  API_VERSION: string
  ENVIRONMENT: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = request.headers.get('cf-ray') || request.headers.get('x-request-id') || crypto.randomUUID()
    const version = env.API_VERSION || 'v1'
    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === `/${version}/health`) {
        return json({ status: 'ok', service: 'black-swan-banking', request_id: id }, 200, id)
      }

      const token = await requireUser(request, env)

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
      const normalized = error instanceof ApiError ? error : new ApiError('internal_error', 500)
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
