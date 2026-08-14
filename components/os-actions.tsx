'use client'

import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

type Payload = Record<string, unknown>
type Option = { id: string; label: string; [key: string]: unknown }

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

function Select({ label, name, options, required = false, empty = 'Select' }: { label: string; name: string; options: Option[]; required?: boolean; empty?: string }) {
  return <label className="space-y-1 text-sm"><span className="text-muted-foreground">{label}</span><select name={name} required={required} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">{empty}</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
}

function formObject(form: HTMLFormElement) {
  const data = new FormData(form)
  const result: Record<string, unknown> = {}
  data.forEach((value, key) => { result[key] = typeof value === 'string' ? value : value.name })
  return result
}

function options(source: unknown): Option[] {
  return Array.isArray(source) ? source.map((v) => v as Option) : []
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1 } else quoted = !quoted
    } else if (ch === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell); cell = ''
      if (row.some((v) => v.trim() !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  if (cell.length || row.length) { row.push(cell); if (row.some((v) => v.trim() !== '')) rows.push(row) }
  if (rows.length < 2) throw new Error('CSV must contain a header and at least one data row.')
  const headers = rows[0].map((h) => h.trim())
  if (headers.some((h) => !h)) throw new Error('CSV contains an empty header.')
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() ?? ''])))
}

