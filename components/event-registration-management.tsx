'use client'

import { FormEvent, useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

type Registration = {
  id: string
  full_name: string
  email: string
  registration_status: string
  payment_status: string
  registered_at: string
  checked_in_at?: string | null
  followup_status: string
  followup_notes?: string | null
  companions?: unknown[]
}

type Invite = {
  id: string
  invitee_name?: string | null
  invitee_email?: string | null
  status: string
  expires_at?: string | null
  used_count: number
  max_uses: number
  revocation_reason?: string | null
}

type Management = {
  portal: { id: string; event_id: string; slug: string; status: string; capacity?: number | null }
  reserved_seats: number
  registrations: Registration[]
  invites: Invite[]
}

type PortalOption = { id: string; slug: string; status: string }

type ActionResult = { checkin_token?: string | null; [key: string]: unknown }

async function token() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Authentication required')
  return data.session.access_token
}

async function api(path: string, init: RequestInit = {}) {
  if (!operationsApi) throw new Error('Operations API is not configured.')
  const access = await token()
  const response = await fetch(`${operationsApi}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${access}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result?.error?.message || result?.error?.code || 'Operation failed')
  return result.data
}

async function action(name: string, body: Record<string, unknown>) {
  return api(`/v1/os/actions/${name}`, { method: 'POST', body: JSON.stringify(body) })
}

export function EventRegistrationManagement() {
  const [portals, setPortals] = useState<PortalOption[]>([])
  const [portalId, setPortalId] = useState('')
  const [data, setData] = useState<Management | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [promotedPass, setPromotedPass] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const workspace = await api('/v1/os/workspaces/events')
        setPortals(Array.isArray(workspace?.portals) ? workspace.portals : [])
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load event portals') }
    })()
  }, [])

  async function load(id = portalId) {
    if (!id) return
    setBusy(true); setError(null)
    try { setData(await api(`/v1/os/event-portals/${id}`) as Management) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load registrations') }
    finally { setBusy(false) }
  }

  async function run(name: string, body: Record<string, unknown>) {
    setBusy(true); setError(null); setMessage(null); setPromotedPass(null)
    try {
      const result = await action(name, body) as ActionResult | null
      if (result?.checkin_token) {
        setPromotedPass(result.checkin_token)
        setMessage('Guest promoted. This new check-in pass is shown only now; send it to the guest.')
      } else setMessage('Saved.')
      await load()
      return result
    } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed'); return null }
    finally { setBusy(false) }
  }

  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const raw = String(form.get('checkin_token') || '').trim()
    const value = raw.startsWith('black-swan-checkin:') ? raw.slice('black-swan-checkin:'.length) : raw
    if (!value) return
    await run('event-registration-checkin', { checkin_token: value })
    event.currentTarget.reset()
  }

  return <Card>
    <CardHeader>
      <CardTitle>Guest Registration Control</CardTitle>
      <CardDescription>Manage waitlist, invitations, check-in and post-event follow-up. Check-in still requires the inviting Member to be on ground.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row">
        <select value={portalId} onChange={(e) => { setPortalId(e.target.value); setData(null); setPromotedPass(null) }} className="h-10 flex-1 rounded-md border bg-background px-3 text-sm">
          <option value="">Select event portal</option>
          {portals.map((portal) => <option key={portal.id} value={portal.id}>{portal.slug} · {portal.status}</option>)}
        </select>
        <Button type="button" variant="outline" disabled={!portalId || busy} onClick={() => void load()}>Load registrations</Button>
      </div>

      {promotedPass && <div className="flex flex-col items-center gap-3 rounded-md border p-4 text-center">
        <div className="bg-white p-3"><QRCode value={`black-swan-checkin:${promotedPass}`} size={160} /></div>
        <p className="text-xs text-muted-foreground">Promotion pass. Copy/send this QR now; only its hash is stored.</p>
      </div>}

      {data && <>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Portal</p><p className="text-sm font-medium">{data.portal.slug}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Reserved seats</p><p className="text-sm font-medium">{data.reserved_seats}{data.portal.capacity ? ` / ${data.portal.capacity}` : ''}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Status</p><p className="text-sm font-medium">{data.portal.status}</p></div>
        </div>

        <form onSubmit={checkIn} className="flex flex-col gap-2 rounded-md border p-4 md:flex-row">
          <Input name="checkin_token" placeholder="Scan or paste guest QR/check-in token" required />
          <Button disabled={busy}>Check in guest</Button>
        </form>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Registrations</h3>
          {data.registrations.length === 0 ? <p className="text-sm text-muted-foreground">No registrations yet.</p> : data.registrations.map((registration) => <div key={registration.id} className="rounded-md border p-4">
            <div className="flex flex-col justify-between gap-2 md:flex-row">
              <div><p className="font-medium">{registration.full_name}</p><p className="text-sm text-muted-foreground">{registration.email} · {registration.registration_status} · companions {Array.isArray(registration.companions) ? registration.companions.length : 0}</p></div>
              <div className="flex flex-wrap gap-2">
                {registration.registration_status === 'waitlist' && <Button size="sm" disabled={busy} onClick={() => void run('event-registration-status', { registration_id: registration.id, status: 'confirmed' })}>Promote</Button>}
                {registration.registration_status === 'confirmed' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run('event-registration-status', { registration_id: registration.id, status: 'cancelled' })}>Cancel</Button>}
                {registration.registration_status === 'confirmed' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run('event-registration-status', { registration_id: registration.id, status: 'no_show' })}>No show</Button>}
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              <select defaultValue={registration.followup_status || 'pending'} id={`followup-${registration.id}`} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="pending">Pending follow-up</option><option value="contacted">Contacted</option><option value="prospective_member">Prospective member</option><option value="donor_prospect">Donor prospect</option><option value="partner_prospect">Partner prospect</option><option value="closed">Closed</option>
              </select>
              <Input id={`notes-${registration.id}`} defaultValue={registration.followup_notes || ''} placeholder="Follow-up notes" />
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => {
                const status = (document.getElementById(`followup-${registration.id}`) as HTMLSelectElement | null)?.value || 'pending'
                const notes = (document.getElementById(`notes-${registration.id}`) as HTMLInputElement | null)?.value || ''
                void run('event-registration-followup', { registration_id: registration.id, followup_status: status, notes })
              }}>Save follow-up</Button>
            </div>
          </div>)}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Invites</h3>
          {data.invites.length === 0 ? <p className="text-sm text-muted-foreground">No invites issued.</p> : data.invites.map((invite) => <div key={invite.id} className="flex flex-col justify-between gap-2 rounded-md border p-3 md:flex-row md:items-center">
            <div><p className="text-sm font-medium">{invite.invitee_name || invite.invitee_email || 'Unnamed invite'}</p><p className="text-xs text-muted-foreground">{invite.status} · {invite.used_count}/{invite.max_uses} uses{invite.revocation_reason ? ` · ${invite.revocation_reason}` : ''}</p></div>
            {['active','used'].includes(invite.status) && <Button size="sm" variant="outline" disabled={busy} onClick={() => { const reason = window.prompt('Reason for revocation?'); if (reason) void run('event-portal-invite-revoke', { invite_id: invite.id, reason }) }}>Revoke</Button>}
          </div>)}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" disabled={busy || data.portal.status === 'closed'} onClick={() => { if (window.confirm('Close this event portal, mark checked-in guests completed, confirmed guests no-show, and start Education processing?')) void run('event-portal-close', { portal_id: data.portal.id }) }}>Close event → Education</Button>
        </div>
      </>}

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>
}
