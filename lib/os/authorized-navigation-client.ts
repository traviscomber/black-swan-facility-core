'use client'

import { normalizeCapabilitySnapshot } from '../access/capabilities.ts'
import { filterOsAreas, osAreas } from './navigation.ts'
import { createClient } from '../supabase/client.ts'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

export type AuthorizedNavItem = { key: string; label: string; href: string }
export type AuthorizedNavigation = { role?: string; is_member?: boolean; items?: AuthorizedNavItem[] }

const labels: Record<string, string> = {
  bookings: 'Reservas', activities: 'Actividades', tasks: 'Tareas', checklists: 'Checklists', procurement: 'Compras', maintenance: 'Mantenimiento', issues: 'Incidencias',
  'guest-requests': 'Solicitudes de huéspedes', employees: 'Personas', 'property-management': 'Propiedades', inventory: 'Inventario', energy: 'Energía', map: 'Mapa', orchard: 'Huerto', vineyard: 'Viñedo', cattle: 'Ganadería',
  'cattle-health': 'Salud animal', fuel: 'Combustibles', budget: 'Presupuesto', approvals: 'Aprobaciones', documents: 'Documentos', reconciliation: 'Conciliación', accounting: 'Contabilidad', invoices: 'Facturas',
}

const presentationLabelsByHref: Record<string, string> = {
  '/accounting/reports': 'Reportes financieros',
}

function readableLabel(key: string) {
  return labels[key] ?? key.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function normalizePresentationLabel(item: AuthorizedNavItem): AuthorizedNavItem {
  return { ...item, label: presentationLabelsByHref[item.href] ?? item.label }
}

function normalizeNavigation(value: unknown): AuthorizedNavigation {
  if (!value || typeof value !== 'object') return { items: [] }
  const navigation = value as AuthorizedNavigation
  return { ...navigation, items: Array.isArray(navigation.items) ? navigation.items.map(normalizePresentationLabel) : [] }
}

function parseApiNavigation(value: unknown): AuthorizedNavigation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const navigation = value as Record<string, unknown>
  if (!Array.isArray(navigation.items)) return null
  if (navigation.role !== undefined && typeof navigation.role !== 'string') return null
  if (navigation.is_member !== undefined && typeof navigation.is_member !== 'boolean') return null
  if (!navigation.items.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const candidate = item as Record<string, unknown>
    return typeof candidate.key === 'string' && candidate.key.length > 0
      && typeof candidate.label === 'string' && candidate.label.length > 0
      && typeof candidate.href === 'string' && candidate.href.startsWith('/')
  })) return null
  const parsed = navigation as AuthorizedNavigation
  return { ...parsed, items: parsed.items?.map(normalizePresentationLabel) }
}

async function loadServerNavigation(
  supabase: ReturnType<typeof createClient>,
  token: string,
  apiUrl: string | undefined,
  fetchImpl: typeof fetch,
): Promise<AuthorizedNavigation> {
  if (apiUrl) {
    try {
      const response = await fetchImpl(`${apiUrl}/v1/os/navigation`, { headers: { authorization: `Bearer ${token}` } })
      const body = await response.json().catch(() => ({}))
      const navigation = response.ok ? parseApiNavigation(body?.data) : null
      if (navigation) return navigation
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

export async function loadAuthorizedNavigationWith({
  supabase = createClient(),
  apiUrl = operationsApi,
  fetchImpl = fetch,
}: {
  supabase?: ReturnType<typeof createClient>
  apiUrl?: string
  fetchImpl?: typeof fetch
} = {}): Promise<AuthorizedNavigation> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Authentication required')

  const { data: routeAccess, error: routeError } = await supabase.rpc('get_current_route_access')
  if (routeError || !routeAccess || typeof routeAccess !== 'object') throw new Error(routeError?.message || 'Unable to load route access')

  const access = routeAccess as { role_key?: string; is_admin?: boolean }
  const capabilityItems = filterOsAreas(osAreas, normalizeCapabilitySnapshot(routeAccess), { is_admin: Boolean(access.is_admin) })
    .flatMap((area) => area.items)
    .map((item) => ({ key: item.key, label: readableLabel(item.key), href: item.href }))
  const serverNavigation = await loadServerNavigation(supabase, token, apiUrl, fetchImpl)
  const merged = new Map(capabilityItems.map((item) => [item.key, item]))
  for (const item of serverNavigation.items ?? []) merged.set(item.key, normalizePresentationLabel(item))

  return {
    ...serverNavigation,
    role: serverNavigation.role ?? access.role_key,
    items: [...merged.values()],
  }
}

export async function loadAuthorizedNavigation(): Promise<AuthorizedNavigation> {
  return loadAuthorizedNavigationWith()
}
