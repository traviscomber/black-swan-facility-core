'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

const bankingApi = process.env.NEXT_PUBLIC_BLACK_SWAN_BANKING_API_URL

type CashTransaction = {
  id: string
  legal_entity_id: string
  transaction_date: string
  direction: string
  amount: number
  currency: string
  bank_reference: string | null
  description: string | null
  reconciliation_status: string
}

type Proposal = {
  id: string
  accounting_document_id: string
  matched_amount: number
  match_method: string
  confidence: number | null
  status: string
  notes: string | null
}

async function accessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

async function callApi(path: string, init: RequestInit = {}) {
  if (!bankingApi) throw new Error('NEXT_PUBLIC_BLACK_SWAN_BANKING_API_URL is not configured')
  const token = await accessToken()
  if (!token) throw new Error('Authentication required')
  const response = await fetch(`${bankingApi}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || 'Banking request failed')
  return body.data
}

export function BankReconciliationReview() {
  const [cash, setCash] = useState<CashTransaction[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadCash() {
    setError(null)
    try {
      const rows = await callApi('/v1/banking/cash-transactions')
      setCash(rows || [])
      if (!selectedId && rows?.[0]?.id) setSelectedId(rows[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load cash transactions')
    }
  }

  async function loadProposals(cashId: string) {
    setError(null)
    try {
      setProposals(await callApi(`/v1/banking/cash-transactions/${cashId}/reconciliation-proposals`) || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load reconciliation proposals')
    }
  }

  useEffect(() => { void loadCash() }, [])
  useEffect(() => { if (selectedId) void loadProposals(selectedId) }, [selectedId])

  async function generateProposals(cashId: string) {
    setBusy(cashId)
    try {
      await callApi(`/v1/banking/cash-transactions/${cashId}/reconciliation-proposals`, { method: 'POST', body: '{}' })
      await loadProposals(cashId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to generate proposals')
    } finally {
      setBusy(null)
    }
  }

  async function review(matchId: string, decision: 'approved' | 'rejected') {
    setBusy(matchId)
    try {
      await callApi(`/v1/banking/reconciliation-matches/${matchId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes: notes[matchId] || null }),
      })
      if (selectedId) await loadProposals(selectedId)
      await loadCash()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to review reconciliation')
    } finally {
      setBusy(null)
    }
  }

  const selected = cash.find((row) => row.id === selectedId) || null

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Cash Transactions</CardTitle>
          <CardDescription>Select a bank movement to review matching proposals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {cash.length === 0 && <p className="text-sm text-muted-foreground">No bank transactions available.</p>}
          {cash.map((row) => (
            <button
              key={row.id}
              className={`w-full rounded-lg border p-3 text-left ${selectedId === row.id ? 'border-foreground' : ''}`}
              onClick={() => setSelectedId(row.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{row.currency} {Number(row.amount).toLocaleString()}</span>
                <Badge variant="outline">{row.reconciliation_status}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{row.transaction_date} · {row.direction}</div>
              <div className="mt-1 truncate text-sm">{row.description || row.bank_reference || row.id}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

        {selected && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{selected.currency} {Number(selected.amount).toLocaleString()}</CardTitle>
                  <CardDescription>{selected.transaction_date} · {selected.description || selected.bank_reference || 'Bank transaction'}</CardDescription>
                </div>
                <Button variant="outline" onClick={() => generateProposals(selected.id)} disabled={busy === selected.id}>
                  Generate proposals
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Proposals</CardTitle>
            <CardDescription>Every match requires explicit human approval. Approvals cannot exceed the cash movement or accounting document total.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {proposals.length === 0 && <p className="text-sm text-muted-foreground">No reconciliation proposals.</p>}
            {proposals.map((proposal) => (
              <div key={proposal.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Document {proposal.accounting_document_id}</div>
                    <div className="text-sm text-muted-foreground">
                      Match {Number(proposal.matched_amount).toLocaleString()} · {proposal.match_method} · confidence {proposal.confidence == null ? 'n/a' : `${Math.round(proposal.confidence * 100)}%`}
                    </div>
                  </div>
                  <Badge variant="outline">{proposal.status}</Badge>
                </div>

                {proposal.status === 'proposed' && (
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                    <Input
                      placeholder="Review notes (optional)"
                      value={notes[proposal.id] || ''}
                      onChange={(e) => setNotes((current) => ({ ...current, [proposal.id]: e.target.value }))}
                    />
                    <Button onClick={() => review(proposal.id, 'approved')} disabled={busy === proposal.id}>Approve</Button>
                    <Button variant="outline" onClick={() => review(proposal.id, 'rejected')} disabled={busy === proposal.id}>Reject</Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
