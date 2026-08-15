type JsonRecord = Record<string, unknown>

type ScheduledControllerLike = { scheduledTime?: number; cron?: string }
type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void }

type Notification = {
  id: string
  notification_type: string
  recipient_email: string
  payload?: JsonRecord
  attempts?: number
  event?: {
    name?: string | null
    start_date?: string | null
    end_date?: string | null
    location_name?: string | null
  }
  portal?: {
    slug?: string | null
    headline?: string | null
    status?: string | null
  } | null
}

export interface Env {
  API_VERSION: string
  ENVIRONMENT: string
  DELIVERY_BATCH_SIZE?: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  NOTIFICATION_MACHINE_TOKEN?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  RESEND_REPLY_TO?: string
  RUN_TOKEN?: string
}

class DeliveryError extends Error {
  constructor(readonly code: string, message = code) { super(message) }
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

function dateLabel(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(parsed)
}

function eventSummary(notification: Notification) {
  const event = notification.event || {}
  const start = dateLabel(event.start_date)
  const end = dateLabel(event.end_date)
  const dates = start && end && start !== end ? `${start} – ${end}` : start || end
  return [
    event.name ? `<p><strong>Event:</strong> ${escapeHtml(event.name)}</p>` : '',
    dates ? `<p><strong>Date:</strong> ${escapeHtml(dates)}</p>` : '',
    event.location_name ? `<p><strong>Location:</strong> ${escapeHtml(event.location_name)}</p>` : '',
  ].filter(Boolean).join('')
}

function personName(notification: Notification) {
  return escapeHtml(notification.payload?.full_name || notification.payload?.invitee_name || 'Guest')
}

function template(notification: Notification) {
  const eventName = String(notification.event?.name || notification.portal?.headline || 'Black Swan event')
  const summary = eventSummary(notification)
  const name = personName(notification)

  switch (notification.notification_type) {
    case 'registration_confirmed': return {
      subject: `Registration confirmed — ${eventName}`,
      html: `<p>Hello ${name},</p><p>Your registration for <strong>${escapeHtml(eventName)}</strong> is confirmed.</p>${summary}<p>Please keep the QR/check-in pass shown on your registration confirmation page. Physical entry remains subject to Black Swan guest-access rules.</p><p>Black Swan</p>`,
    }
    case 'waitlist_added': return {
      subject: `Waitlist — ${eventName}`,
      html: `<p>Hello ${name},</p><p>You are currently on the waitlist for <strong>${escapeHtml(eventName)}</strong>.</p>${summary}<p>We will contact you if a place becomes available.</p><p>Black Swan</p>`,
    }
    case 'waitlist_promoted': return {
      subject: `Your place is confirmed — ${eventName}`,
      html: `<p>Hello ${name},</p><p>A place has become available and your registration for <strong>${escapeHtml(eventName)}</strong> is now confirmed.</p>${summary}<p>Your updated check-in pass is issued through the event registration workflow.</p><p>Black Swan</p>`,
    }
    case 'registration_cancelled': return {
      subject: `Registration cancelled — ${eventName}`,
      html: `<p>Hello ${name},</p><p>Your registration for <strong>${escapeHtml(eventName)}</strong> has been cancelled.</p>${summary}<p>If this is unexpected, please contact the event host.</p><p>Black Swan</p>`,
    }
    case 'event_reminder': return {
      subject: `Reminder — ${eventName}`,
      html: `<p>Hello ${name},</p><p>This is a reminder for <strong>${escapeHtml(eventName)}</strong>.</p>${summary}<p>Please bring your event check-in pass.</p><p>Black Swan</p>`,
    }
    case 'post_event_followup': return {
      subject: `Thank you for joining ${eventName}`,
      html: `<p>Hello ${name},</p><p>Thank you for joining <strong>${escapeHtml(eventName)}</strong>.</p><p>Black Swan events feed our educational work. We may share approved educational material and future invitations according to your communication preferences.</p><p>Black Swan</p>`,
    }
    default: throw new DeliveryError('unsupported_notification_type')
  }
}

async function supabaseRpc(env: Env, name: string, payload: JsonRecord) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new DeliveryError('supabase_not_configured')
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await response.text()
  if (!response.ok) throw new DeliveryError('supabase_rpc_failed', text.slice(0, 500))
  return text ? JSON.parse(text) : null
}

async function sendResend(env: Env, notification: Notification) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new DeliveryError('resend_not_configured')
  const rendered = template(notification)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      'idempotency-key': `black-swan-event/${notification.id}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [notification.recipient_email],
      subject: rendered.subject,
      html: rendered.html,
      ...(env.RESEND_REPLY_TO ? { reply_to: env.RESEND_REPLY_TO } : {}),
    }),
  })
  const body = await response.json().catch(() => ({})) as JsonRecord
  if (!response.ok) throw new DeliveryError('resend_send_failed', JSON.stringify(body).slice(0, 500))
  return String(body.id || '')
}

async function complete(env: Env, notification: Notification, success: boolean, providerMessageId?: string, error?: string) {
  if (!env.NOTIFICATION_MACHINE_TOKEN) throw new DeliveryError('machine_token_not_configured')
  await supabaseRpc(env, 'complete_event_notification_delivery', {
    p_machine_token: env.NOTIFICATION_MACHINE_TOKEN,
    p_notification_id: notification.id,
    p_success: success,
    p_provider_message_id: providerMessageId || null,
    p_error: error || null,
  })
}

async function runBatch(env: Env) {
  if (!env.NOTIFICATION_MACHINE_TOKEN) throw new DeliveryError('machine_token_not_configured')
  const limit = Math.max(1, Math.min(Number(env.DELIVERY_BATCH_SIZE || 20) || 20, 50))
  const claimed = await supabaseRpc(env, 'claim_event_notifications', { p_machine_token: env.NOTIFICATION_MACHINE_TOKEN, p_limit: limit }) as Notification[]

  let sent = 0
  let failed = 0
  for (const notification of claimed || []) {
    try {
      const providerMessageId = await sendResend(env, notification)
      await complete(env, notification, true, providerMessageId)
      sent += 1
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      try { await complete(env, notification, false, undefined, message) }
      catch (completeError) { console.error(JSON.stringify({ level: 'error', service: 'black-swan-event-notifications', notification_id: notification.id, stage: 'complete_failure', error: String(completeError) })) }
      failed += 1
    }
  }
  return { claimed: claimed?.length || 0, sent, failed }
}

export default {
  async scheduled(_controller: ScheduledControllerLike, env: Env, ctx: ExecutionContextLike) {
    ctx.waitUntil(runBatch(env).then((result) => {
      console.log(JSON.stringify({ level: 'info', service: 'black-swan-event-notifications', trigger: 'scheduled', ...result }))
    }).catch((error) => {
      console.error(JSON.stringify({ level: 'error', service: 'black-swan-event-notifications', trigger: 'scheduled', error: String(error) }))
    }))
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const version = env.API_VERSION || 'v1'
    if (request.method === 'GET' && url.pathname === `/${version}/health`) return Response.json({ status: 'ok', service: 'black-swan-event-notifications', environment: env.ENVIRONMENT || 'unknown' })
    if (request.method === 'POST' && url.pathname === `/${version}/run`) {
      const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
      if (!env.RUN_TOKEN || supplied !== env.RUN_TOKEN) return Response.json({ error: 'forbidden' }, { status: 403 })
      try { return Response.json({ data: await runBatch(env) }) }
      catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'delivery_failed' }, { status: 500 }) }
    }
    return Response.json({ error: 'not_found' }, { status: 404 })
  },
}
