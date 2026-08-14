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

const json = (body: JsonRecord, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})

const tokenFrom = (request: Request) => {
  const header = request.headers.get('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : null
}

async function sf(env: Env, path: string, token: string, init: RequestInit = {}) {
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

async function auth(request: Request, env: Env) {
  const token = tokenFrom(request)
  if (!token) throw new ApiError('unauthorized', 401)
  const r = await sf(env, '/auth/v1/user', token)
  if (!r.ok) throw new ApiError('unauthorized', 401)
  return token
}

async function rpc(env: Env, token: string, name: string, payload: JsonRecord) {
  const r = await sf(env, `/rest/v1/rpc/${name}`, token, { method: 'POST', body: JSON.stringify(payload) })
  if (!r.ok) throw new ApiError('accounting_operation_failed', r.status === 403 ? 403 : 409, (await r.text()).slice(0, 240))
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

async function listBatches(env: Env, token: string) {
  const r = await sf(env, '/rest/v1/coa_import_batches?select=id,legal_entity_id,source_name,source_file_name,status,row_count,valid_row_count,invalid_row_count,reviewed_at,applied_at,notes,created_at&order=created_at.desc', token)
  if (!r.ok) throw new ApiError('coa_batch_lookup_failed', 502)
  return r.json()
}

async function getBatch(env: Env, token: string, id: string) {
  const [b, rows] = await Promise.all([
    sf(env, `/rest/v1/coa_import_batches?select=*&id=eq.${encodeURIComponent(id)}&limit=1`, token),
    sf(env, `/rest/v1/coa_import_rows?select=id,row_number,raw_payload,account_code,account_name,account_type,parent_account_code,cashflow_class,is_active,validation_status,validation_errors,canonical_account_id&batch_id=eq.${encodeURIComponent(id)}&order=row_number.asc`, token),
  ])
  if (!b.ok || !rows.ok) throw new ApiError('coa_batch_lookup_failed', 502)
  const batches = await b.json() as JsonRecord[]
  if (!batches[0]) throw new ApiError('not_found', 404)
  return { batch: batches[0], rows: await rows.json() }
}

async function createBatch(env: Env, token: string, request: Request) {
  const p = await request.json() as JsonRecord
  if (!p.legal_entity_id || !p.source_name) throw new ApiError('invalid_batch', 400)
  const r = await sf(env, '/rest/v1/coa_import_batches?select=id', token, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      legal_entity_id: p.legal_entity_id,
      source_name: p.source_name,
      source_file_name: p.source_file_name || null,
      source_file_hash: p.source_file_hash || null,
      notes: p.notes || null,
    }),
  })
  if (!r.ok) throw new ApiError('coa_batch_create_failed', 409, (await r.text()).slice(0, 240))
  const rows = await r.json() as Array<{ id: string }>
  return rows[0]?.id
}

async function replaceRows(env: Env, token: string, id: string, request: Request) {
  const p = await request.json() as JsonRecord
  if (!Array.isArray(p.rows)) throw new ApiError('invalid_rows', 400)
  const del = await sf(env, `/rest/v1/coa_import_rows?batch_id=eq.${encodeURIComponent(id)}`, token, { method: 'DELETE' })
  if (!del.ok) throw new ApiError('coa_rows_replace_failed', 409)
  const payload = p.rows.map((row, index) => {
    const r = row as JsonRecord
    return {
      batch_id: id,
      row_number: index + 1,
      raw_payload: r,
      account_code: r.account_code || null,
      account_name: r.account_name || null,
      account_type: r.account_type || null,
      parent_account_code: r.parent_account_code || null,
      cashflow_class: r.cashflow_class || null,
      is_active: r.is_active !== false,
    }
  })
  if (payload.length) {
    const ins = await sf(env, '/rest/v1/coa_import_rows', token, { method: 'POST', body: JSON.stringify(payload) })
    if (!ins.ok) throw new ApiError('coa_rows_replace_failed', 409, (await ins.text()).slice(0, 240))
  }
  return rpc(env, token, 'validate_coa_import_batch', { p_batch_id: id })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const version = env.API_VERSION || 'v1'
    const base = `/${version}`
    const url = new URL(request.url)
    try {
      if (request.method === 'GET' && url.pathname === `${base}/health`) return json({ status: 'ok', service: 'black-swan-accounting-coa' })
      const token = await auth(request, env)
      if (request.method === 'GET' && url.pathname === `${base}/accounting/coa/imports`) return json({ data: await listBatches(env, token) })
      if (request.method === 'POST' && url.pathname === `${base}/accounting/coa/imports`) return json({ data: await createBatch(env, token, request) })

      const batch = url.pathname.match(new RegExp(`^/${version}/accounting/coa/imports/([0-9a-fA-F-]{36})$`))
      if (batch && request.method === 'GET') return json({ data: await getBatch(env, token, batch[1]) })

      const rows = url.pathname.match(new RegExp(`^/${version}/accounting/coa/imports/([0-9a-fA-F-]{36})/rows$`))
      if (rows && request.method === 'POST') return json({ data: await replaceRows(env, token, rows[1], request) })

      const action = url.pathname.match(new RegExp(`^/${version}/accounting/coa/imports/([0-9a-fA-F-]{36})/(validate|approve|reject|apply)$`))
      if (action && request.method === 'POST') {
        const [_, id, verb] = action
        if (verb === 'validate') return json({ data: await rpc(env, token, 'validate_coa_import_batch', { p_batch_id: id }) })
        if (verb === 'approve' || verb === 'reject') {
          const p = await request.json().catch(() => ({})) as JsonRecord
          await rpc(env, token, 'review_coa_import_batch', { p_batch_id: id, p_decision: verb === 'approve' ? 'approved' : 'rejected', p_notes: p.notes || null })
          return json({ data: { batch_id: id, status: verb === 'approve' ? 'approved' : 'rejected' } })
        }
        return json({ data: await rpc(env, token, 'apply_coa_import_batch', { p_batch_id: id }) })
      }

      throw new ApiError('not_found', 404)
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError('internal_error', 500)
      return json({ error: { code: err.code, message: err.message } }, err.status)
    }
  },
}
