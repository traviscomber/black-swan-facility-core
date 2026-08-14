export interface Env {
  API_VERSION: string
  ENVIRONMENT: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
}

type JsonRecord = Record<string, unknown>

const json = (body: JsonRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  })

const bearerToken = (request: Request) => {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  return header.slice(7).trim() || null
}

async function supabaseGet(env: Env, path: string, token: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase binding is not configured")
  }

  return fetch(`${env.SUPABASE_URL}${path}`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
    },
  })
}

async function requireUser(request: Request, env: Env) {
  const token = bearerToken(request)
  if (!token) return { error: json({ error: "unauthorized" }, 401) }

  const response = await supabaseGet(env, "/auth/v1/user", token)
  if (!response.ok) return { error: json({ error: "unauthorized" }, 401) }

  return { token, user: (await response.json()) as JsonRecord }
}

async function getEntities(request: Request, env: Env) {
  const auth = await requireUser(request, env)
  if (auth.error) return auth.error

  const response = await supabaseGet(
    env,
    "/rest/v1/legal_entities?select=id,code,legal_name,display_name,entity_type,is_commercial,is_nonprofit,active&active=eq.true&order=display_name.asc",
    auth.token,
  )

  if (!response.ok) return json({ error: "entity_lookup_failed" }, 502)
  return json({ data: await response.json() })
}

async function getPermissions(request: Request, env: Env) {
  const auth = await requireUser(request, env)
  if (auth.error) return auth.error

  const userId = String(auth.user.id ?? "")
  if (!userId) return json({ error: "unauthorized" }, 401)

  const response = await supabaseGet(
    env,
    `/rest/v1/user_legal_entity_access?select=legal_entity_id,access_level,effective_from,effective_to&user_id=eq.${encodeURIComponent(userId)}`,
    auth.token,
  )

  if (!response.ok) return json({ error: "permission_lookup_failed" }, 502)
  return json({ data: await response.json() })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const version = env.API_VERSION || "v1"
    const base = `/${version}`

    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, 405)
    }

    if (url.pathname === `${base}/health`) {
      return json({
        status: "ok",
        service: "black-swan-os-api",
        version,
        environment: env.ENVIRONMENT || "unknown",
      })
    }

    if (url.pathname === `${base}/me`) {
      try {
        const auth = await requireUser(request, env)
        if (auth.error) return auth.error
        return json({ data: { id: auth.user.id, email: auth.user.email } })
      } catch {
        return json({ error: "identity_service_unavailable" }, 503)
      }
    }

    if (url.pathname === `${base}/entities`) {
      try {
        return await getEntities(request, env)
      } catch {
        return json({ error: "entity_service_unavailable" }, 503)
      }
    }

    if (url.pathname === `${base}/permissions`) {
      try {
        return await getPermissions(request, env)
      } catch {
        return json({ error: "permission_service_unavailable" }, 503)
      }
    }

    return json({ error: "not_found" }, 404)
  },
}
