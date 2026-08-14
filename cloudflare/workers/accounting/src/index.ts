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

async function rpc(env: Env, token: string, name: string, payload: JsonRecord) {
  const response = await supabaseFetch(env, `/rest/v1/rpc/${name}`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error(JSON.stringify({ event: "accounting_rpc_failed", rpc: name, status: response.status, detail: detail.slice(0, 500) }))
    if (response.status === 401) throw new ApiError("unauthorized", 401)
    if (response.status === 403) throw new ApiError("forbidden", 403)
    throw new ApiError("accounting_operation_failed", 409, detail.slice(0, 200) || name)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function listReviewQueue(env: Env, token: string, status: string | null) {
  const allowedStatuses = new Set(["received", "extracting", "classified", "review", "approved", "rejected", "posted"])
  const requested = status && allowedStatuses.has(status) ? status : null
  const filter = requested ? `&status=eq.${encodeURIComponent(requested)}` : "&status=in.(classified,review)"
  const response = await supabaseFetch(
    env,
    "/rest/v1/accounting_document_intake?select=id,source_file_name,source_storage_path,status,requires_review,canonical_document_id,proposed_document_type,proposed_legal_entity_id,proposed_counterparty_id,proposed_document_number,proposed_document_date,proposed_due_date,proposed_currency,proposed_net_amount,proposed_tax_amount,proposed_total_amount,proposed_direction,proposed_department_id,proposed_cost_center_id,proposed_account_code,confidence,model_provider,model_name,created_at&order=created_at.asc" + filter,
    token,
  )
  if (!response.ok) throw new ApiError("review_queue_failed", 502)
  return await response.json()
}

async function getReviewDetail(env: Env, token: string, intakeId: string) {
  const response = await supabaseFetch(env, `/rest/v1/accounting_document_intake?select=*&id=eq.${encodeURIComponent(intakeId)}&limit=1`, token)
  if (!response.ok) throw new ApiError("review_detail_failed", 502)
  const rows = await response.json() as JsonRecord[]
  if (!rows[0]) throw new ApiError("not_found", 404)
  return rows[0]
}

async function submitReview(env: Env, token: string, intakeId: string, request: Request) {
  const payload = await request.json() as JsonRecord
  const decision = typeof payload.decision === "string" ? payload.decision : ""
  if (!new Set(["approved", "rejected", "returned"]).has(decision)) throw new ApiError("invalid_decision", 400)
  return rpc(env, token, "review_accounting_intake", {
    p_intake_id: intakeId,
    p_decision: decision,
    p_corrected_fields: payload.corrected_fields && typeof payload.corrected_fields === "object" ? payload.corrected_fields : {},
    p_notes: typeof payload.notes === "string" ? payload.notes : null,
  })
}

async function listPostingQueue(env: Env, token: string) {
  const response = await supabaseFetch(
    env,
    "/rest/v1/accounting_documents?select=id,intake_id,legal_entity_id,counterparty_id,document_type,direction,document_number,document_date,due_date,currency,net_amount,tax_amount,total_amount,status,approved_at,posted_at&status=in.(approved,draft)&order=document_date.asc",
    token,
  )
  if (!response.ok) throw new ApiError("posting_queue_failed", 502)
  return await response.json()
}

async function getJournal(env: Env, token: string, journalId: string) {
  const [entryResponse, linesResponse] = await Promise.all([
    supabaseFetch(env, `/rest/v1/accounting_journal_entries?select=*&id=eq.${encodeURIComponent(journalId)}&limit=1`, token),
    supabaseFetch(env, `/rest/v1/accounting_journal_lines?select=id,journal_entry_id,legal_entity_id,account_id,department_id,cost_center_id,debit,credit,description&journal_entry_id=eq.${encodeURIComponent(journalId)}&order=created_at.asc`, token),
  ])
  if (!entryResponse.ok || !linesResponse.ok) throw new ApiError("journal_lookup_failed", 502)
  const entries = await entryResponse.json() as JsonRecord[]
  if (!entries[0]) throw new ApiError("not_found", 404)
  const validation = await rpc(env, token, "validate_accounting_journal", { p_journal_id: journalId })
  return { entry: entries[0], lines: await linesResponse.json(), validation }
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
        return json({ data: await listReviewQueue(env, auth.token, url.searchParams.get("status")), request_id: id }, 200, id)
      }

      const reviewMatch = url.pathname.match(new RegExp(`^/${version}/accounting/review/([0-9a-fA-F-]{36})$`))
      if (reviewMatch && request.method === "GET") return json({ data: await getReviewDetail(env, auth.token, reviewMatch[1]), request_id: id }, 200, id)
      if (reviewMatch && request.method === "POST") return json({ data: await submitReview(env, auth.token, reviewMatch[1], request), request_id: id }, 200, id)

      if (request.method === "GET" && url.pathname === `${base}/accounting/posting`) {
        return json({ data: await listPostingQueue(env, auth.token), request_id: id }, 200, id)
      }

      const materializeMatch = url.pathname.match(new RegExp(`^/${version}/accounting/intakes/([0-9a-fA-F-]{36})/materialize$`))
      if (materializeMatch && request.method === "POST") {
        return json({ data: await rpc(env, auth.token, "materialize_accounting_document_from_intake", { p_intake_id: materializeMatch[1] }), request_id: id }, 200, id)
      }

      const journalForDocumentMatch = url.pathname.match(new RegExp(`^/${version}/accounting/documents/([0-9a-fA-F-]{36})/journal$`))
      if (journalForDocumentMatch && request.method === "POST") {
        return json({ data: await rpc(env, auth.token, "create_draft_journal_for_document", { p_document_id: journalForDocumentMatch[1] }), request_id: id }, 200, id)
      }

      const journalMatch = url.pathname.match(new RegExp(`^/${version}/accounting/journals/([0-9a-fA-F-]{36})$`))
      if (journalMatch && request.method === "GET") {
        return json({ data: await getJournal(env, auth.token, journalMatch[1]), request_id: id }, 200, id)
      }

      const journalActionMatch = url.pathname.match(new RegExp(`^/${version}/accounting/journals/([0-9a-fA-F-]{36})/(approve|post)$`))
      if (journalActionMatch && request.method === "POST") {
        const rpcName = journalActionMatch[2] === "approve" ? "approve_accounting_journal" : "post_accounting_journal"
        await rpc(env, auth.token, rpcName, { p_journal_id: journalActionMatch[1] })
        return json({ data: { journal_id: journalActionMatch[1], action: journalActionMatch[2] }, request_id: id }, 200, id)
      }

      throw new ApiError("not_found", 404)
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError("internal_error", 500)
      console.error(JSON.stringify({ level: normalized.status >= 500 ? "error" : "warning", service: "black-swan-accounting", request_id: id, method: request.method, route: url.pathname, error_code: normalized.code, status_code: normalized.status }))
      return json({ error: { code: normalized.code, message: normalized.message, request_id: id } }, normalized.status, id)
    }
  },
}
