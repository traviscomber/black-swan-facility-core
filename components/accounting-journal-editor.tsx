'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const apiBase = process.env.NEXT_PUBLIC_BLACK_SWAN_ACCOUNTING_API_URL

type Account = { id: string; account_code: string; account_name: string; account_type: string }
type Department = { id: string; code: string; name: string }
type CostCenter = { id: string; code: string | null; name: string }
type JournalLine = {
  id?: string
  account_id: string
  department_id: string
  cost_center_id: string
  debit: string
  credit: string
  description: string
}
type Validation = {
  line_count: number
  total_debit: number
  total_credit: number
  invalid_line_count: number
  is_balanced: boolean
}
type JournalEntry = {
  id: string
  legal_entity_id: string
  entry_date: string
  reference: string | null
  description: string | null
  status: 'draft' | 'approved' | 'posted' | 'reversed'
}

type ReferencePayload = {
  journal: { entry: JournalEntry; lines: Array<Partial<JournalLine> & { debit?: number; credit?: number }>; validation: Validation }
  accounts: Account[]
  departments: Department[]
  cost_centers: CostCenter[]
}

const emptyLine = (): JournalLine => ({
  account_id: '',
  department_id: '',
  cost_center_id: '',
  debit: '',
  credit: '',
  description: '',
})

async function authToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

async function callApi(path: string, init: RequestInit = {}) {
  if (!apiBase) throw new Error('Accounting Worker URL is not configured')
  const token = await authToken()
  if (!token) throw new Error('Authentication required')
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || 'Accounting request failed')
  return body.data
}

