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

async function rpc(env: Env, token: string, name: string) {
  const response = await supabaseFetch(env, `/rest/v1/rpc/${name}`, token, {
    method: 'POST',
    body: '{}',
  })
  if (!response.ok) {
    const detail = await response.text()
    if (response.status === 401) throw new ApiError('unauthorized', 401)
    if (response.status === 403 || detail.includes('FORBIDDEN')) throw new ApiError('forbidden', 403)
    throw new ApiError('workspace_failed', 409, detail.slice(0, 220) || name)
  }
  return await response.json()
}

const workspaces: Record<string, string> = {
  people: 'get_people_graph_workspace',
  events: 'get_events_workspace',
  education: 'get_education_workspace',
  'orchard-kitchen': 'get_orchard_kitchen_workspace',
  'event-providers': 'get_event_provider_workspace',
  'front-door': 'get_foundation_front_door_workspace',
  imports: 'get_canonical_import_workspace',
  intercompany: 'get_intercompany_workspace',
  audit: 'get_black_swan_audit_center',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = request.headers.get('cf-ray') || request.headers.get('x-request-id') || crypto.randomUUID()
    const version = env.API_VERSION || 'v1'
    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === `/${version}/health`) {
        return json({ status: 'ok', service: 'black-swan-operations', request_id: requestId }, 200, requestId)
      }

      if (request.method !== 'GET') throw new ApiError('method_not_allowed', 405)
      const token = await requireUser(request, env)

      if (url.pathname === `/${version}/os/navigation`) {
        return json({ data: await rpc(env, token, 'get_black_swan_os_navigation'), request_id: requestId }, 200, requestId)
      }

      const match = url.pathname.match(new RegExp(`^/${version}/os/workspaces/([a-z-]+)$`))
      if (!match || !workspaces[match[1]]) throw new ApiError('not_found', 404)

      return json({ data: await rpc(env, token, workspaces[match[1]]), request_id: requestId }, 200, requestId)
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError('internal_error', 500)
      console.error(JSON.stringify({
        level: normalized.status >= 500 ? 'error' : 'warning',
        service: 'black-swan-operations',
        request_id: requestId,
        route: url.pathname,
        method: request.method,
        error_code: normalized.code,
        status_code: normalized.status,
      }))
      return json({ error: { code: normalized.code, message: normalized.message, request_id: requestId } }, normalized.status, requestId)
    }
  },
}
