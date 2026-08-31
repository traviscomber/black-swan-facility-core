'use client'

import { normalizeCapabilitySnapshot } from '@/lib/access/capabilities'
import { filterOsAreas, osAreas } from '@/lib/os/navigation'
import { createClient } from '@/lib/supabase/client'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

export type AuthorizedNavItem = { key: string; label: string; href: string }
export type AuthorizedNavigation = { role?: string; is_member?: boolean; items?: AuthorizedNavItem[] }

const labels: Record<string, string> = {
  bookings: 'Reservas', activities: 'Actividades', tasks: 'Tareas', checklists: 'Checklists', procurement: 'Compras', maintenance: 'Mantenimiento', issues: 'Incidencias',
  'guest-requests': 'Solicitudes de huéspedes', employees: 'Personas', 'property-management': 'Propiedades', inventory: 'Inventario', energy: 'Energía', map: 'Mapa', orchard: 'Huerto', vineyard: 'Viñedo', cattle: 'Ganadería',
  'cattle-health': 'Salud animal', fuel: 'Combustibles', budget: 'Presupuesto', approvals: 'Aprobaciones', documents: 'Documentos', reconciliation: 'Conciliación', accounting: 'Contabilidad', invoices: 'Facturas',
}

function readableLabel(key: string) {
  return labels[key] ?? key.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function normalizeNavigation(value: unknown): AuthorizedNavigation {
  if (!value || typeof value !== 'object') return { items: [] }
  const navigation = value as AuthorizedNavigation
  return { ...navigation, items: Array.isArray(navigation.items) ? navigation.items : [] }
}

async function loadServerNavigation(supabase: ReturnType<typeof createClient>, token: string): Promise<AuthorizedNavigation> {
  if (operationsApi) {
    try {
      const response = await fetch(`${operationsApi}/v1/os/navigation`, { headers: { authorization: `Bearer ${token}` } })
      const body = await response.json().catch(() => ({}))
      if (response.ok && body?.data) return normalizeNavigation(body.data)
    } catch {
      // The canonical authenticated RPC below is the bounded availability fallback.
    }
  }

  const { data, error } = await supabase.rpc('get_black_swan_os_navigation')
  if (error) return { items: [] }
  const navigation = normalizeNavigation(data)
  const { data: discoveryEnabled, error: discoveryError } = await supabase.rpc('get_discovery_navigation_entitlement')
  if (!discoveryError && Boolean(discoveryEnabled) && !navigation.items?.some((item) => item.key === 'discovery')) {
    navigation.items = [...(navigation.items ?? []), { key: 'discovery', label: 'Discovery', href: '/os/discovery' }]
  }
  return navigation
}

export async function loadAuthorizedNavigation(): Promise<AuthorizedNavigation> {
  const supabase = createClient()
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Authentication required')

  const { data: routeAccess, error: routeError } = await supabase.rpc('get_current_route_access')
  if (routeError || !routeAccess || typeof routeAccess !== 'object') throw new Error(routeError?.message || 'Unable to load route access')

  const access = routeAccess as { role_key?: string; is_admin?: boolean }
  const capabilityItems = filterOsAreas(osAreas, normalizeCapabilitySnapshot(routeAccess), { is_admin: Boolean(access.is_admin) })
    .flatMap((area) => area.items)
    .map((item) => ({ key: item.key, label: readableLabel(item.key), href: item.href }))
  const serverNavigation = await loadServerNavigation(supabase, token)
  const merged = new Map(capabilityItems.map((item) => [item.key, item]))
  for (const item of serverNavigation.items ?? []) merged.set(item.key, item)

  return {
    ...serverNavigation,
    role: serverNavigation.role ?? access.role_key,
    items: [...merged.values()],
  }
}
