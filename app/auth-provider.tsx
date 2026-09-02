'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { normalizeCapabilitySnapshot, hasCapability, type CanonicalCapabilitySnapshot } from '@/lib/access/capabilities'
import { createClient } from '@/lib/supabase/client'

const ROUTE_LOCALES = new Set(['en', 'es', 'de'])

function stripLocale(pathname: string | null) {
  const segments = (pathname ?? '/').split('/').filter(Boolean)
  if (segments[0] && ROUTE_LOCALES.has(segments[0])) segments.shift()
  return segments.length ? `/${segments.join('/')}` : '/'
}

function localizedHref(pathname: string | null, href: string) {
  const first = (pathname ?? '/').split('/').filter(Boolean)[0]
  return first && ROUTE_LOCALES.has(first) ? `/${first}${href}` : href
}

function requiredDomain(pathname: string | null): string | null {
  const path = stripLocale(pathname)
  if (path.startsWith('/admin') || path.startsWith('/ai-ops') || path.startsWith('/sovereignty')) return 'admin'
  if (path === '/bookings/invoices' || path.startsWith('/budgets') || path.startsWith('/accounting')) return 'finance'
  if (path.startsWith('/bookings')) return 'booking'
  if (path.startsWith('/activities-calendar') || path.startsWith('/tasks') || path.startsWith('/checklists')) return 'operations'
  if (path.startsWith('/employees') || path.startsWith('/os/people')) return 'people'
  if (path.startsWith('/procurement')) return 'procurement'
  if (path.startsWith('/maintenance') || path.startsWith('/issues') || path.startsWith('/property-management') || path.startsWith('/energy')) return 'maintenance'
  if (path.startsWith('/inventory')) return 'inventory'
  if (path.startsWith('/orchard')) return 'orchard'
  if (path.startsWith('/vineyard')) return 'vineyard'
  if (path.startsWith('/cattle')) return 'cattle'
  if (path.startsWith('/combustibles')) return 'fuel'
  if (path.startsWith('/map')) return 'map'
  if (path.startsWith('/os/discovery') || path.startsWith('/os/events') || path.startsWith('/os/event-providers') || path.startsWith('/os/front-door') || path.startsWith('/os/education')) return 'network'
  return null
}

function firstAllowedPath(snapshot: CanonicalCapabilitySnapshot) {
  const order: Array<[string, string]> = [
    ['orchard', '/orchard'],
    ['booking', '/bookings'],
    ['operations', '/tasks'],
    ['people', '/employees'],
    ['procurement', '/procurement'],
    ['maintenance', '/maintenance'],
    ['inventory', '/inventory'],
    ['vineyard', '/vineyard'],
    ['cattle', '/cattle'],
    ['fuel', '/combustibles'],
    ['map', '/map'],
    ['finance', '/budgets'],
    ['network', '/os/discovery'],
    ['admin', '/admin'],
  ]
  return order.find(([domain]) => hasCapability(snapshot, domain, 'view'))?.[1] ?? '/auth/login?reason=access'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false

    async function enforceAccess() {
      setIsReady(false)
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return

      const domain = requiredDomain(pathname)
      const internalPath = stripLocale(pathname)
      const requiresAuth = domain !== null || internalPath === '/os'

      if (!session) {
        setIsReady(true)
        if (requiresAuth) router.replace(localizedHref(pathname, '/auth/login'))
        return
      }

      if (!requiresAuth) {
        setIsReady(true)
        return
      }

      const [{ data: routeData, error: routeError }, { data: accessData, error: accessError }] = await Promise.all([
        supabase.rpc('get_current_route_access'),
        supabase.rpc('get_current_user_effective_access'),
      ])
      if (cancelled) return
      if (routeError || accessError) {
        setIsReady(true)
        router.replace(localizedHref(pathname, '/auth/login?reason=access'))
        return
      }

      const snapshot = normalizeCapabilitySnapshot(routeData)
      const access = (accessData ?? {}) as Record<string, unknown>
      const hasExplicitScopes = access.has_explicit_scopes === true || access.hasExplicitScopes === true
      const isAdmin = access.is_admin === true || access.isAdmin === true

      if (internalPath === '/os' && hasExplicitScopes && !isAdmin) {
        setIsReady(true)
        router.replace(localizedHref(pathname, firstAllowedPath(snapshot)))
        return
      }

      if (domain && !hasCapability(snapshot, domain, 'view')) {
        setIsReady(true)
        router.replace(localizedHref(pathname, firstAllowedPath(snapshot)))
        return
      }

      setIsReady(true)
    }

    void enforceAccess()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => void enforceAccess())
    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [pathname, router, supabase])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
