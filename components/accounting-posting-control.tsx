'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const apiBase = process.env.NEXT_PUBLIC_BLACK_SWAN_ACCOUNTING_API_URL

type Intake = {
  id: string
  source_file_name: string | null
  proposed_document_type: string | null
  proposed_document_number: string | null
  proposed_currency: string | null
  proposed_total_amount: number | null
  canonical_document_id: string | null
  status: string
}

type DocumentRow = {
  id: string
  intake_id: string | null
  document_type: string
  document_number: string | null
  currency: string
  total_amount: number
  status: string
  document_date: string
}

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

export function AccountingPostingControl() {
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    if (!apiBase) {
      setError('NEXT_PUBLIC_BLACK_SWAN_ACCOUNTING_API_URL is not configured.')
      return
    }
    try {
      const [approvedIntakes, postingDocuments] = await Promise.all([
        callApi('/v1/accounting/review?status=approved'),
        callApi('/v1/accounting/posting'),
      ])
      setIntakes((approvedIntakes || []).filter((row: Intake) => !row.canonical_document_id))
      setDocuments(postingDocuments || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load posting control')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function materialize(intakeId: string) {
    setBusy(intakeId)
    setError(null)
    setNotice(null)
    try {
      const documentId = await callApi(`/v1/accounting/intakes/${intakeId}/materialize`, { method: 'POST', body: '{}' })
      setNotice(`Canonical document created: ${String(documentId)}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Materialization failed')
    } finally {
      setBusy(null)
    }
  }

  async function createJournal(documentId: string) {
    setBusy(documentId)
    setError(null)
    setNotice(null)
    try {
      const journalId = await callApi(`/v1/accounting/documents/${documentId}/journal`, { method: 'POST', body: '{}' })
      setNotice(`Draft journal ready: ${String(journalId)}. Add reviewed allocations and balanced journal lines before approval.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft journal creation failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {notice && <div className="rounded-md border p-3 text-sm">{notice}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Approved Intake</CardTitle>
          <CardDescription>Human-approved OCR records waiting to become canonical accounting documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {intakes.length === 0 && <p className="text-sm text-muted-foreground">No approved intake awaiting materialization.</p>}
          {intakes.map((row) => (
            <div key={row.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">{row.source_file_name || row.proposed_document_number || row.id}</div>
                <div className="text-sm text-muted-foreground">
                  {row.proposed_document_type || 'Unclassified'} · {row.proposed_currency || ''} {row.proposed_total_amount ?? ''}
                </div>
              </div>
              <Button onClick={() => materialize(row.id)} disabled={busy === row.id}>Create canonical document</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Canonical Documents</CardTitle>
          <CardDescription>Approved source documents. A draft journal can only be created after explicit accounting allocations exist.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">No canonical documents awaiting posting work.</p>}
          {documents.map((row) => (
            <div key={row.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.document_number || row.document_type}</span>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{row.document_date} · {row.currency} {row.total_amount}</div>
              </div>
              <Button variant="outline" onClick={() => createJournal(row.id)} disabled={busy === row.id}>Create / open draft journal</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
