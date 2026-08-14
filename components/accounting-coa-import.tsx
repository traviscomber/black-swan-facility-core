'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const coaApi = process.env.NEXT_PUBLIC_BLACK_SWAN_COA_API_URL
const coreApi = process.env.NEXT_PUBLIC_BLACK_SWAN_API_URL

type Entity = { id: string; code: string; display_name: string }
type Batch = { id: string; legal_entity_id: string; source_name: string; source_file_name: string | null; status: string; row_count: number; valid_row_count: number; invalid_row_count: number; created_at: string }

async function token() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

async function api(base: string | undefined, path: string, init: RequestInit = {}) {
  if (!base) throw new Error('Worker URL is not configured')
  const access = await token()
  if (!access) throw new Error('Authentication required')
  const response = await fetch(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json', ...(init.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || 'Request failed')
  return body.data
}

function parseCsv(text: string) {
  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim())
  if (lines.length < 2) return []
  const parseLine = (line: string) => {
    const out: string[] = []
    let value = ''
    let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i]
      if (c === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1 }
      else if (c === '"') quoted = !quoted
      else if (c === ',' && !quoted) { out.push(value.trim()); value = '' }
      else value += c
    }
    out.push(value.trim())
    return out
  }
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim())
  return lines.slice(1).map((line) => {
    const values = parseLine(line)
    const row: Record<string, unknown> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    if (typeof row.is_active === 'string') row.is_active = !['false', '0', 'no', 'inactive'].includes(String(row.is_active).toLowerCase())
    return row
  })
}

export function AccountingCoaImport() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [entityId, setEntityId] = useState('')
  const [sourceName, setSourceName] = useState('Accountant Chart of Accounts')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [entityData, batchData] = await Promise.all([
        api(coreApi, '/v1/entities'),
        api(coaApi, '/v1/accounting/coa/imports'),
      ])
      setEntities(entityData || [])
      setBatches(batchData || [])
      if (!entityId && entityData?.[0]?.id) setEntityId(entityData[0].id)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load Chart of Accounts imports') }
  }, [entityId])

  useEffect(() => { void load() }, [load])

  async function chooseFile(file?: File) {
    if (!file) return
    const text = await file.text()
    setFileName(file.name)
    setRows(parseCsv(text))
  }

  async function stage() {
    if (!entityId || rows.length === 0) return
    setBusy('stage'); setError(null); setNotice(null)
    try {
      const batchId = await api(coaApi, '/v1/accounting/coa/imports', { method: 'POST', body: JSON.stringify({ legal_entity_id: entityId, source_name: sourceName, source_file_name: fileName || null }) })
      const validation = await api(coaApi, `/v1/accounting/coa/imports/${batchId}/rows`, { method: 'POST', body: JSON.stringify({ rows }) })
      setNotice(`Staged ${rows.length} rows. Valid: ${validation.valid_row_count}; invalid: ${validation.invalid_row_count}.`)
      setRows([]); setFileName('')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Staging failed') }
    finally { setBusy(null) }
  }

  async function action(id: string, verb: 'validate' | 'approve' | 'reject' | 'apply') {
    setBusy(`${id}:${verb}`); setError(null); setNotice(null)
    try {
      const result = await api(coaApi, `/v1/accounting/coa/imports/${id}/${verb}`, { method: 'POST', body: '{}' })
      setNotice(`${verb} complete${result?.applied_rows ? `: ${result.applied_rows} accounts applied` : ''}.`)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : `${verb} failed`) }
    finally { setBusy(null) }
  }

  return <div className="space-y-6">
    {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {notice && <div className="rounded-md border p-3 text-sm">{notice}</div>}

    <Card>
      <CardHeader><CardTitle>Import Canonical Chart of Accounts</CardTitle><CardDescription>CSV source is staged and validated first. Nothing changes canonical accounts until the batch is approved and applied.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Legal entity</label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            {entities.map((e) => <option key={e.id} value={e.id}>{e.display_name} ({e.code})</option>)}
          </select>
        </div>
        <div><label className="mb-1 block text-sm font-medium">Source</label><Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} /></div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">CSV file</label>
          <Input type="file" accept=".csv,text/csv" onChange={(e) => void chooseFile(e.target.files?.[0])} />
          <p className="mt-2 text-xs text-muted-foreground">Expected headers: account_code, account_name, account_type, parent_account_code, cashflow_class, is_active.</p>
        </div>
        <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3 text-sm"><span>{fileName ? `${fileName} · ${rows.length} rows` : 'No file staged'}</span><Button onClick={stage} disabled={!entityId || rows.length === 0 || busy === 'stage'}>Stage & validate</Button></div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Import Batches</CardTitle><CardDescription>Approval and apply are separate actions so accountant source can be reviewed before canonical changes.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {batches.length === 0 && <p className="text-sm text-muted-foreground">No Chart of Accounts import batches yet.</p>}
        {batches.map((b) => <div key={b.id} className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="flex items-center gap-2"><span className="font-medium">{b.source_name}</span><Badge variant="outline">{b.status}</Badge></div><div className="text-sm text-muted-foreground">{b.source_file_name || 'manual source'} · {b.row_count} rows · {b.valid_row_count} valid · {b.invalid_row_count} invalid</div></div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => action(b.id, 'validate')} disabled={!!busy}>Validate</Button>
              {['draft','review'].includes(b.status) && <Button size="sm" variant="outline" onClick={() => action(b.id, 'reject')} disabled={!!busy}>Reject</Button>}
              {b.status === 'review' && <Button size="sm" onClick={() => action(b.id, 'approve')} disabled={!!busy}>Approve</Button>}
              {b.status === 'approved' && <Button size="sm" onClick={() => action(b.id, 'apply')} disabled={!!busy}>Apply canonical accounts</Button>}
            </div>
          </div>
        </div>)}
      </CardContent>
    </Card>
  </div>
}
