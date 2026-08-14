type JsonRecord = Record<string, unknown>

export interface Env {
  API_VERSION: string
  ENVIRONMENT: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
}

class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) {
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

const bearerToken = (request: Request) => {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  return header.slice(7).trim() || null
}

const requestId = (request: Request) =>
  request.headers.get("cf-ray") || request.headers.get("x-request-id") || crypto.randomUUID()

async function supabaseFetch(env: Env, path: string, token: string, init: RequestInit = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new ApiError("supabase_not_configured", 503)
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

async function requireUser(request: Request, env: Env) {
  const token = bearerToken(request)
  if (!token) throw new ApiError("unauthorized", 401)

  const response = await supabaseFetch(env, "/auth/v1/user", token)
  if (!response.ok) throw new ApiError("unauthorized", 401)
  return { token, user: await response.json() as JsonRecord }
}

async function listReviewQueue(env: Env, token: string, status: string | null) {
  const allowedStatuses = new Set(["received", "extracting", "classified", "review", "approved", "rejected"])
  const requested = status && allowedStatuses.has(status) ? status : null
  const filter = requested
    ? `&status=eq.${encodeURIComponent(requested)}`
    : "&status=in.(classified,review)"

  const response = await supabaseFetch(
    env,
    "/rest/v1/accounting_document_intake?select=id,source_file_name,source_storage_path,status,requires_review,proposed_document_type,proposed_legal_entity_id,proposed_counterparty_id,proposed_document_number,proposed_document_date,proposed_due_date,proposed_currency,proposed_net_amount,proposed_tax_amount,proposed_total_amount,proposed_direction,proposed_department_id,proposed_cost_center_id,proposed_account_code,confidence,model_provider,model_name,created_at&order=created_at.asc" + filter,
    token,
  )

  if (!response.ok) throw new ApiError("review_queue_failed", 502)
  return await response.json()
}

async function getReviewDetail(env: Env, token: string, intakeId: string) {
  const response = await supabaseFetch(
    env,
    `/rest/v1/accounting_document_intake?select=*&id=eq.${encodeURIComponent(intakeId)}&limit=1`,
    token,
  )

  if (!response.ok) throw new ApiError("review_detail_failed", 502)
  const rows = await response.json() as JsonRecord[]
  if (!rows[0]) throw new ApiError("not_found", 404)
  return rows[0]
}

async function submitReview(env: Env, token: string, intakeId: string, request: Request) {
  const payload = await request.json() as JsonRecord
  const decision = typeof payload.decision === "string" ? payload.decision : ""
  if (!new Set(["approved", "rejected", "returned"]).has(decision)) {
    throw new ApiError("invalid_decision", 400)
  }

  const correctedFields = payload.corrected_fields && typeof payload.corrected_fields === "object"
    ? payload.corrected_fields
    : {}
  const notes = typeof payload.notes === "string" ? payload.notes : null

  const response = await supabaseFetch(env, "/rest/v1/rpc/review_accounting_intake", token, {
    method: "POST",
    body: JSON.stringify({
      p_intake_id: intakeId,
      p_decision: decision,
      p_corrected_fields: correctedFields,
      p_notes: notes,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error(JSON.stringify({ event: "accounting_review_failed", status: response.status, detail: detail.slice(0, 500) }))
    if (response.status === 401) throw new ApiError("unauthorized", 401)
    if (response.status === 403) throw new ApiError("forbidden", 403)
    throw new ApiError("review_submit_failed", 502)
  }

  return await response.json()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = requestId(request)
    const version = env.API_VERSION || "v1"
    const base = `/${version}`
    const url = new URL(request.url)

    try {
      if (request.method === "GET" && url.pathname === `${base}/health`) {
        return json({ status: "ok", service: "black-swan-accounting", version, request_id: id }, 200, id)
      }

      const auth = await requireUser(request, env)

      if (request.method === "GET" && url.pathname === `${base}/accounting/review`) {
        const data = await listReviewQueue(env, auth.token, url.searchParams.get("status"))
        return json({ data, request_id: id }, 200, id)
      }

      const detailMatch = url.pathname.match(new RegExp(`^/${version}/accounting/review/([0-9a-fA-F-]{36})$`))
      if (detailMatch && request.method === "GET") {
        const data = await getReviewDetail(env, auth.token, detailMatch[1])
        return json({ data, request_id: id }, 200, id)
      }

      if (detailMatch && request.method === "POST") {
        const data = await submitReview(env, auth.token, detailMatch[1], request)
        return json({ data, request_id: id }, 200, id)
      }

      throw new ApiError("not_found", 404)
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError("internal_error", 500)
      console.error(JSON.stringify({
        level: normalized.status >= 500 ? "error" : "warning",
        service: "black-swan-accounting",
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
