'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

const financeApi = process.env.NEXT_PUBLIC_BLACK_SWAN_FINANCE_API_URL

type Entity = { id: string; code: string; display_name: string }
type ReportType = 'pl' | 'balance-sheet' | 'cash-flow' | 'cash-status' | 'revenue-donations'
type Report = {
  legal_entity_id: string
  legal_entity_code: string
  legal_entity_name: string
  report_type: string
  from: string
  to: string
  generated_at: string
  summary: Record<string, number | string>
  rows: Array<Record<string, unknown>>
}

async function token() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

async function call(url: string) {
  const accessToken = await token()
  if (!accessToken) throw new Error('Authentication required')
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || 'Request failed')
  return body.data
}

const reportLabels: Record<ReportType, string> = {
  pl: 'P&L',
  'balance-sheet': 'Balance Sheet',
  'cash-flow': 'Cash Flow',
  'cash-status': 'Cash Status',
  'revenue-donations': 'Revenue / Donations',
}

export function FinancialTransparencyDashboard() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [entityId, setEntityId] = useState('')
  const [reportType, setReportType] = useState<ReportType>('pl')
  const [from, setFrom] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!financeApi) {
      setError('NEXT_PUBLIC_BLACK_SWAN_FINANCE_API_URL is not configured.')
      return
    }
    void call(`${financeApi}/v1/finance/entities`).then((rows: Entity[]) => {
      setEntities(rows || [])
      const preferred = (rows || []).find((row) => row.code === 'BS_CORPORACION') || rows?.[0]
      if (preferred) setEntityId(preferred.id)
    }).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load authorized report entities'))
  }, [])

  async function loadReport() {
    if (!financeApi) return setError('NEXT_PUBLIC_BLACK_SWAN_FINANCE_API_URL is not configured.')
    if (!entityId) return
    setBusy(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      const data = await call(`${financeApi}/v1/finance/entities/${entityId}/${reportType}?${params}`)
      setReport(data)
    } catch (e) {
      setReport(null)
      setError(e instanceof Error ? e.message : 'Unable to load report')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { if (entityId) void loadReport() }, [entityId, reportType])

  const summaryEntries = useMemo(() => Object.entries(report?.summary || {}), [report])

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Financial Transparency</CardTitle>
          <CardDescription>Read-only approved reporting. The entity selector itself comes from the canonical server-side finance policy.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            <option value="">Select legal entity</option>
            {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.display_name}</option>)}
          </select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={() => void loadReport()} disabled={busy || !entityId}>{busy ? 'Loading…' : 'Refresh'}</Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(reportLabels) as ReportType[]).map((key) => (
          <Button key={key} variant={reportType === key ? 'default' : 'outline'} size="sm" onClick={() => setReportType(key)}>{reportLabels[key]}</Button>
        ))}
      </div>

      {report && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{reportLabels[reportType]}</CardTitle>
                <Badge variant="outline">{report.legal_entity_name}</Badge>
              </div>
              <CardDescription>{report.from} → {report.to}. Posted canonical accounting only; cash status uses verified bank snapshots.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                {summaryEntries.map(([key, value]) => (
                  <div key={key} className="rounded-lg border p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{key.replaceAll('_', ' ')}</div>
                    <div className="mt-1 text-xl font-semibold">{typeof value === 'number' ? value.toLocaleString() : String(value)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Report Lines</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {report.rows.length === 0 ? <p className="text-sm text-muted-foreground">No posted canonical data for this report period.</p> : (
                <table className="w-full text-sm">
                  <thead><tr>{Object.keys(report.rows[0]).map((key) => <th key={key} className="border-b p-2 text-left font-medium">{key.replaceAll('_', ' ')}</th>)}</tr></thead>
                  <tbody>{report.rows.map((row, i) => <tr key={i}>{Object.entries(row).map(([key, value]) => <td key={key} className="border-b p-2">{typeof value === 'number' ? value.toLocaleString() : String(value ?? '')}</td>)}</tr>)}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
