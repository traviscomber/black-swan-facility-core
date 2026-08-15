'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL
const publicBase = process.env.NEXT_PUBLIC_BLACK_SWAN_EVENT_PUBLIC_BASE_URL || ''

type Row = Record<string, unknown>

async function authToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Authentication required')
  return token
}

async function api(path: string, init: RequestInit = {}) {
  if (!operationsApi) throw new Error('Operations API is not configured.')
  const token = await authToken()
  const response = await fetch(`${operationsApi}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) } })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result?.error?.message || result?.error?.code || 'Operation failed')
  return result.data
}

export function EventPortalAdmin() {
  const [events, setEvents] = useState<Row[]>([])
  const [portals, setPortals] = useState<Row[]>([])
  const [members, setMembers] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  async function load() {
    try {
      const [workspace, refs] = await Promise.all([api('/v1/os/workspaces/events'), api('/v1/os/references/events')])
      setEvents(Array.isArray(workspace?.events) ? workspace.events : [])
      setPortals(Array.isArray(workspace?.portals) ? workspace.portals : [])
      setMembers(Array.isArray(refs?.members) ? refs.members : [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load event portals') }
  }

  useEffect(() => { void load() }, [])

  async function createPortal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null); setInviteUrl(null)
    const form = new FormData(event.currentTarget)
    const program = String(form.get('program') || '').split('\n').map((v) => v.trim()).filter(Boolean)
    try {
      await api('/v1/os/actions/event-portal', {
        method: 'POST',
        body: JSON.stringify({
          event_id: form.get('event_id'),
          slug: form.get('slug'),
          access_mode: form.get('access_mode'),
          passcode: form.get('passcode') || null,
          headline: form.get('headline') || null,
          black_swan_intro: form.get('black_swan_intro') || null,
          event_description: form.get('event_description') || null,
          program,
          capacity: form.get('capacity') ? Number(form.get('capacity')) : null,
          allow_companions: form.get('allow_companions') === 'on',
          max_companions: form.get('max_companions') ? Number(form.get('max_companions')) : 0,
          commercial_model: form.get('commercial_model'),
          status: form.get('status'),
        }),
      })
      setMessage('Event guest portal saved.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save portal') }
    finally { setBusy(false) }
  }

  async function issueInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null); setInviteUrl(null)
    const form = new FormData(event.currentTarget)
    try {
      const result = await api('/v1/os/actions/event-portal-invite', {
        method: 'POST',
        body: JSON.stringify({
          portal_id: form.get('portal_id'),
          inviting_member_id: form.get('inviting_member_id') || null,
          invitee_name: form.get('invitee_name') || null,
          invitee_email: form.get('invitee_email') || null,
          expires_at: form.get('expires_at') || null,
          max_uses: form.get('max_uses') ? Number(form.get('max_uses')) : 1,
        }),
      })
      const portal = portals.find((p) => p.id === form.get('portal_id'))
      const base = publicBase.replace(/\/$/, '')
      const url = portal?.slug && result?.token ? `${base || window.location.origin}/en/event/${portal.slug}?access=${encodeURIComponent(result.token)}` : null
      setInviteUrl(url)
      setMessage('Invite created. The raw token is shown only in this result; send the generated link to the guest.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to issue invite') }
    finally { setBusy(false) }
  }

  return <div className="grid gap-4 xl:grid-cols-2">
    <Card><CardHeader><CardTitle>Invite-only Event Page</CardTitle><CardDescription>Create the ad-hoc Black Swan + event microsite. Payment remains inactive; the commercial model is recorded for later.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={createPortal}>
      <select name="event_id" required className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select event</option>{events.map((e) => <option key={String(e.id)} value={String(e.id)}>{String(e.title || e.name || e.id)}</option>)}</select>
      <Input name="slug" required placeholder="private-event-slug" />
      <Input name="headline" placeholder="Invitation headline" />
      <textarea name="black_swan_intro" className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" placeholder="Short Black Swan introduction" />
      <textarea name="event_description" className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" placeholder="Event description" />
      <textarea name="program" className="min-h-28 w-full rounded-md border bg-background p-3 text-sm" placeholder="Programme — one item per line" />
      <div className="grid gap-3 md:grid-cols-2"><select name="access_mode" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="invite_token">Unique invite links</option><option value="passcode">Shared passcode</option><option value="invite_or_passcode">Invite links or passcode</option></select><Input name="passcode" type="password" placeholder="Passcode if enabled" /></div>
      <div className="grid gap-3 md:grid-cols-2"><Input name="capacity" type="number" min="1" placeholder="Capacity" /><Input name="max_companions" type="number" min="0" defaultValue="0" placeholder="Max companions" /></div>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="allow_companions" /> Allow companions</label>
      <div className="grid gap-3 md:grid-cols-2"><select name="commercial_model" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="free">Free</option><option value="pay_at_venue">Pay at venue</option><option value="bank_transfer">Bank transfer</option><option value="online_card">Online card — processor later</option><option value="host_settlement">Host settles event</option></select><select name="status" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></div>
      <Button disabled={busy}>Save Event Page</Button>
    </form></CardContent></Card>

    <Card><CardHeader><CardTitle>Issue Guest Invite</CardTitle><CardDescription>Each link is revocable and can be tied to the hosting Member. Passcode events can still use unique links for traceability.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={issueInvite}>
      <select name="portal_id" required className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select portal</option>{portals.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.slug)} · {String(p.status)}</option>)}</select>
      <select name="inviting_member_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Use event primary host</option>{members.map((m) => <option key={String(m.id)} value={String(m.id)}>{String(m.label || m.full_name || m.id)}</option>)}</select>
      <Input name="invitee_name" placeholder="Invitee name (optional)" /><Input name="invitee_email" type="email" placeholder="Invitee email (optional)" />
      <div className="grid gap-3 md:grid-cols-2"><Input name="expires_at" type="datetime-local" /><Input name="max_uses" type="number" min="1" defaultValue="1" /></div>
      <Button disabled={busy}>Create Invite Link</Button>
      {inviteUrl && <div className="break-all rounded-md border p-3 text-sm"><strong>Invite URL</strong><br />{inviteUrl}</div>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}{error && <p className="text-sm text-destructive">{error}</p>}
    </form></CardContent></Card>
  </div>
}
