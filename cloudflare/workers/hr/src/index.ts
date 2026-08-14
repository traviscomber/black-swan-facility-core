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

const json = (body: JsonRecord, status = 200, requestId?: string) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(requestId ? { 'x-request-id': requestId } : {}),
  },
})

const bearer = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null

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

async function rpc(env: Env, token: string, name: string, payload: JsonRecord = {}) {
  const response = await supabaseFetch(env, `/rest/v1/rpc/${name}`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const detail = await response.text()
    if (response.status === 401) throw new ApiError('unauthorized', 401)
    if (response.status === 403 || detail.includes('HR_TRANSPARENCY_FORBIDDEN')) throw new ApiError('forbidden', 403)
    throw new ApiError('hr_transparency_failed', 409, detail.slice(0, 200) || name)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = request.headers.get('cf-ray') || request.headers.get('x-request-id') || crypto.randomUUID()
    const version = env.API_VERSION || 'v1'
    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === `/${version}/health`) {
        return json({ status: 'ok', service: 'black-swan-hr', request_id: id }, 200, id)
      }
      if (request.method !== 'GET') throw new ApiError('method_not_allowed', 405)

      const token = await requireUser(request, env)
      if (url.pathname === `/${version}/hr/entities`) {
        return json({ data: await rpc(env, token, 'list_hr_transparency_entities'), request_id: id }, 200, id)
      }

      const entityMatch = url.pathname.match(new RegExp(`^/${version}/hr/entities/([0-9a-fA-F-]{36})$`))
      if (entityMatch) {
        return json({ data: await rpc(env, token, 'get_entity_hr_transparency', { p_legal_entity_id: entityMatch[1] }), request_id: id }, 200, id)
      }

      throw new ApiError('not_found', 404)
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError('internal_error', 500)
      console.error(JSON.stringify({ service: 'black-swan-hr', request_id: id, route: url.pathname, error_code: normalized.code, status_code: normalized.status }))
      return json({ error: { code: normalized.code, message: normalized.message, request_id: id } }, normalized.status, id)
    }
  },
}
