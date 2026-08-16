type JsonRecord = Record<string, unknown>

type AiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

export interface Env {
  API_VERSION: string
  ENVIRONMENT: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  AI?: AiBinding
  DISCOVERY_CONCIERGE_MODEL?: string
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

async function rpc(env: Env, token: string, name: string, payload: JsonRecord = {}) {
  const response = await supabaseFetch(env, `/rest/v1/rpc/${name}`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const detail = await response.text()
    if (response.status === 401) throw new ApiError('unauthorized', 401)
    if (response.status === 403 || detail.includes('FORBIDDEN')) throw new ApiError('forbidden', 403)
    throw new ApiError('workspace_operation_failed', 409, detail.slice(0, 240) || name)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

function normalizeConciergeProposal(input: JsonRecord, fallbackText: string, source: string) {
  const intentType = ['seek', 'offer', 'interest'].includes(String(input.intent_type)) ? String(input.intent_type) : 'interest'
  const privacy = ['network_only', 'incognito', 'private'].includes(String(input.privacy)) ? String(input.privacy) : 'incognito'
  const summary = String(input.summary || fallbackText).trim().slice(0, 500)
  const details = String(input.details || '').trim().slice(0, 2000) || null
  return {
    intent_type: intentType,
    summary: summary.length >= 5 ? summary : fallbackText.trim().slice(0, 500),
    details,
    privacy,
    proposal_source: source,
    requires_confirmation: true,
  }
}

function ruleBasedConcierge(text: string) {
  const lower = text.toLowerCase()
  const intentType = /\b(i can|i offer|i provide|we can|available to help|puedo|ofrezco)\b/.test(lower)
    ? 'offer'
    : /\b(looking for|seeking|need|want to find|busco|necesito|quiero encontrar)\b/.test(lower)
      ? 'seek'
      : 'interest'
  return normalizeConciergeProposal({ intent_type: intentType, summary: text, privacy: 'incognito' }, text, 'rules_v1')
}

async function proposeDiscoveryIntent(env: Env, text: string) {
  const clean = text.trim()
  if (clean.length < 5 || clean.length > 3000) throw new ApiError('invalid_concierge_input', 400)
  if (!env.AI) return ruleBasedConcierge(clean)

  const model = env.DISCOVERY_CONCIERGE_MODEL || '@cf/meta/llama-3.1-8b-instruct'
  const prompt = `You are Black Swan Concierge. Convert the member's natural-language statement into one current discovery intent. Return ONLY valid JSON with keys intent_type, summary, details, privacy. intent_type must be seek, offer, or interest. privacy must be incognito unless the member explicitly asks to keep it private, in which case use private. Keep summary under 220 characters. Never invent people, companies, amounts, timing, or constraints that the member did not state. Member statement: ${JSON.stringify(clean)}`

  try {
    const result = await env.AI.run(model, {
      messages: [
        { role: 'system', content: 'Return JSON only. Do not persist or take actions.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 350,
    }) as JsonRecord
    const raw = typeof result?.response === 'string' ? result.response : typeof result === 'string' ? result : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return ruleBasedConcierge(clean)
    const parsed = JSON.parse(match[0]) as JsonRecord
    return normalizeConciergeProposal(parsed, clean, 'workers_ai')
  } catch {
    return ruleBasedConcierge(clean)
  }
}

const workspaces: Record<string, string> = {
  people: 'get_people_graph_workspace',
  events: 'get_events_workspace',
  education: 'get_education_workspace',
  'orchard-kitchen': 'get_orchard_kitchen_workspace',
  'event-providers': 'get_event_provider_workspace',
  'front-door': 'get_foundation_front_door_workspace',
  discovery: 'get_discovery_workspace',
  imports: 'get_canonical_import_workspace',
  intercompany: 'get_intercompany_workspace',
  audit: 'get_black_swan_audit_center',
}

function actionPayload(action: string, body: JsonRecord) {
  switch (action) {
    case 'member-presence': return { rpc: 'set_member_ground_presence', payload: { p_member_id: body.member_id, p_action: body.action, p_location_id: body.location_id || null, p_notes: body.notes || null } }
    case 'guest-invitation': return { rpc: 'create_member_guest_invitation', payload: { p_member_id: body.member_id, p_guest_name: body.guest_name, p_valid_from: body.valid_from, p_valid_until: body.valid_until, p_event_id: body.event_id || null, p_reservation_id: body.reservation_id || null } }
    case 'event': return { rpc: 'create_member_operational_event', payload: { p_member_id: body.member_id, p_name: body.name, p_start_date: body.start_date, p_end_date: body.end_date, p_location_name: body.location_name || null, p_member_role: body.member_role || 'host' } }
    case 'event-portal': return { rpc: 'upsert_event_guest_portal', payload: { p_event_id: body.event_id, p_slug: body.slug, p_access_mode: body.access_mode || 'invite_token', p_passcode: body.passcode || null, p_headline: body.headline || null, p_black_swan_intro: body.black_swan_intro || null, p_event_description: body.event_description || null, p_program: body.program || [], p_practical_info: body.practical_info || {}, p_capacity: body.capacity ?? null, p_allow_companions: Boolean(body.allow_companions), p_max_companions: body.max_companions ?? 0, p_commercial_model: body.commercial_model || 'free', p_ticket_price: body.ticket_price ?? null, p_currency: body.currency || 'CLP', p_collecting_legal_entity_id: body.collecting_legal_entity_id || null, p_payment_provider: body.payment_provider || null, p_status: body.status || 'draft' } }
    case 'event-portal-invite': return { rpc: 'issue_event_portal_invite', payload: { p_portal_id: body.portal_id, p_inviting_member_id: body.inviting_member_id || null, p_invitee_name: body.invitee_name || null, p_invitee_email: body.invitee_email || null, p_expires_at: body.expires_at || null, p_max_uses: body.max_uses ?? 1 } }
    case 'event-portal-invite-revoke': return { rpc: 'revoke_event_portal_invite', payload: { p_invite_id: body.invite_id, p_reason: body.reason } }
    case 'event-registration-status': return { rpc: 'set_event_portal_registration_status', payload: { p_registration_id: body.registration_id, p_status: body.status, p_notes: body.notes || null } }
    case 'event-registration-checkin': return { rpc: 'check_in_event_portal_guest', payload: { p_checkin_token: body.checkin_token } }
    case 'event-registration-followup': return { rpc: 'update_event_portal_followup', payload: { p_registration_id: body.registration_id, p_followup_status: body.followup_status, p_notes: body.notes || null } }
    case 'event-portal-close': return { rpc: 'close_event_portal_and_start_education', payload: { p_portal_id: body.portal_id } }
    case 'education-material': return { rpc: 'add_event_education_material', payload: { p_collection_id: body.collection_id, p_material_type: body.material_type, p_title: body.title, p_privacy_level: body.privacy_level || 'internal', p_source_url: body.source_url || null, p_storage_path: body.storage_path || null } }
    case 'education-review': return { rpc: 'review_education_material', payload: { p_material_id: body.material_id, p_decision: body.decision, p_privacy_level: body.privacy_level, p_editorial_notes: body.editorial_notes || null } }
    case 'orchard-kitchen-cost': return { rpc: 'record_orchard_kitchen_cost', payload: { p_cost_domain: body.cost_domain, p_amount_clp: body.amount_clp, p_incurred_on: body.incurred_on, p_description: body.description, p_supplier_id: body.supplier_id || null, p_procurement_request_id: body.procurement_request_id || null } }
    case 'orchard-kitchen-responsibility': return { rpc: 'assign_orchard_kitchen_responsibility', payload: { p_employee_id: body.employee_id, p_responsibility_type: body.responsibility_type, p_can_request_purchases: Boolean(body.can_request_purchases), p_can_manage_costs: Boolean(body.can_manage_costs), p_effective_from: body.effective_from, p_source_reference: body.source_reference || null, p_notes: body.notes || null } }
    case 'event-provider': return { rpc: 'register_event_service_provider', payload: { p_supplier_id: body.supplier_id, p_service_category: body.service_category, p_service_description: body.service_description || null, p_coverage_area: body.coverage_area || null, p_capacity_notes: body.capacity_notes || null } }
    case 'event-provider-engagement': return { rpc: 'engage_event_service_provider', payload: { p_event_id: body.event_id, p_provider_profile_id: body.provider_profile_id, p_scope_of_work: body.scope_of_work, p_estimated_amount_clp: body.estimated_amount_clp ?? null, p_procurement_request_id: body.procurement_request_id || null } }
    case 'publication-draft': return { rpc: 'create_foundation_publication_draft', payload: { p_education_material_id: body.education_material_id, p_channel: body.channel, p_public_title: body.public_title, p_public_summary: body.public_summary || null, p_campaign_reference: body.campaign_reference || null } }
    case 'publication-review': return { rpc: 'review_foundation_publication', payload: { p_publication_id: body.publication_id, p_decision: body.decision, p_published_url: body.published_url || null } }
    case 'discovery-intent': return { rpc: 'create_discovery_intent', payload: { p_summary: body.summary, p_intent_type: body.intent_type, p_privacy: body.privacy || 'network_only', p_network_ids: body.network_ids || null, p_details: body.details || null, p_valid_until: body.valid_until || null } }
    case 'discovery-intent-status': return { rpc: 'set_discovery_intent_status', payload: { p_intent_id: body.intent_id, p_status: body.status } }
    case 'discovery-match': return { rpc: 'run_discovery_matching', payload: { p_network_id: body.network_id } }
    case 'discovery-opportunity': return { rpc: 'respond_discovery_opportunity', payload: { p_opportunity_id: body.opportunity_id, p_decision: body.decision } }
    case 'import-stage': return { rpc: 'stage_canonical_import', payload: { p_import_type: body.import_type, p_source_name: body.source_name, p_rows: body.rows } }
    case 'import-resolve': return { rpc: 'resolve_canonical_import_row', payload: { p_import_type: body.import_type, p_row_id: body.row_id, p_legal_entity_id: body.legal_entity_id || null, p_department_id: body.department_id || null, p_matched_record_id: body.matched_record_id || null, p_resolution_status: body.resolution_status || 'resolved', p_notes: body.notes || null } }
    case 'import-review': return { rpc: 'review_canonical_import_batch', payload: { p_batch_id: body.batch_id, p_decision: body.decision, p_notes: body.notes || null } }
    case 'import-apply': return { rpc: 'apply_canonical_import_batch', payload: { p_batch_id: body.batch_id } }
    case 'intercompany-rule': return { rpc: 'save_intercompany_draft_rule', payload: { p_rule_name: body.rule_name, p_source_legal_entity_id: body.source_legal_entity_id, p_destination_legal_entity_id: body.destination_legal_entity_id, p_rule_type: body.rule_type, p_frequency: body.frequency, p_calculation_method: body.calculation_method, p_effective_from: body.effective_from, p_fixed_amount: body.fixed_amount ?? null, p_percentage_rate: body.percentage_rate ?? null, p_tax_treatment: body.tax_treatment || null, p_agreement_reference: body.agreement_reference || null, p_notes: body.notes || null } }
    default: throw new ApiError('unsupported_action', 404)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = request.headers.get('cf-ray') || request.headers.get('x-request-id') || crypto.randomUUID()
    const version = env.API_VERSION || 'v1'
    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === `/${version}/health`) return json({ status: 'ok', service: 'black-swan-operations', request_id: requestId }, 200, requestId)
      const token = await requireUser(request, env)

      if (request.method === 'POST' && url.pathname === `/${version}/os/discovery/concierge/propose`) {
        const allowed = Boolean(await rpc(env, token, 'get_discovery_navigation_entitlement'))
        if (!allowed) throw new ApiError('forbidden', 403)
        const body = await request.json() as JsonRecord
        return json({ data: await proposeDiscoveryIntent(env, String(body.text || '')), request_id: requestId }, 200, requestId)
      }

      if (request.method === 'GET' && url.pathname === `/${version}/os/navigation`) {
        const navigation = await rpc(env, token, 'get_black_swan_os_navigation') as JsonRecord
        const discoveryEnabled = Boolean(await rpc(env, token, 'get_discovery_navigation_entitlement'))
        const items = Array.isArray(navigation?.items) ? navigation.items as JsonRecord[] : []
        if (discoveryEnabled && !items.some((item) => item?.key === 'discovery')) {
          navigation.items = [...items, { key: 'discovery', label: 'Discovery', href: '/os/discovery' }]
        }
        return json({ data: navigation, request_id: requestId }, 200, requestId)
      }

      const portalManagementMatch = url.pathname.match(new RegExp(`^/${version}/os/event-portals/([0-9a-f-]+)$`))
      if (portalManagementMatch && request.method === 'GET') return json({ data: await rpc(env, token, 'get_event_portal_management', { p_portal_id: portalManagementMatch[1] }), request_id: requestId }, 200, requestId)

      const workspaceMatch = url.pathname.match(new RegExp(`^/${version}/os/workspaces/([a-z-]+)$`))
      if (workspaceMatch && request.method === 'GET') {
        if (!workspaces[workspaceMatch[1]]) throw new ApiError('not_found', 404)
        return json({ data: await rpc(env, token, workspaces[workspaceMatch[1]]), request_id: requestId }, 200, requestId)
      }

      const referenceMatch = url.pathname.match(new RegExp(`^/${version}/os/references/([a-z-]+)$`))
      if (referenceMatch && request.method === 'GET') return json({ data: await rpc(env, token, 'get_black_swan_os_references', { p_workspace: referenceMatch[1] }), request_id: requestId }, 200, requestId)

      const actionMatch = url.pathname.match(new RegExp(`^/${version}/os/actions/([a-z-]+)$`))
      if (actionMatch && request.method === 'POST') {
        const body = await request.json() as JsonRecord
        const action = actionPayload(actionMatch[1], body)
        return json({ data: await rpc(env, token, action.rpc, action.payload), request_id: requestId }, 200, requestId)
      }

      throw new ApiError('not_found', 404)
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError('internal_error', 500)
      console.error(JSON.stringify({ level: normalized.status >= 500 ? 'error' : 'warning', service: 'black-swan-operations', request_id: requestId, route: url.pathname, method: request.method, error_code: normalized.code, status_code: normalized.status }))
      return json({ error: { code: normalized.code, message: normalized.message, request_id: requestId } }, normalized.status, requestId)
    }
  },
}
