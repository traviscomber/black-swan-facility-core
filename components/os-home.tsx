'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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

export function OsHome() {
  const [navigation, setNavigation] = useState<Navigation | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadNavigation().then(setNavigation).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load Black Swan OS'))
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Black Swan OS</CardTitle>
            {navigation?.role && <Badge variant="outline">{navigation.role}</Badge>}
            {navigation?.is_member && <Badge variant="secondary">Member</Badge>}
          </div>
          <CardDescription>Canonical legal-entity operating system. Modules are returned by server-side authorization and are not inferred from browser role metadata.</CardDescription>
        </CardHeader>
      </Card>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(navigation?.items || []).map((item) => (
          <Link href={item.href} key={item.key}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader><CardTitle className="text-base">{item.label}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Open canonical {item.label.toLowerCase()} workspace.</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
