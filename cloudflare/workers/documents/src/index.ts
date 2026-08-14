export interface Env {
  API_VERSION: string
  ENVIRONMENT: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  DOCUMENTS_BUCKET: R2Bucket
  OCR_QUEUE: Queue<OcrJob>
}

type JsonRecord = Record<string, unknown>

type OcrJob = {
  intake_id: string
  storage_key: string
  source_file_name: string
  content_type: string
  received_at: string
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

  return { token, user: (await response.json()) as JsonRecord }
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document"
}

async function createIntake(
  env: Env,
  token: string,
  payload: JsonRecord,
) {
  const response = await supabaseFetch(env, "/rest/v1/accounting_document_intake", token, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error(JSON.stringify({ event: "accounting_intake_create_failed", status: response.status, detail }))
    throw new ApiError("intake_create_failed", 502)
  }

  const rows = (await response.json()) as JsonRecord[]
  const row = rows[0]
  if (!row || typeof row.id !== "string") throw new ApiError("intake_create_failed", 502)
  return row
}

async function uploadDocument(request: Request, env: Env, id: string) {
  const auth = await requireUser(request, env)
  const form = await request.formData()
  const uploaded = form.get("file")

  if (!(uploaded instanceof File)) {
    throw new ApiError("file_required", 400)
  }

  if (uploaded.size <= 0) throw new ApiError("empty_file", 400)
  if (uploaded.size > 25 * 1024 * 1024) throw new ApiError("file_too_large", 413)

  const receivedAt = new Date().toISOString()
  const fileName = safeFileName(uploaded.name)
  const storageKey = `accounting-intake/${receivedAt.slice(0, 10)}/${crypto.randomUUID()}-${fileName}`

  await env.DOCUMENTS_BUCKET.put(storageKey, uploaded.stream(), {
    httpMetadata: { contentType: uploaded.type || "application/octet-stream" },
    customMetadata: {
      originalFileName: uploaded.name,
      uploadedBy: String(auth.user.id ?? "unknown"),
      requestId: id,
    },
  })

  let intake: JsonRecord
  try {
    intake = await createIntake(env, auth.token, {
      source_type: "upload",
      source_reference: id,
      source_file_name: uploaded.name,
      source_storage_path: storageKey,
      status: "received",
      requires_review: true,
      created_by: auth.user.id,
    })
  } catch (error) {
    await env.DOCUMENTS_BUCKET.delete(storageKey)
    throw error
  }

  const job: OcrJob = {
    intake_id: String(intake.id),
    storage_key: storageKey,
    source_file_name: uploaded.name,
    content_type: uploaded.type || "application/octet-stream",
    received_at: receivedAt,
  }

  try {
    await env.OCR_QUEUE.send(job)
  } catch (error) {
    console.error(JSON.stringify({ event: "ocr_queue_send_failed", request_id: id, intake_id: intake.id }))
    return json(
      {
        data: intake,
        queue_status: "pending_retry",
        request_id: id,
      },
      202,
      id,
    )
  }

  return json(
    {
      data: intake,
      queue_status: "queued",
      request_id: id,
    },
    202,
    id,
  )
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = requestId(request)
    const version = env.API_VERSION || "v1"
    const url = new URL(request.url)

    try {
      if (request.method === "GET" && url.pathname === `/${version}/health`) {
        return json({ status: "ok", service: "black-swan-documents", version, request_id: id }, 200, id)
      }

      if (request.method === "POST" && url.pathname === `/${version}/documents/intake`) {
        return await uploadDocument(request, env, id)
      }

      throw new ApiError("not_found", 404)
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError("internal_error", 500)
      console.error(JSON.stringify({
        level: normalized.status >= 500 ? "error" : "warning",
        service: "black-swan-documents",
        request_id: id,
        method: request.method,
        route: url.pathname,
        error_code: normalized.code,
        status_code: normalized.status,
      }))
      return json({ error: { code: normalized.code, request_id: id } }, normalized.status, id)
    }
  },
}
