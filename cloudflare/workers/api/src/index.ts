export interface Env {
  API_VERSION: string
  ENVIRONMENT: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
}

type JsonRecord = Record<string, unknown>

type AuthContext = {
  token: string
  user: JsonRecord
}

type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "identity_service_unavailable"
  | "entity_service_unavailable"
  | "permission_service_unavailable"
  | "entity_lookup_failed"
  | "permission_lookup_failed"
  | "internal_error"

class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    message = code,
  ) {
    super(message)
  }
}

const json = (body: JsonRecord, status = 200, requestId?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(requestId ? { "x-request-id": requestId } : {}),
    },
  })

const apiError = (error: ApiError, requestId: string) =>
  json(
    {
      error: {
        code: error.code,
        message: error.message,
        request_id: requestId,
      },
    },
    error.status,
    requestId,
  )

const bearerToken = (request: Request) => {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  return header.slice(7).trim() || null
}

function requestId(request: Request) {
  return request.headers.get("cf-ray") || request.headers.get("x-request-id") || crypto.randomUUID()
}

async function supabaseFetch(
  env: Env,
  path: string,
  token: string,
  init: RequestInit = {},
) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new ApiError("internal_error", 503, "Supabase binding is not configured")
  }

  return fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  })
}

async function requireUser(request: Request, env: Env): Promise<AuthContext> {
  const token = bearerToken(request)
  if (!token) throw new ApiError("unauthorized", 401)

  const response = await supabaseFetch(env, "/auth/v1/user", token)
  if (!response.ok) throw new ApiError("unauthorized", 401)

  return { token, user: (await response.json()) as JsonRecord }
}

async function audit(
  env: Env,
  auth: AuthContext | null,
  event: {
    requestId: string
    method: string
    route: string
    action: string
    outcome: "success" | "denied" | "error"
    statusCode: number
    durationMs: number
    legalEntityId?: string | null
    metadata?: JsonRecord
  },
) {
  const actorUserId = auth?.user.id
  if (!auth || typeof actorUserId !== "string" || !actorUserId) return

  try {
    await supabaseFetch(env, "/rest/v1/api_audit_events", auth.token, {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        actor_user_id: actorUserId,
        request_id: event.requestId,
        service: "black-swan-os-api",
        api_version: env.API_VERSION || "v1",
        environment: env.ENVIRONMENT || "unknown",
        method: event.method,
        route: event.route,
        action: event.action,
        legal_entity_id: event.legalEntityId || null,
        outcome: event.outcome,
        status_code: event.statusCode,
        duration_ms: event.durationMs,
        metadata: event.metadata || {},
      }),
    })
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "audit_write_failed",
      request_id: event.requestId,
      message: error instanceof Error ? error.message : "unknown",
    }))
  }
}

async function getEntities(auth: AuthContext, env: Env) {
  const response = await supabaseFetch(
    env,
    "/rest/v1/legal_entities?select=id,code,legal_name,display_name,entity_type,is_commercial,is_nonprofit,active&active=eq.true&order=display_name.asc",
    auth.token,
  )

  if (!response.ok) throw new ApiError("entity_lookup_failed", 502)
  return await response.json()
}

async function getPermissions(auth: AuthContext, env: Env) {
  const userId = String(auth.user.id ?? "")
  if (!userId) throw new ApiError("unauthorized", 401)

  const response = await supabaseFetch(
    env,
    `/rest/v1/user_legal_entity_access?select=legal_entity_id,access_level,effective_from,effective_to&user_id=eq.${encodeURIComponent(userId)}`,
    auth.token,
  )

  if (!response.ok) throw new ApiError("permission_lookup_failed", 502)
  return await response.json()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now()
    const id = requestId(request)
    const url = new URL(request.url)
    const version = env.API_VERSION || "v1"
    const base = `/${version}`
    let auth: AuthContext | null = null
    let action = "unknown"

    try {
      if (request.method !== "GET") {
        throw new ApiError("method_not_allowed", 405)
      }

      if (url.pathname === `${base}/health`) {
        action = "health.read"
        return json(
          {
            status: "ok",
            service: "black-swan-os-api",
            version,
            environment: env.ENVIRONMENT || "unknown",
            request_id: id,
          },
          200,
          id,
        )
      }

      auth = await requireUser(request, env)

      if (url.pathname === `${base}/me`) {
        action = "identity.read_self"
        const response = json({ data: { id: auth.user.id, email: auth.user.email } }, 200, id)
        await audit(env, auth, {
          requestId: id,
          method: request.method,
          route: url.pathname,
          action,
          outcome: "success",
          statusCode: 200,
          durationMs: Date.now() - startedAt,
        })
        return response
      }

      if (url.pathname === `${base}/entities`) {
        action = "entities.read"
        const data = await getEntities(auth, env)
        const response = json({ data }, 200, id)
        await audit(env, auth, {
          requestId: id,
          method: request.method,
          route: url.pathname,
          action,
          outcome: "success",
          statusCode: 200,
          durationMs: Date.now() - startedAt,
        })
        return response
      }

      if (url.pathname === `${base}/permissions`) {
        action = "permissions.read_self"
        const data = await getPermissions(auth, env)
        const response = json({ data }, 200, id)
        await audit(env, auth, {
          requestId: id,
          method: request.method,
          route: url.pathname,
          action,
          outcome: "success",
          statusCode: 200,
          durationMs: Date.now() - startedAt,
        })
        return response
      }

      throw new ApiError("not_found", 404)
    } catch (error) {
      const normalized = error instanceof ApiError
        ? error
        : new ApiError("internal_error", 500, "Unexpected API error")

      console.error(JSON.stringify({
        level: normalized.status >= 500 ? "error" : "warning",
        service: "black-swan-os-api",
        request_id: id,
        method: request.method,
        route: url.pathname,
        action,
        error_code: normalized.code,
        status_code: normalized.status,
      }))

      await audit(env, auth, {
        requestId: id,
        method: request.method,
        route: url.pathname,
        action,
        outcome: normalized.status === 401 || normalized.status === 403 ? "denied" : "error",
        statusCode: normalized.status,
        durationMs: Date.now() - startedAt,
      })

      return apiError(normalized, id)
    }
  },
}