export function AccountingJournalEditor({ journalId }: { journalId: string }) {
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()])
  const [validation, setValidation] = useState<Validation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await callApi(`/v1/accounting/journals/${journalId}/references`) as ReferencePayload
      setEntry(data.journal.entry)
      setAccounts(data.accounts || [])
      setDepartments(data.departments || [])
      setCostCenters(data.cost_centers || [])
      setValidation(data.journal.validation || null)
      const saved = data.journal.lines || []
      setLines(saved.length ? saved.map((line) => ({
        id: line.id,
        account_id: line.account_id || '',
        department_id: line.department_id || '',
        cost_center_id: line.cost_center_id || '',
        debit: line.debit ? String(line.debit) : '',
        credit: line.credit ? String(line.credit) : '',
        description: line.description || '',
      })) : [emptyLine(), emptyLine()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load journal')
    }
  }, [journalId])

  useEffect(() => { void load() }, [load])

  const localTotals = useMemo(() => lines.reduce((acc, line) => ({
    debit: acc.debit + (Number(line.debit) || 0),
    credit: acc.credit + (Number(line.credit) || 0),
  }), { debit: 0, credit: 0 }), [lines])

  const editable = entry?.status === 'draft'
  const locallyBalanced = lines.length >= 2 && localTotals.debit > 0 && localTotals.debit === localTotals.credit

  function updateLine(index: number, patch: Partial<JournalLine>) {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line))
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index))
  }

  async function saveLines() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const payload = lines.map((line) => ({
        account_id: line.account_id || null,
        department_id: line.department_id || null,
        cost_center_id: line.cost_center_id || null,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        description: line.description || null,
      }))
      const result = await callApi(`/v1/accounting/journals/${journalId}/lines`, {
        method: 'POST',
        body: JSON.stringify({ lines: payload }),
      }) as Validation
      setValidation(result)
      setNotice(result.is_balanced ? 'Journal lines saved and balanced.' : 'Journal lines saved. Balance validation is not yet passing.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save journal lines')
    } finally {
      setBusy(false)
    }
  }

  async function journalAction(action: 'approve' | 'post') {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await callApi(`/v1/accounting/journals/${journalId}/${action}`, { method: 'POST', body: '{}' })
      setNotice(action === 'approve' ? 'Journal approved.' : 'Journal posted to the canonical ledger.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : `Unable to ${action} journal`)
    } finally {
      setBusy(false)
    }
  }

  if (!apiBase) {
    return <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">NEXT_PUBLIC_BLACK_SWAN_ACCOUNTING_API_URL is not configured.</div>
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {notice && <div className="rounded-md border p-3 text-sm">{notice}</div>}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Journal {entry?.reference || journalId}</CardTitle>
              <CardDescription>{entry?.entry_date || ''} · {entry?.description || 'Canonical accounting journal'}</CardDescription>
            </div>
            {entry && <Badge variant="outline">{entry.status}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div><div className="text-xs text-muted-foreground">Lines</div><div className="text-lg font-medium">{validation?.line_count ?? lines.length}</div></div>
          <div><div className="text-xs text-muted-foreground">Debit</div><div className="text-lg font-medium">{localTotals.debit.toLocaleString()}</div></div>
          <div><div className="text-xs text-muted-foreground">Credit</div><div className="text-lg font-medium">{localTotals.credit.toLocaleString()}</div></div>
          <div><div className="text-xs text-muted-foreground">Validation</div><div className="text-lg font-medium">{validation?.is_balanced ? 'Balanced' : 'Pending'}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journal Lines</CardTitle>
          <CardDescription>Select only canonical accounts and optional entity-bound department/cost center values. Approved or posted journals are immutable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 && <div className="rounded-md border p-3 text-sm text-muted-foreground">No canonical Chart of Accounts is available for this legal entity. Import the accountant-approved accounts before journal posting.</div>}

          {lines.map((line, index) => (
            <div key={line.id || index} className="grid gap-3 rounded-lg border p-4 lg:grid-cols-12">
              <label className="lg:col-span-3 text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Account</span>
                <select className="h-10 w-full rounded-md border bg-background px-3" value={line.account_id} disabled={!editable} onChange={(e) => updateLine(index, { account_id: e.target.value })}>
                  <option value="">Select account</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.account_code} · {account.account_name}</option>)}
                </select>
              </label>
              <label className="lg:col-span-2 text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Department</span>
                <select className="h-10 w-full rounded-md border bg-background px-3" value={line.department_id} disabled={!editable} onChange={(e) => updateLine(index, { department_id: e.target.value })}>
                  <option value="">None</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
              <label className="lg:col-span-2 text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Cost center</span>
                <select className="h-10 w-full rounded-md border bg-background px-3" value={line.cost_center_id} disabled={!editable} onChange={(e) => updateLine(index, { cost_center_id: e.target.value })}>
                  <option value="">None</option>
                  {costCenters.map((cc) => <option key={cc.id} value={cc.id}>{cc.code ? `${cc.code} · ` : ''}{cc.name}</option>)}
                </select>
              </label>
              <label className="lg:col-span-1 text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Debit</span>
                <input className="h-10 w-full rounded-md border bg-background px-3" type="number" min="0" step="0.01" value={line.debit} disabled={!editable} onChange={(e) => updateLine(index, { debit: e.target.value, ...(Number(e.target.value) > 0 ? { credit: '' } : {}) })} />
              </label>
              <label className="lg:col-span-1 text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Credit</span>
                <input className="h-10 w-full rounded-md border bg-background px-3" type="number" min="0" step="0.01" value={line.credit} disabled={!editable} onChange={(e) => updateLine(index, { credit: e.target.value, ...(Number(e.target.value) > 0 ? { debit: '' } : {}) })} />
              </label>
              <label className="lg:col-span-2 text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Description</span>
                <input className="h-10 w-full rounded-md border bg-background px-3" value={line.description} disabled={!editable} onChange={(e) => updateLine(index, { description: e.target.value })} />
              </label>
              <div className="flex items-end lg:col-span-1">
                <Button type="button" variant="outline" disabled={!editable || lines.length <= 2} onClick={() => removeLine(index)}>Remove</Button>
              </div>
            </div>
          ))}

          {editable && <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, emptyLine()])}>Add line</Button>
            <Button type="button" onClick={saveLines} disabled={busy || accounts.length === 0}>Save & validate</Button>
          </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posting Controls</CardTitle>
          <CardDescription>Approval and posting always call database validation again. UI totals are only a preview.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {entry?.status === 'draft' && <Button disabled={busy || !validation?.is_balanced || !locallyBalanced} onClick={() => journalAction('approve')}>Approve journal</Button>}
          {entry?.status === 'approved' && <Button disabled={busy || !validation?.is_balanced} onClick={() => journalAction('post')}>Post to ledger</Button>}
          {entry?.status === 'posted' && <Badge>Posted</Badge>}
          {!validation?.is_balanced && <span className="text-sm text-muted-foreground">Posting remains locked until the canonical validation reports a balanced journal.</span>}
        </CardContent>
      </Card>
    </div>
  )
}
