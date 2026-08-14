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

const bearerToken = (request: Request) => {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

const requestId = (request: Request) =>
  request.headers.get('cf-ray') || request.headers.get('x-request-id') || crypto.randomUUID()

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
  const token = bearerToken(request)
  if (!token) throw new ApiError('unauthorized', 401)
  const response = await supabaseFetch(env, '/auth/v1/user', token)
  if (!response.ok) throw new ApiError('unauthorized', 401)
  return token
}

async function report(env: Env, token: string, entityId: string, reportType: string, from: string | null, to: string | null) {
  const response = await supabaseFetch(env, '/rest/v1/rpc/get_entity_financial_report', token, {
    method: 'POST',
    body: JSON.stringify({
      p_legal_entity_id: entityId,
      p_report_type: reportType,
      p_from: from || null,
      p_to: to || null,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    if (response.status === 401) throw new ApiError('unauthorized', 401)
    if (response.status === 403 || detail.includes('FINANCIAL_REPORT_FORBIDDEN')) throw new ApiError('forbidden', 403)
    throw new ApiError('financial_report_failed', 409, detail.slice(0, 200) || 'financial_report_failed')
  }

  return await response.json()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = requestId(request)
    const version = env.API_VERSION || 'v1'
    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === `/${version}/health`) {
        return json({ status: 'ok', service: 'black-swan-finance', version, request_id: id }, 200, id)
      }

      if (request.method !== 'GET') throw new ApiError('method_not_allowed', 405)
      const token = await requireUser(request, env)
      const match = url.pathname.match(new RegExp(`^/${version}/finance/entities/([0-9a-fA-F-]{36})/(pl|balance-sheet|cash-flow|cash-status|revenue-donations)$`))
      if (!match) throw new ApiError('not_found', 404)

      const reportTypeMap: Record<string, string> = {
        'pl': 'pl',
        'balance-sheet': 'balance_sheet',
        'cash-flow': 'cash_flow',
        'cash-status': 'cash_status',
        'revenue-donations': 'revenue_donations',
      }

      const data = await report(
        env,
        token,
        match[1],
        reportTypeMap[match[2]],
        url.searchParams.get('from'),
        url.searchParams.get('to'),
      )
      return json({ data, request_id: id }, 200, id)
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError('internal_error', 500)
      console.error(JSON.stringify({
        level: normalized.status >= 500 ? 'error' : 'warning',
        service: 'black-swan-finance',
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
