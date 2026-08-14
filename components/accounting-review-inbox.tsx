'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ReviewItem = {
  id: string
  source_file_name: string | null
  status: string
  requires_review: boolean
  proposed_document_type: string | null
  proposed_legal_entity_id: string | null
  proposed_counterparty_id: string | null
  proposed_document_number: string | null
  proposed_document_date: string | null
  proposed_currency: string | null
  proposed_total_amount: number | null
  proposed_direction: string | null
  confidence: number | null
  created_at: string
}

type ApiResponse<T> = { data?: T; error?: { code?: string; message?: string } }

function formatAmount(amount: number | null, currency: string | null) {
  if (amount == null) return '—'
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency || 'CLP',
      maximumFractionDigits: currency === 'CLP' || !currency ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency || ''} ${amount.toLocaleString('es-CL')}`.trim()
  }
}

export function AccountingReviewInbox() {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<ReviewItem[]>([])
  const [selected, setSelected] = useState<ReviewItem | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiBase = process.env.NEXT_PUBLIC_BLACK_SWAN_ACCOUNTING_API_URL?.replace(/\/$/, '')

  async function authenticatedFetch(path: string, init: RequestInit = {}) {
    if (!apiBase) throw new Error('Accounting API is not configured for this environment.')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Authentication required.')

    return fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${session.access_token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
      cache: 'no-store',
    })
  }

  async function loadQueue() {
    setLoading(true)
    setError(null)
    try {
      const response = await authenticatedFetch('/v1/accounting/review')
      const payload = await response.json() as ApiResponse<ReviewItem[]>
      if (!response.ok) throw new Error(payload.error?.message || payload.error?.code || 'Unable to load review queue.')
      const rows = payload.data || []
      setItems(rows)
      setSelected(current => current ? rows.find(row => row.id === current.id) || null : rows[0] || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load review queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadQueue()
  }, [])

  async function decide(decision: 'approved' | 'rejected' | 'returned') {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await authenticatedFetch(`/v1/accounting/review/${selected.id}`, {
        method: 'POST',
        body: JSON.stringify({ decision, corrected_fields: {}, notes: notes || null }),
      })
      const payload = await response.json() as ApiResponse<ReviewItem>
      if (!response.ok) throw new Error(payload.error?.message || payload.error?.code || 'Unable to submit review.')
      setNotes('')
      await loadQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading accounting review queue…</div>
  }

  if (!apiBase) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="font-medium">Accounting review is not connected yet</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure NEXT_PUBLIC_BLACK_SWAN_ACCOUNTING_API_URL after the Cloudflare accounting Worker is deployed.
          No production accounting data has been changed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.6fr)]">
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <div className="font-medium">Review inbox</div>
            <div className="text-xs text-muted-foreground">OCR proposals waiting for human accounting review.</div>
          </div>
          <div className="divide-y">
            {items.length === 0 && <div className="p-5 text-sm text-muted-foreground">No documents currently require review.</div>}
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setSelected(item); setNotes('') }}
                className={`w-full px-4 py-3 text-left hover:bg-muted/50 ${selected?.id === item.id ? 'bg-muted/60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.source_file_name || 'Untitled document'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.proposed_document_type || 'Unclassified'} · {item.proposed_document_number || 'No document number'}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div>{formatAmount(item.proposed_total_amount, item.proposed_currency)}</div>
                    <div className="mt-1 text-muted-foreground">{item.confidence == null ? 'No confidence' : `${Math.round(item.confidence * 100)}%`}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          {!selected ? (
            <div className="p-6 text-sm text-muted-foreground">Select a document to review.</div>
          ) : (
            <div>
              <div className="border-b px-5 py-4">
                <div className="text-lg font-semibold">{selected.source_file_name || 'Accounting document'}</div>
                <div className="mt-1 text-sm text-muted-foreground">AI proposal only. Approval does not post a journal entry.</div>
              </div>

              <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
                <Field label="Document type" value={selected.proposed_document_type} />
                <Field label="Direction" value={selected.proposed_direction} />
                <Field label="Document number" value={selected.proposed_document_number} />
                <Field label="Document date" value={selected.proposed_document_date} />
                <Field label="Legal entity ID" value={selected.proposed_legal_entity_id} mono />
                <Field label="Counterparty ID" value={selected.proposed_counterparty_id} mono />
                <Field label="Total" value={formatAmount(selected.proposed_total_amount, selected.proposed_currency)} />
                <Field label="Confidence" value={selected.confidence == null ? null : `${Math.round(selected.confidence * 100)}%`} />
              </div>

              <div className="border-t p-5">
                <label className="text-sm font-medium" htmlFor="review-notes">Review notes</label>
                <textarea
                  id="review-notes"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Required context, corrections, or reason for return/rejection."
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button disabled={submitting} onClick={() => void decide('approved')} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Approve proposal</button>
                  <button disabled={submitting} onClick={() => void decide('returned')} className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">Return for correction</button>
                  <button disabled={submitting} onClick={() => void decide('rejected')} className="rounded-md border px-4 py-2 text-sm font-medium text-destructive disabled:opacity-50">Reject</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Field({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 break-words text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</div>
    </div>
  )
}
