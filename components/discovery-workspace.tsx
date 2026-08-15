'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

type Network = {
  id: string
  network_type: 'club' | 'event'
  event_id?: string | null
  title: string
  prompt?: string | null
  status: string
}

type Intent = {
  id: string
  intent_type: 'seek' | 'offer' | 'interest'
  summary: string
  details?: string | null
  privacy: 'network_only' | 'incognito' | 'private'
  status: string
  valid_until?: string | null
  networks?: Array<{ id: string; title: string; type: string }>
}

type Opportunity = {
  id: string
  network_id: string
  network_title: string
  confidence: number
  reason: string
  status: string
  counterpart_name: string
  counterpart_intent_type: string
  counterpart_intent: string
  my_status: string
  counterpart_status: string
  introduced_at?: string | null
}

type Workspace = {
  member_id?: string | null
  networks: Network[]
  my_intents: Intent[]
  opportunities: Opportunity[]
  summary: {
    active_intents?: number
    pending_opportunities?: number
    mutual_introductions?: number
  }
}

async function authToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Authentication required')
  return data.session.access_token
}

async function api(path: string, init: RequestInit = {}) {
  if (!operationsApi) throw new Error('Operations API is not configured.')
  const token = await authToken()
  const response = await fetch(`${operationsApi}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result?.error?.message || result?.error?.code || 'Discovery operation failed')
  return result.data
}

async function action(name: string, body: Record<string, unknown>) {
  return api(`/v1/os/actions/${name}`, { method: 'POST', body: JSON.stringify(body) })
}

function confidence(value: number) {
  return `${Math.round(Number(value || 0) * 100)}%`
}

export function DiscoveryWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try { setWorkspace(await api('/v1/os/workspaces/discovery') as Workspace) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load Discovery') }
  }

  useEffect(() => { void load() }, [])

  async function createIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null)
    const form = new FormData(event.currentTarget)
    const networkId = String(form.get('network_id') || '')
    const privacy = String(form.get('privacy') || 'network_only')
    try {
      await action('discovery-intent', {
        summary: form.get('summary'),
        details: form.get('details') || null,
        intent_type: form.get('intent_type'),
        privacy,
        network_ids: privacy === 'private' ? null : networkId ? [networkId] : null,
        valid_until: form.get('valid_until') || null,
      })
      event.currentTarget.reset()
      setMessage('Intent saved. Discovery only uses it inside the selected privacy scope.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create intent') }
    finally { setBusy(false) }
  }

  async function runAction(name: string, body: Record<string, unknown>, success: string) {
    setBusy(true); setError(null); setMessage(null)
    try { await action(name, body); setMessage(success); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Discovery operation failed') }
    finally { setBusy(false) }
  }

  const networks = workspace?.networks || []
  const intents = workspace?.my_intents || []
  const opportunities = workspace?.opportunities || []

  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Black Swan Discovery</CardTitle>
            <CardDescription>Private, intent-driven introductions. Declare what you need, what you can offer, or what you are exploring now.</CardDescription>
          </div>
          <Badge variant="outline">Mutual opt-in only</Badge>
        </div>
      </CardHeader>
    </Card>

    <div className="grid gap-3 md:grid-cols-3">
      <Card><CardHeader><CardDescription>Active intents</CardDescription><CardTitle>{workspace?.summary?.active_intents || 0}</CardTitle></CardHeader></Card>
      <Card><CardHeader><CardDescription>Pending opportunities</CardDescription><CardTitle>{workspace?.summary?.pending_opportunities || 0}</CardTitle></CardHeader></Card>
      <Card><CardHeader><CardDescription>Mutual introductions</CardDescription><CardTitle>{workspace?.summary?.mutual_introductions || 0}</CardTitle></CardHeader></Card>
    </div>

    <Card>
      <CardHeader><CardTitle>What are you looking for right now?</CardTitle><CardDescription>Create a current intent. Private intents stay as personal context and never enter matching.</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={createIntent}>
          <select name="intent_type" required className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="seek">I am looking for…</option>
            <option value="offer">I can offer…</option>
            <option value="interest">I am exploring…</option>
          </select>
          <select name="privacy" required className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="network_only">Network only</option>
            <option value="incognito">Incognito — reveal on mutual interest</option>
            <option value="private">Private — Concierge context only</option>
          </select>
          <Input name="summary" required minLength={5} maxLength={500} className="md:col-span-2" placeholder="Example: I am looking for someone experienced in vineyard water management." />
          <textarea name="details" className="min-h-24 rounded-md border bg-background p-3 text-sm md:col-span-2" placeholder="Optional context, constraints, timing or what a useful connection would look like." />
          <select name="network_id" className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">Black Swan Network</option>
            {networks.map((network) => <option key={network.id} value={network.id}>{network.network_type === 'event' ? 'Event · ' : ''}{network.title}</option>)}
          </select>
          <Input name="valid_until" type="datetime-local" />
          <div className="md:col-span-2"><Button disabled={busy}>Create intent</Button></div>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Your current intents</CardTitle><CardDescription>Pause, fulfil or expire an intent when it is no longer current.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {intents.length === 0 ? <p className="text-sm text-muted-foreground">No intents yet.</p> : intents.map((intent) => <div key={intent.id} className="rounded-md border p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2"><Badge variant="secondary">{intent.intent_type}</Badge><Badge variant="outline">{intent.privacy}</Badge><Badge variant="outline">{intent.status}</Badge></div>
              <p className="font-medium">{intent.summary}</p>
              {intent.details && <p className="text-sm text-muted-foreground">{intent.details}</p>}
              {Array.isArray(intent.networks) && intent.networks.length > 0 && <p className="text-xs text-muted-foreground">Scope: {intent.networks.map((network) => network.title).join(', ')}</p>}
            </div>
            {intent.status === 'active' && <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void runAction('discovery-intent-status', { intent_id: intent.id, status: 'paused' }, 'Intent paused.')}>Pause</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void runAction('discovery-intent-status', { intent_id: intent.id, status: 'fulfilled' }, 'Intent marked fulfilled.')}>Fulfilled</Button>
            </div>}
            {intent.status === 'paused' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void runAction('discovery-intent-status', { intent_id: intent.id, status: 'active' }, 'Intent reactivated.')}>Reactivate</Button>}
          </div>
        </div>)}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Discovery networks</CardTitle>
        <CardDescription>Run matching inside Black Swan or an event network. Matching never includes intents marked Private.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {networks.map((network) => <div key={network.id} className="rounded-md border p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{network.title}</p><p className="mt-1 text-sm text-muted-foreground">{network.prompt}</p></div><Badge variant="outline">{network.network_type}</Badge></div>
          <Button className="mt-4" size="sm" variant="outline" disabled={busy} onClick={() => void runAction('discovery-match', { network_id: network.id }, `Discovery refreshed for ${network.title}.`)}>Refresh opportunities</Button>
        </div>)}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Opportunities</CardTitle><CardDescription>An introduction is unlocked only when both members independently accept.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {opportunities.length === 0 ? <p className="text-sm text-muted-foreground">No opportunities yet. Add an intent and refresh a discovery network.</p> : opportunities.map((opportunity) => <div key={opportunity.id} className="rounded-md border p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2"><Badge variant="secondary">{confidence(opportunity.confidence)}</Badge><Badge variant="outline">{opportunity.network_title}</Badge><Badge variant="outline">{opportunity.status}</Badge></div>
              <p className="font-medium">{opportunity.status === 'mutual' ? opportunity.counterpart_name : opportunity.counterpart_name || 'Potential Black Swan connection'}</p>
              <p className="text-sm">{opportunity.counterpart_intent}</p>
              <p className="text-sm text-muted-foreground">{opportunity.reason}</p>
              {opportunity.status === 'mutual' && <p className="text-sm font-medium">Mutual interest confirmed. The introduction is unlocked.</p>}
            </div>
            {opportunity.status === 'pending' && opportunity.my_status === 'pending' && <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void runAction('discovery-opportunity', { opportunity_id: opportunity.id, decision: 'accepted' }, 'Interest recorded. The introduction unlocks only if the other member also accepts.')}>Interested</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void runAction('discovery-opportunity', { opportunity_id: opportunity.id, decision: 'declined' }, 'Opportunity declined.')}>Not now</Button>
            </div>}
            {opportunity.status === 'pending' && opportunity.my_status === 'accepted' && <Badge variant="outline">Waiting for the other member</Badge>}
          </div>
        </div>)}
      </CardContent>
    </Card>

    {message && <div className="rounded-md border p-3 text-sm text-muted-foreground">{message}</div>}
    {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
  </div>
}
