'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const apiBase = process.env.NEXT_PUBLIC_BLACK_SWAN_ACCOUNTING_API_URL

type Department = { id: string; code: string; name: string }
type CostCenter = { id: string; code: string | null; name: string }
type DocumentRow = { id: string; document_number: string | null; document_type: string; currency: string; total_amount: number; status: string }
type Validation = { allocation_count: number; allocated_net: number; allocated_tax: number; allocated_total: number; document_total: number; invalid_allocation_count: number; is_reconciled: boolean }
type Allocation = { department_id: string; cost_center_id: string; account_code: string; allocation_type: string; description: string; amount: number; tax_amount: number }

type Payload = { document: DocumentRow; allocations: Allocation[]; departments: Department[]; cost_centers: CostCenter[]; validation: Validation }

async function token() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

async function callApi(path: string, init: RequestInit = {}) {
  if (!apiBase) throw new Error('Accounting Worker URL is not configured')
  const accessToken = await token()
  if (!accessToken) throw new Error('Authentication required')
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...(init.headers || {}) },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || 'Accounting request failed')
  return body.data
}

const emptyAllocation = (): Allocation => ({ department_id: '', cost_center_id: '', account_code: '', allocation_type: 'expense', description: '', amount: 0, tax_amount: 0 })

export function AccountingAllocationEditor({ documentId }: { documentId: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [rows, setRows] = useState<Allocation[]>([emptyAllocation()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const payload = await callApi(`/v1/accounting/documents/${documentId}/allocations`) as Payload
      setData(payload)
      setRows(payload.allocations?.length ? payload.allocations.map((row) => ({
        department_id: row.department_id || '', cost_center_id: row.cost_center_id || '', account_code: row.account_code || '', allocation_type: row.allocation_type || 'expense', description: row.description || '', amount: Number(row.amount || 0), tax_amount: Number(row.tax_amount || 0),
      })) : [emptyAllocation()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load allocations')
    }
  }, [documentId])

  useEffect(() => { void load() }, [load])

  const totals = useMemo(() => rows.reduce((acc, row) => ({ net: acc.net + Number(row.amount || 0), tax: acc.tax + Number(row.tax_amount || 0) }), { net: 0, tax: 0 }), [rows])
  const total = totals.net + totals.tax
  const matches = data ? total === Number(data.document.total_amount) : false

  function updateRow(index: number, patch: Partial<Allocation>) {
    setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  async function save() {
    setBusy(true); setError(null); setNotice(null)
    try {
      const validation = await callApi(`/v1/accounting/documents/${documentId}/allocations`, { method: 'POST', body: JSON.stringify({ allocations: rows }) }) as Validation
      setNotice(validation.is_reconciled ? 'Allocations saved and reconciled to document total.' : 'Allocations saved but are not reconciled.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save allocations')
    } finally { setBusy(false) }
  }

  async function createJournal() {
    setBusy(true); setError(null); setNotice(null)
    try {
      const journalId = await callApi(`/v1/accounting/documents/${documentId}/journal`, { method: 'POST', body: '{}' })
      window.location.href = `/accounting/posting/${String(journalId)}`
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create journal')
    } finally { setBusy(false) }
  }

  if (!data) return <div className="text-sm text-muted-foreground">{error || 'Loading allocations…'}</div>

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {notice && <div className="rounded-md border p-3 text-sm">{notice}</div>}

      <Card>
        <CardHeader>
          <CardTitle>{data.document.document_number || data.document.document_type}</CardTitle>
          <CardDescription>{data.document.currency} {data.document.total_amount} · canonical status {data.document.status}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-4 md:grid-cols-7">
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={row.allocation_type} onChange={(e) => updateRow(index, { allocation_type: e.target.value })}>
                {['expense','revenue','donation','asset','inventory','tax','intercompany','other'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={row.department_id} onChange={(e) => updateRow(index, { department_id: e.target.value })}>
                <option value="">Department</option>
                {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={row.cost_center_id} onChange={(e) => updateRow(index, { cost_center_id: e.target.value })}>
                <option value="">Cost center</option>
                {data.cost_centers.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ''}{c.name}</option>)}
              </select>
              <input className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Account code" value={row.account_code} onChange={(e) => updateRow(index, { account_code: e.target.value })} />
              <input className="rounded-md border bg-background px-3 py-2 text-sm" type="number" min="0" step="0.01" placeholder="Net" value={row.amount} onChange={(e) => updateRow(index, { amount: Number(e.target.value) })} />
              <input className="rounded-md border bg-background px-3 py-2 text-sm" type="number" min="0" step="0.01" placeholder="Tax" value={row.tax_amount} onChange={(e) => updateRow(index, { tax_amount: Number(e.target.value) })} />
              <div className="flex gap-2">
                <input className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm" placeholder="Description" value={row.description} onChange={(e) => updateRow(index, { description: e.target.value })} />
                <Button variant="outline" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} disabled={rows.length === 1}>×</Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRows((current) => [...current, emptyAllocation()])}>Add allocation</Button>
            <Button onClick={save} disabled={busy || !matches}>Save reconciled allocations</Button>
            <Button variant="secondary" onClick={createJournal} disabled={busy || !data.validation?.is_reconciled}>Create / open journal</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reconciliation</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4 text-sm">
          <div>Net allocated<br/><strong>{totals.net}</strong></div>
          <div>Tax allocated<br/><strong>{totals.tax}</strong></div>
          <div>Allocated total<br/><strong>{total}</strong></div>
          <div>Document total<br/><strong>{data.document.total_amount}</strong></div>
          <div className="md:col-span-4 text-muted-foreground">{matches ? 'Current allocation rows match the document total.' : 'Allocation rows must reconcile exactly to the document total before saving.'}</div>
        </CardContent>
      </Card>
    </div>
  )
}
