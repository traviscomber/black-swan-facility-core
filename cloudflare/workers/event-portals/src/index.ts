type JsonRecord = Record<string, unknown>

export interface Env {
  API_VERSION: string
  ENVIRONMENT: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  ALLOWED_ORIGINS?: string
}

class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) { super(message) }
}

function originHeaders(request: Request, env: Env) {
  const origin = request.headers.get('origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean)
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || ''
  return {
    ...(allowOrigin ? { 'access-control-allow-origin': allowOrigin } : {}),
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin',
  }
}

function json(request: Request, env: Env, body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...originHeaders(request, env),
    },
  })
}

async function rpc(env: Env, name: string, payload: JsonRecord) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new ApiError('supabase_not_configured', 503)
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const text = await response.text()
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new ApiError('access_denied', 403)
    throw new ApiError('portal_operation_failed', 409, text.slice(0, 220))
  }
  return text ? JSON.parse(text) : null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: originHeaders(request, env) })
    const url = new URL(request.url)
    const version = env.API_VERSION || 'v1'

    try {
      const portalMatch = url.pathname.match(new RegExp(`^/${version}/events/([a-z0-9-]+)$`))
      if (portalMatch && request.method === 'GET') {
        const secret = url.searchParams.get('access') || ''
        if (!secret) throw new ApiError('access_required', 401)
        const data = await rpc(env, 'resolve_event_guest_portal', { p_slug: portalMatch[1], p_secret: secret })
        if (!data) throw new ApiError('not_found_or_denied', 404)
        return json(request, env, { data })
      }

      const registrationMatch = url.pathname.match(new RegExp(`^/${version}/events/([a-z0-9-]+)/register$`))
      if (registrationMatch && request.method === 'POST') {
        const body = await request.json() as JsonRecord
        const data = await rpc(env, 'register_event_portal_guest', {
          p_slug: registrationMatch[1],
          p_secret: body.access,
          p_full_name: body.full_name,
          p_email: body.email,
          p_phone: body.phone || null,
          p_company_name: body.company_name || null,
          p_dietary_preferences: body.dietary_preferences || null,
          p_allergies: body.allergies || null,
          p_companions: body.companions || [],
          p_consent_data_processing: Boolean(body.consent_data_processing),
          p_consent_marketing: Boolean(body.consent_marketing),
        })
        return json(request, env, { data }, 201)
      }

      throw new ApiError('not_found', 404)
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError('internal_error', 500)
      return json(request, env, { error: { code: normalized.code, message: normalized.message } }, normalized.status)
    }
  },
}