export function OsActions({ workspace, payload, references, onDone }: { workspace: string; payload: Payload; references: Payload; onDone: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [csvName, setCsvName] = useState('')

  const members = useMemo(() => options(references.members), [references])
  const suppliers = useMemo(() => options(references.suppliers), [references])
  const collections = useMemo(() => options(references.collections), [references])
  const materials = useMemo(() => options(references.education_materials || references.materials), [references])
  const publications = useMemo(() => options(references.publications), [references])
  const events = useMemo(() => options(references.events), [references])
  const providerProfiles = useMemo(() => options(references.provider_profiles), [references])
  const employees = useMemo(() => options(references.employees), [references])
  const entities = useMemo(() => options(references.legal_entities), [references])
  const departments = useMemo(() => options(references.departments), [references])
  const stockItems = useMemo(() => options(references.stock_items), [references])
  const batches = useMemo(() => Array.isArray(payload.batches) ? payload.batches as Array<Record<string, unknown>> : [], [payload])
  const importRows = useMemo(() => Array.isArray(payload.rows) ? payload.rows as Array<Record<string, unknown>> : [], [payload])

  async function submit(action: string, event: FormEvent<HTMLFormElement>, transform?: (body: Record<string, unknown>) => Record<string, unknown>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null)
    try {
      let body = formObject(event.currentTarget)
      if (transform) body = transform(body)
      await runAction(action, body)
      setMessage('Saved to the canonical workflow.')
      event.currentTarget.reset()
      await onDone()
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed') } finally { setBusy(false) }
  }

  async function readCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try { setCsvRows(parseCsv(await file.text())); setCsvName(file.name); setError(null) }
    catch (e) { setCsvRows([]); setCsvName(''); setError(e instanceof Error ? e.message : 'Unable to parse CSV') }
  }

  const status = <>{message && <div className="rounded-md border p-2 text-sm">{message}</div>}{error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</div>}</>

  if (workspace === 'people') return <div className="grid gap-4 xl:grid-cols-2">
    <Card><CardHeader><CardTitle>Member Presence</CardTitle><CardDescription>Guest eligibility follows the inviting Member's verified on-ground state.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('member-presence', e)}><Select label="Member" name="member_id" options={members} required /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Action</span><select name="action" className="h-10 w-full rounded-md border bg-background px-3"><option value="check_in">Check in</option><option value="check_out">Check out</option></select></label><Field label="Notes" name="notes" /><Button disabled={busy}>Save Presence</Button>{status}</form></CardContent></Card>
    <Card><CardHeader><CardTitle>Invite Guest</CardTitle><CardDescription>The Guest is created beneath the Member; entry is still blocked while the Member is off ground.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('guest-invitation', e)}><Select label="Inviting Member" name="member_id" options={members} required /><Field label="Guest name" name="guest_name" required /><Field label="Valid from" name="valid_from" type="datetime-local" required /><Field label="Valid until" name="valid_until" type="datetime-local" required /><Button disabled={busy}>Create Invitation</Button>{status}</form></CardContent></Card>
  </div>

  if (workspace === 'events') return <Card><CardHeader><CardTitle>Create Member Event</CardTitle><CardDescription>Every new event gets a Member relationship and Education collection in the same transaction.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => submit('event', e)}><Select label="Member" name="member_id" options={members} required /><Field label="Event name" name="name" required /><Field label="Start" name="start_date" type="date" required /><Field label="End" name="end_date" type="date" required /><Field label="Location" name="location_name" /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Member role</span><select name="member_role" className="h-10 w-full rounded-md border bg-background px-3"><option value="host">Host</option><option value="sponsor">Sponsor</option><option value="organizer">Organizer</option><option value="speaker">Speaker</option><option value="participant">Participant</option></select></label><div className="md:col-span-2"><Button disabled={busy}>Create Event + Education</Button></div>{status}</form></CardContent></Card>

  if (workspace === 'education') return <div className="grid gap-4 xl:grid-cols-2">
    <Card><CardHeader><CardTitle>Add Material</CardTitle><CardDescription>Add source material to the event's Education collection.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('education-material', e)}><Select label="Collection" name="collection_id" options={collections} required /><Field label="Title" name="title" required /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Type</span><select name="material_type" className="h-10 w-full rounded-md border bg-background px-3"><option value="recording">Recording</option><option value="video">Video</option><option value="presentation">Presentation</option><option value="transcript">Transcript</option><option value="article">Article</option><option value="research">Research</option><option value="summary">Summary</option><option value="learning_material">Learning material</option><option value="other">Other</option></select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Privacy</span><select name="privacy_level" className="h-10 w-full rounded-md border bg-background px-3"><option value="internal">Internal</option><option value="members">Members</option><option value="private">Private</option><option value="public">Public candidate</option></select></label><Field label="Source URL" name="source_url" /><Button disabled={busy}>Add Material</Button>{status}</form></CardContent></Card>
    <Card><CardHeader><CardTitle>Editorial Review</CardTitle><CardDescription>Public status is explicit; publication is still a separate gate.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('education-review', e)}><Select label="Material" name="material_id" options={materials} required /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Decision</span><select name="decision" className="h-10 w-full rounded-md border bg-background px-3"><option value="review">Review</option><option value="approved">Approve</option><option value="archived">Archive</option></select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Privacy</span><select name="privacy_level" className="h-10 w-full rounded-md border bg-background px-3"><option value="private">Private</option><option value="members">Members</option><option value="internal">Internal</option><option value="public">Public</option></select></label><Field label="Editorial notes" name="editorial_notes" /><Button disabled={busy}>Save Review</Button>{status}</form></CardContent></Card>
  </div>

  if (workspace === 'orchard-kitchen') return <div className="grid gap-4 xl:grid-cols-2">
    <Card><CardHeader><CardTitle>Record Cost</CardTitle><CardDescription>Creates a proposed Orchard/Kitchen accounting allocation.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('orchard-kitchen-cost', e, (b) => ({ ...b, amount_clp: Number(b.amount_clp) }))}><label className="space-y-1 text-sm"><span className="text-muted-foreground">Domain</span><select name="cost_domain" className="h-10 w-full rounded-md border bg-background px-3"><option value="orchard">Orchard</option><option value="kitchen">Kitchen</option><option value="shared">Shared</option></select></label><Field label="Amount CLP" name="amount_clp" type="number" required /><Field label="Date" name="incurred_on" type="date" required /><Field label="Description" name="description" required /><Select label="Supplier (optional)" name="supplier_id" options={suppliers} /><Button disabled={busy}>Record Proposed Cost</Button>{status}</form></CardContent></Card>
    <Card><CardHeader><CardTitle>Assign Responsibility</CardTitle><CardDescription>Use after Santi's employee master has canonically assigned Didi/Carlos to Corporación.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('orchard-kitchen-responsibility', e, (b) => ({ ...b, can_request_purchases: b.can_request_purchases === 'on', can_manage_costs: b.can_manage_costs === 'on' }))}><Select label="Employee" name="employee_id" options={employees} required empty={employees.length ? 'Select employee' : 'No canonical Corporación employees yet'} /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Responsibility</span><select name="responsibility_type" className="h-10 w-full rounded-md border bg-background px-3"><option value="lead">Lead</option><option value="operator">Operator</option><option value="purchaser">Purchaser</option><option value="reviewer">Reviewer</option></select></label><Field label="Effective from" name="effective_from" type="date" required /><label className="flex gap-2 text-sm"><input type="checkbox" name="can_request_purchases" /> Can request purchases</label><label className="flex gap-2 text-sm"><input type="checkbox" name="can_manage_costs" /> Can manage costs</label><Field label="Source reference" name="source_reference" placeholder="Santi employee master / approved source" /><Button disabled={busy || !employees.length}>Assign</Button>{status}</form></CardContent></Card>
  </div>

  if (workspace === 'event-providers') return <div className="grid gap-4 xl:grid-cols-2">
    <Card><CardHeader><CardTitle>Register Provider</CardTitle><CardDescription>Backed by an existing Supplier; compliance starts unverified.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('event-provider', e)}><Select label="Supplier" name="supplier_id" options={suppliers} required /><Field label="Service category" name="service_category" required /><Field label="Description" name="service_description" /><Field label="Coverage area" name="coverage_area" /><Field label="Capacity notes" name="capacity_notes" /><Button disabled={busy}>Register Provider</Button>{status}</form></CardContent></Card>
    <Card><CardHeader><CardTitle>Engage Provider for Event</CardTitle><CardDescription>Links provider history to a real event and optional procurement request.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('event-provider-engagement', e, (b) => ({ ...b, estimated_amount_clp: b.estimated_amount_clp ? Number(b.estimated_amount_clp) : null }))}><Select label="Event" name="event_id" options={events} required /><Select label="Provider" name="provider_profile_id" options={providerProfiles} required /><Field label="Scope of work" name="scope_of_work" required /><Field label="Estimated CLP" name="estimated_amount_clp" type="number" /><Field label="Procurement request ID (optional)" name="procurement_request_id" /><Button disabled={busy}>Plan Engagement</Button>{status}</form></CardContent></Card>
  </div>

  if (workspace === 'front-door') return <div className="grid gap-4 xl:grid-cols-2">
    <Card><CardHeader><CardTitle>Create Publication Draft</CardTitle><CardDescription>The Foundation front door starts from event-derived Education.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('publication-draft', e)}><Select label="Education material" name="education_material_id" options={materials} required /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Channel</span><select name="channel" className="h-10 w-full rounded-md border bg-background px-3"><option value="website">Website</option><option value="newsletter">Newsletter</option><option value="social">Social</option><option value="program">Program</option><option value="event_promotion">Event promotion</option><option value="partner">Partner</option></select></label><Field label="Public title" name="public_title" required /><Field label="Public summary" name="public_summary" /><Field label="Campaign reference" name="campaign_reference" /><Button disabled={busy}>Create Draft</Button>{status}</form></CardContent></Card>
    <Card><CardHeader><CardTitle>Publication Review</CardTitle><CardDescription>Database guard blocks approval/publication unless source Education is approved and public.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => submit('publication-review', e)}><Select label="Publication" name="publication_id" options={publications} required /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Decision</span><select name="decision" className="h-10 w-full rounded-md border bg-background px-3"><option value="review">Review</option><option value="approved">Approve</option><option value="published">Publish</option><option value="withdrawn">Withdraw</option></select></label><Field label="Published URL (required to publish)" name="published_url" /><Button disabled={busy}>Save Publication State</Button>{status}</form></CardContent></Card>
  </div>

  if (workspace === 'imports') return <div className="space-y-4">
    <Card><CardHeader><CardTitle>Stage Santi Source CSV</CardTitle><CardDescription>Rows are stored verbatim and remain unresolved. No company or employee/inventory match is inferred.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(null); setMessage(null); try { const b=formObject(e.currentTarget); await runAction('import-stage',{ import_type:b.import_type, source_name:csvName || b.source_name, rows:csvRows }); setMessage(`Staged ${csvRows.length} source rows for review.`); setCsvRows([]); setCsvName(''); e.currentTarget.reset(); await onDone() } catch(err){ setError(err instanceof Error?err.message:'Import failed') } finally { setBusy(false) } }}><label className="space-y-1 text-sm"><span className="text-muted-foreground">Import type</span><select name="import_type" className="h-10 w-full rounded-md border bg-background px-3"><option value="employee_master">Employee master</option><option value="inventory_master">Inventory master</option></select></label><Field label="Source name" name="source_name" placeholder="Santi canonical master" /><label className="space-y-1 text-sm md:col-span-2"><span className="text-muted-foreground">CSV file</span><Input type="file" accept=".csv,text/csv" onChange={readCsv} /></label><div className="text-sm text-muted-foreground md:col-span-2">{csvRows.length ? `${csvRows.length} rows ready from ${csvName}` : 'Select a canonical CSV export.'}</div><div className="md:col-span-2"><Button disabled={busy || !csvRows.length}>Stage Source Rows</Button></div>{status}</form></CardContent></Card>
    <Card><CardHeader><CardTitle>Resolve Source Row</CardTitle><CardDescription>Explicitly match a source row to one canonical record, legal entity and department.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => submit('import-resolve', e)}><label className="space-y-1 text-sm"><span className="text-muted-foreground">Unresolved row</span><select name="row_id" required className="h-10 w-full rounded-md border bg-background px-3"><option value="">Select row</option>{importRows.map((r) => <option key={String(r.id)} value={String(r.id)} data-import-type={String(r.import_type)}>{String(r.import_type)} #{String(r.row_number)} — {String(r.source_key || 'no key')}</option>)}</select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Import type</span><select name="import_type" className="h-10 w-full rounded-md border bg-background px-3"><option value="employee_master">Employee</option><option value="inventory_master">Inventory</option></select></label><Select label="Legal entity" name="legal_entity_id" options={entities} required /><Select label="Department" name="department_id" options={departments} /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Matched canonical record</span><select name="matched_record_id" required className="h-10 w-full rounded-md border bg-background px-3"><option value="">Select employee or inventory item</option>{employees.map((o)=><option key={`e-${o.id}`} value={o.id}>Employee — {o.label}</option>)}{stockItems.map((o)=><option key={`i-${o.id}`} value={o.id}>Inventory — {o.label}</option>)}</select></label><Field label="Review notes" name="notes" /><div className="md:col-span-2"><Button disabled={busy}>Resolve Row</Button></div>{status}</form></CardContent></Card>
    <Card><CardHeader><CardTitle>Approve / Apply Batch</CardTitle><CardDescription>Approval fails while unresolved/ambiguous rows remain. Apply creates assignments only after approval and refuses silent reassignment conflicts.</CardDescription></CardHeader><CardContent className="grid gap-4 xl:grid-cols-2"><form className="space-y-3" onSubmit={(e) => submit('import-review', e)}><label className="space-y-1 text-sm"><span className="text-muted-foreground">Batch</span><select name="batch_id" required className="h-10 w-full rounded-md border bg-background px-3"><option value="">Select batch</option>{batches.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.source_name)} — {String(b.status)}</option>)}</select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Decision</span><select name="decision" className="h-10 w-full rounded-md border bg-background px-3"><option value="approved">Approve</option><option value="rejected">Reject</option></select></label><Field label="Notes" name="notes" /><Button disabled={busy}>Save Review</Button></form><form className="space-y-3" onSubmit={(e) => submit('import-apply', e)}><label className="space-y-1 text-sm"><span className="text-muted-foreground">Approved batch</span><select name="batch_id" required className="h-10 w-full rounded-md border bg-background px-3"><option value="">Select approved batch</option>{batches.filter((b)=>b.status==='approved').map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.source_name)}</option>)}</select></label><Button disabled={busy}>Apply Canonical Assignments</Button></form>{status}</CardContent></Card>
  </div>

  if (workspace === 'intercompany') return <Card><CardHeader><CardTitle>Create Intercompany Draft Rule</CardTitle><CardDescription>Draft only. Approved commercial terms remain mandatory before activation.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={(e) => submit('intercompany-rule', e, (b) => ({ ...b, fixed_amount: b.fixed_amount ? Number(b.fixed_amount) : null, percentage_rate: b.percentage_rate ? Number(b.percentage_rate) : null }))}><Field label="Rule name" name="rule_name" required /><Select label="Source entity" name="source_legal_entity_id" options={entities} required /><Select label="Destination entity" name="destination_legal_entity_id" options={entities} required /><label className="space-y-1 text-sm"><span className="text-muted-foreground">Type</span><select name="rule_type" className="h-10 w-full rounded-md border bg-background px-3"><option value="lease">Lease</option><option value="service">Service</option><option value="cost_share">Cost share</option><option value="reimbursement">Reimbursement</option><option value="asset_charge">Asset charge</option><option value="management_fee">Management fee</option><option value="other">Other</option></select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Frequency</span><select name="frequency" className="h-10 w-full rounded-md border bg-background px-3"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="ad_hoc">Ad hoc</option></select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Calculation</span><select name="calculation_method" className="h-10 w-full rounded-md border bg-background px-3"><option value="manual">Manual</option><option value="fixed">Fixed</option><option value="percentage">Percentage</option></select></label><Field label="Effective from" name="effective_from" type="date" required /><Field label="Fixed amount" name="fixed_amount" type="number" /><Field label="Percentage rate" name="percentage_rate" type="number" /><Field label="Tax treatment" name="tax_treatment" /><Field label="Agreement reference" name="agreement_reference" /><Field label="Notes" name="notes" /><div className="xl:col-span-3"><Button disabled={busy}>Save Draft Rule</Button></div>{status}</form></CardContent></Card>

  return null
}
