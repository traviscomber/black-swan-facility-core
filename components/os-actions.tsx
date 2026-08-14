'use client'

import { FormEvent, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

type Payload = Record<string, unknown>

async function runAction(action: string, body: Record<string, unknown>) {
  if (!operationsApi) throw new Error('NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL is not configured.')
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Authentication required')
  const response = await fetch(`${operationsApi}/v1/os/actions/${action}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result?.error?.message || result?.error?.code || 'Action failed')
  return result.data
}

function Field({ label, name, type = 'text', required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return <label className="space-y-1 text-sm"><span className="text-muted-foreground">{label}</span><Input name={name} type={type} required={required} placeholder={placeholder} /></label>
}

function formObject(form: HTMLFormElement) {
  const data = new FormData(form)
  const result: Record<string, unknown> = {}
  data.forEach((value, key) => { result[key] = typeof value === 'string' ? value : value.name })
  return result
}

export function OsActions({ workspace, payload, onDone }: { workspace: string; payload: Payload; onDone: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const members = useMemo(() => Array.isArray(payload.members) ? payload.members as Array<Record<string, unknown>> : [], [payload])
  const collections = useMemo(() => Array.isArray(payload.collections) ? payload.collections as Array<Record<string, unknown>> : [], [payload])
  const batches = useMemo(() => Array.isArray(payload.batches) ? payload.batches as Array<Record<string, unknown>> : [], [payload])

  async function submit(action: string, event: FormEvent<HTMLFormElement>, transform?: (body: Record<string, unknown>) => Record<string, unknown>) {
    event.preventDefault()
    setBusy(true); setError(null); setMessage(null)
    try {
      let body = formObject(event.currentTarget)
      if (transform) body = transform(body)
      await runAction(action, body)
      setMessage('Saved to the canonical review workflow.')
      event.currentTarget.reset()
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally { setBusy(false) }
  }

  const status = <>{message && <div className="rounded-md border p-2 text-sm">{message}</div>}{error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</div>}</>

  if (workspace === 'people') return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Member Presence</CardTitle><CardDescription>Check a Member on or off ground. Guest access immediately follows this canonical state.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('member-presence', e)}>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Member</span><select name="member_id" required className="h-10 w-full rounded-md border bg-background px-3"><option value="">Select Member</option>{members.map((m) => <option key={String(m.id)} value={String(m.id)}>{String(m.full_name || m.id)}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Action</span><select name="action" className="h-10 w-full rounded-md border bg-background px-3"><option value="check_in">Check in</option><option value="check_out">Check out</option></select></label>
        <Field label="Notes" name="notes" /><Button disabled={busy}>Save Presence</Button>{status}
      </form></CardContent></Card>
      <Card><CardHeader><CardTitle>Invite Guest</CardTitle><CardDescription>Creates the Guest beneath the inviting Member. Entry remains blocked unless that Member is on ground.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('guest-invitation', e)}>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Inviting Member</span><select name="member_id" required className="h-10 w-full rounded-md border bg-background px-3"><option value="">Select Member</option>{members.map((m) => <option key={String(m.id)} value={String(m.id)}>{String(m.full_name || m.id)}</option>)}</select></label>
        <Field label="Guest name" name="guest_name" required /><Field label="Valid from" name="valid_from" type="datetime-local" required /><Field label="Valid until" name="valid_until" type="datetime-local" required /><Button disabled={busy}>Create Invitation</Button>{status}
      </form></CardContent></Card>
    </div>
  )

  if (workspace === 'events') return <Card><CardHeader><CardTitle>Create Member Event</CardTitle><CardDescription>The event is created with a required Member relationship and an Education collection immediately.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => submit('event', e)}>
    <Field label="Member ID" name="member_id" required placeholder="Canonical Member UUID" /><Field label="Event name" name="name" required /><Field label="Start" name="start_date" type="date" required /><Field label="End" name="end_date" type="date" required /><Field label="Location" name="location_name" /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Member role</span><select name="member_role" className="h-10 w-full rounded-md border bg-background px-3"><option value="host">Host</option><option value="sponsor">Sponsor</option><option value="organizer">Organizer</option><option value="speaker">Speaker</option><option value="participant">Participant</option></select></label><div className="md:col-span-2"><Button disabled={busy}>Create Event + Education</Button></div>{status}
  </form></CardContent></Card>

  if (workspace === 'education') return <Card><CardHeader><CardTitle>Add Educational Material</CardTitle><CardDescription>Add source material to an event Education collection. Publication remains a separate editorial gate.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => submit('education-material', e)}>
    <label className="space-y-1 text-sm"><span className="text-muted-foreground">Collection</span><select name="collection_id" required className="h-10 w-full rounded-md border bg-background px-3"><option value="">Select collection</option>{collections.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.title || c.id)}</option>)}</select></label>
    <Field label="Title" name="title" required /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Type</span><select name="material_type" className="h-10 w-full rounded-md border bg-background px-3"><option value="recording">Recording</option><option value="video">Video</option><option value="presentation">Presentation</option><option value="transcript">Transcript</option><option value="article">Article</option><option value="research">Research</option><option value="summary">Summary</option><option value="learning_material">Learning material</option><option value="other">Other</option></select></label>
    <label className="space-y-1 text-sm"><span className="text-muted-foreground">Privacy</span><select name="privacy_level" className="h-10 w-full rounded-md border bg-background px-3"><option value="internal">Internal</option><option value="members">Members</option><option value="private">Private</option><option value="public">Public candidate</option></select></label><Field label="Source URL" name="source_url" /><div className="md:col-span-2"><Button disabled={busy}>Add Material</Button></div>{status}
  </form></CardContent></Card>

  if (workspace === 'orchard-kitchen') return <Card><CardHeader><CardTitle>Record Orchard / Kitchen Cost</CardTitle><CardDescription>Creates a proposed operational cost allocation for later accounting review.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => submit('orchard-kitchen-cost', e, (b) => ({ ...b, amount_clp: Number(b.amount_clp) }))}>
    <label className="space-y-1 text-sm"><span className="text-muted-foreground">Domain</span><select name="cost_domain" className="h-10 w-full rounded-md border bg-background px-3"><option value="orchard">Orchard</option><option value="kitchen">Kitchen</option><option value="shared">Shared</option></select></label><Field label="Amount CLP" name="amount_clp" type="number" required /><Field label="Date" name="incurred_on" type="date" required /><Field label="Description" name="description" required /><Field label="Supplier ID (optional)" name="supplier_id" /><Field label="Procurement request ID (optional)" name="procurement_request_id" /><div className="md:col-span-2"><Button disabled={busy}>Record Proposed Cost</Button></div>{status}
  </form></CardContent></Card>

  if (workspace === 'event-providers') return <Card><CardHeader><CardTitle>Register Event Provider</CardTitle><CardDescription>Uses an existing canonical Supplier and starts compliance as unverified.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => submit('event-provider', e)}>
    <Field label="Supplier ID" name="supplier_id" required /><Field label="Service category" name="service_category" required /><Field label="Service description" name="service_description" /><Field label="Coverage area" name="coverage_area" /><Field label="Capacity notes" name="capacity_notes" /><div className="md:col-span-2"><Button disabled={busy}>Register Provider</Button></div>{status}
  </form></CardContent></Card>

  if (workspace === 'front-door') return <Card><CardHeader><CardTitle>Create Publication Draft</CardTitle><CardDescription>Creates a draft only. Existing database guards still prevent public approval unless the source educational material is approved and public.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => submit('publication-draft', e)}>
    <Field label="Education material ID" name="education_material_id" required /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Channel</span><select name="channel" className="h-10 w-full rounded-md border bg-background px-3"><option value="website">Website</option><option value="newsletter">Newsletter</option><option value="social">Social</option><option value="program">Program</option><option value="event_promotion">Event promotion</option><option value="partner">Partner</option></select></label><Field label="Public title" name="public_title" required /><Field label="Campaign reference" name="campaign_reference" /><div className="md:col-span-2"><Field label="Public summary" name="public_summary" /></div><div className="md:col-span-2"><Button disabled={busy}>Create Draft</Button></div>{status}
  </form></CardContent></Card>

  if (workspace === 'imports') return <Card><CardHeader><CardTitle>Review Canonical Import Batch</CardTitle><CardDescription>Approval is blocked while any source row remains unresolved or ambiguous.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => submit('import-review', e)}>
    <label className="space-y-1 text-sm"><span className="text-muted-foreground">Batch</span><select name="batch_id" required className="h-10 w-full rounded-md border bg-background px-3"><option value="">Select batch</option>{batches.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.source_name || b.id)} — {String(b.status || '')}</option>)}</select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Decision</span><select name="decision" className="h-10 w-full rounded-md border bg-background px-3"><option value="approved">Approve</option><option value="rejected">Reject</option></select></label><div className="md:col-span-2"><Field label="Notes" name="notes" /></div><div className="md:col-span-2"><Button disabled={busy}>Save Review</Button></div>{status}
  </form></CardContent></Card>

  if (workspace === 'intercompany') return <Card><CardHeader><CardTitle>Create Intercompany Draft Rule</CardTitle><CardDescription>Draft only. Use the approved agreement for amounts, tax treatment and agreement reference; do not estimate them.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={(e) => submit('intercompany-rule', e, (b) => ({ ...b, fixed_amount: b.fixed_amount ? Number(b.fixed_amount) : null, percentage_rate: b.percentage_rate ? Number(b.percentage_rate) : null }))}>
    <Field label="Rule name" name="rule_name" required /><Field label="Source entity ID" name="source_legal_entity_id" required /><Field label="Destination entity ID" name="destination_legal_entity_id" required /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Type</span><select name="rule_type" className="h-10 w-full rounded-md border bg-background px-3"><option value="lease">Lease</option><option value="service">Service</option><option value="cost_share">Cost share</option><option value="reimbursement">Reimbursement</option><option value="asset_charge">Asset charge</option><option value="management_fee">Management fee</option><option value="other">Other</option></select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Frequency</span><select name="frequency" className="h-10 w-full rounded-md border bg-background px-3"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="ad_hoc">Ad hoc</option></select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Calculation</span><select name="calculation_method" className="h-10 w-full rounded-md border bg-background px-3"><option value="manual">Manual</option><option value="fixed">Fixed</option><option value="percentage">Percentage</option></select></label><Field label="Effective from" name="effective_from" type="date" required /><Field label="Fixed amount" name="fixed_amount" type="number" /><Field label="Percentage rate" name="percentage_rate" type="number" /><Field label="Tax treatment" name="tax_treatment" /><Field label="Agreement reference" name="agreement_reference" /><Field label="Notes" name="notes" /><div className="xl:col-span-3"><Button disabled={busy}>Save Draft Rule</Button></div>{status}
  </form></CardContent></Card>

  return null
}
