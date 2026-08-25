'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { osAreas, resolveAreaForPath, type OsAreaKey } from '@/lib/os/navigation'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

type NavItem = { key: string; label: string; href: string }
type Navigation = { role?: string; is_member?: boolean; items?: NavItem[] }

async function loadNavigation() {
  if (!operationsApi) throw new Error('NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL is not configured.')
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Authentication required')
  const response = await fetch(`${operationsApi}/v1/os/navigation`, { headers: { authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || 'Unable to load navigation')
  return body.data as Navigation
}

const selectableAreas = new Set<OsAreaKey>(['operations', 'people', 'places-assets', 'finance', 'network'])

export function OsHome() {
  const searchParams = useSearchParams()
  const requestedArea = searchParams.get('area') as OsAreaKey | null
  const selectedArea = requestedArea && selectableAreas.has(requestedArea) ? requestedArea : null
  const [navigation, setNavigation] = useState<Navigation | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadNavigation().then(setNavigation).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load Black Swan OS'))
  }, [])

  const grouped = useMemo(() => {
    const groups = new Map<OsAreaKey | 'other', NavItem[]>()
    for (const item of navigation?.items || []) {
      const area = resolveAreaForPath(item.href) ?? 'other'
      groups.set(area, [...(groups.get(area) || []), item])
    }
    return groups
  }, [navigation])

  const visibleItems = selectedArea ? (grouped.get(selectedArea) || []) : (navigation?.items || [])
  const selectedDefinition = selectedArea ? osAreas.find((area) => area.key === selectedArea) : null

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{selectedDefinition ? selectedDefinition.key.replace('-', ' & ') : 'Today'}</CardTitle>
            {navigation?.role && <Badge variant="outline">{navigation.role}</Badge>}
            {navigation?.is_member && <Badge variant="secondary">Member</Badge>}
          </div>
          <CardDescription>
            {selectedArea ? 'Authorized workspaces in this Black Swan OS area.' : 'What needs attention now, with every server-authorized workspace still directly reachable.'}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/os" className={`rounded border px-3 py-1.5 text-sm ${!selectedArea ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Today</Link>
        {osAreas.filter((area) => area.key !== 'today').map((area) => (
          <Link key={area.key} href={`/os?area=${area.key}`} className={`rounded border px-3 py-1.5 text-sm ${selectedArea === area.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{area.key.replace('-', ' & ')}</Link>
        ))}
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {!error && navigation && visibleItems.length === 0 && <div className="rounded border border-dashed p-6 text-sm text-muted-foreground">No authorized workspaces are available in this area.</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => (
          <Link href={item.href} key={item.key}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader><CardTitle className="text-base">{item.label}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Open canonical {item.label.toLowerCase()} workspace.</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!selectedArea && navigation && <div className="space-y-3">
        {osAreas.filter((area) => area.key !== 'today').map((area) => {
          const count = grouped.get(area.key)?.length ?? 0
          if (!count) return null
          return <Link key={area.key} href={`/os?area=${area.key}`} className="flex items-center justify-between rounded border px-4 py-3 text-sm hover:bg-muted/40"><span className="font-medium">{area.key.replace('-', ' & ')}</span><Badge variant="secondary">{count}</Badge></Link>
        })}
      </div>}
    </div>
  )
}
