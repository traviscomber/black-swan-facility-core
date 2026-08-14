'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { OsActions } from '@/components/os-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

type WorkspacePayload = Record<string, unknown>
type WorkspaceRow = Record<string, unknown>
type WorkspaceSection = { key: string; rows: WorkspaceRow[] }
type NavItem = { key: string; label: string; href: string }
type Navigation = { role?: string; is_member?: boolean; items?: NavItem[] }

async function accessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

async function call(path: string) {
  if (!operationsApi) throw new Error('NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL is not configured.')
  const token = await accessToken()
  if (!token) throw new Error('Authentication required')
  const response = await fetch(`${operationsApi}${path}`, { headers: { authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || 'Request failed')
  return body.data
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function getSections(payload: WorkspacePayload): WorkspaceSection[] {
  const preferred = ['members','events','collections','materials','costs','responsibilities','providers','engagements','publications','batches','rows','rules','checks']
  const seen = new Set<string>()
  const sections: WorkspaceSection[] = []

  for (const key of preferred) {
    const value = payload[key]
    if (Array.isArray(value)) {
      sections.push({ key, rows: value as WorkspaceRow[] })
      seen.add(key)
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'summary' || seen.has(key) || !Array.isArray(value)) continue
    sections.push({ key, rows: value as WorkspaceRow[] })
  }

  return sections.length ? sections : [{ key: 'records', rows: [] }]
}

function sectionColumns(rows: WorkspaceRow[]) {
  const first = rows[0]
  if (!first) return []
  return Object.keys(first).filter((key) => {
    const value = first[key]
    return !Array.isArray(value) && (typeof value !== 'object' || value === null)
  }).slice(0, 10)
}

export function OsWorkspace({ workspace, title, description }: { workspace: string; title: string; description: string }) {
  const [payload, setPayload] = useState<WorkspacePayload | null>(null)
  const [references, setReferences] = useState<WorkspacePayload>({})
  const [navigation, setNavigation] = useState<Navigation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)

  async function load() {
    setBusy(true)
    setError(null)
    try {
      const [workspaceData, navigationData, referenceData] = await Promise.all([
        call(`/v1/os/workspaces/${workspace}`),
        call('/v1/os/navigation'),
        call(`/v1/os/references/${workspace}`).catch(() => ({})),
      ])
      setPayload(workspaceData || {})
      setNavigation(navigationData || {})
      setReferences(referenceData || {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load workspace')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void load() }, [workspace])

  const summary = (payload?.summary && typeof payload.summary === 'object' ? payload.summary : {}) as Record<string, unknown>
  const sections = useMemo(() => getSections(payload || {}), [payload])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="mt-1 max-w-3xl">{description}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {navigation?.role && <Badge variant="outline">{navigation.role}</Badge>}
              {navigation?.is_member && <Badge variant="secondary">Member</Badge>}
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>{busy ? 'Loading…' : 'Refresh'}</Button>
            </div>
          </div>
        </CardHeader>
        {navigation?.items?.length ? (
          <CardContent className="flex flex-wrap gap-2">
            {navigation.items.map((item) => <Button key={item.key} asChild variant={item.key === workspace ? 'default' : 'outline'} size="sm"><Link href={item.href}>{item.label}</Link></Button>)}
          </CardContent>
        ) : null}
      </Card>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {!error && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(summary).map(([key, value]) => (
              <Card key={key}><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{humanize(key)}</div><div className="mt-1 text-2xl font-semibold">{displayValue(value)}</div></CardContent></Card>
            ))}
          </div>

          <OsActions workspace={workspace} payload={payload || {}} references={references} onDone={load} />

          {sections.map((section) => {
            const columns = sectionColumns(section.rows)
            return (
              <Card key={section.key}>
                <CardHeader>
                  <CardTitle>{humanize(section.key)}</CardTitle>
                  <CardDescription>Canonical records only. Empty states indicate missing source data or no records, not simulated content.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {section.rows.length === 0 ? <p className="text-sm text-muted-foreground">No canonical records are available for this section yet.</p> : (
                    <table className="w-full min-w-[720px] text-sm">
                      <thead><tr>{columns.map((column) => <th key={column} className="border-b p-2 text-left font-medium">{humanize(column)}</th>)}</tr></thead>
                      <tbody>{section.rows.map((row, index) => <tr key={String(row.id || `${section.key}-${index}`)}>{columns.map((column) => <td key={column} className="border-b p-2 align-top">{displayValue(row[column])}</td>)}</tr>)}</tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}
