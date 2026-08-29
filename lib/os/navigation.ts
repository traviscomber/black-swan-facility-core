import { hasCapability, type CanonicalCapabilitySnapshot } from "../access/capabilities.ts"

export type OsAreaKey = "today" | "operations" | "people" | "places-assets" | "finance" | "network"

export type OsNavItem = {
  key: string
  nameKey: string
  href: string
  area: OsAreaKey
  tipKey: string
  viewDomain?: string
  adminOnly?: boolean
  action?: string
  department?: string
  badge?: "finance_pending"
  serverAuthorized?: boolean
  subItems?: Array<{ nameKey: string; href: string; icon: string }>
}

export type OsArea = {
  key: OsAreaKey
  labelKey: string
  descKey: string
  href: string
  items: OsNavItem[]
}

const orchardSubItems = [
  { nameKey: "nav.orchard_overview", href: "/orchard", icon: "🌳" },
  { nameKey: "nav.orchard_crops", href: "/orchard/crops", icon: "🌱" },
  { nameKey: "nav.orchard_care", href: "/orchard/care", icon: "❤️" },
  { nameKey: "nav.orchard_harvest", href: "/orchard/harvest", icon: "✂️" },
  { nameKey: "nav.orchard_health", href: "/orchard/pests", icon: "🐛" },
  { nameKey: "nav.orchard_soil", href: "/orchard/soil", icon: "🌍" },
  { nameKey: "nav.orchard_equipment", href: "/orchard/equipment", icon: "🔧" },
  { nameKey: "nav.orchard_analytics", href: "/orchard/analytics", icon: "▥" },
]

const vineyardSubItems = [
  { nameKey: "nav.vineyard_overview", href: "/vineyard", icon: "🍇" },
  { nameKey: "nav.vineyard_photos", href: "/vineyard/photos", icon: "📸" },
  { nameKey: "nav.vineyard_crops", href: "/vineyard/crops", icon: "🌱" },
  { nameKey: "nav.vineyard_harvest", href: "/vineyard/harvest", icon: "✂️" },
  { nameKey: "nav.vineyard_health", href: "/vineyard/pests", icon: "🐛" },
]

const cattleSubItems = [
  { nameKey: "nav.cattle_overview", href: "/cattle", icon: "🐄" },
  { nameKey: "nav.cattle_health", href: "/cattle-health", icon: "❤️" },
]

export const osAreas: OsArea[] = [
  { key: "today", labelKey: "os.today", descKey: "os.today_desc", href: "/os", items: [] },
  {
    key: "operations", labelKey: "os.operations", descKey: "os.operations_desc", href: "/os?area=operations", items: [
      { key: "bookings", nameKey: "nav.bookings", href: "/bookings", area: "operations", tipKey: "nav.bookings_tip", viewDomain: "booking", action: "booking.modify", department: "booking" },
      { key: "activities", nameKey: "nav.activities", href: "/activities-calendar", area: "operations", tipKey: "nav.activities_tip", viewDomain: "operations", department: "operations" },
      { key: "tasks", nameKey: "nav.tasks", href: "/tasks", area: "operations", tipKey: "nav.tasks_tip", viewDomain: "operations", department: "operations" },
      { key: "checklists", nameKey: "nav.checklists", href: "/checklists", area: "operations", tipKey: "nav.checklists_tip", viewDomain: "operations", department: "operations" },
      { key: "procurement", nameKey: "nav.procurement", href: "/procurement", area: "operations", tipKey: "nav.procurement_tip", viewDomain: "procurement", action: "procurement.operate", department: "procurement" },
      { key: "maintenance", nameKey: "nav.maintenance", href: "/maintenance", area: "operations", tipKey: "nav.maintenance_tip", viewDomain: "maintenance", action: "maintenance.operate", department: "maintenance" },
      { key: "issues", nameKey: "nav.issues", href: "/issues", area: "operations", tipKey: "nav.facility_requests_tip", viewDomain: "maintenance", action: "maintenance.operate", department: "maintenance" },
      { key: "guest-requests", nameKey: "nav.guest_requests", href: "/bookings/requests", area: "operations", tipKey: "nav.guest_requests_tip", viewDomain: "operations", action: "hospitality.operate", department: "hospitality" },
    ],
  },
  {
    key: "people", labelKey: "os.people", descKey: "os.people_desc", href: "/os?area=people", items: [
      { key: "employees", nameKey: "nav.people_operations", href: "/employees", area: "people", tipKey: "nav.employees_tip", viewDomain: "people", department: "administration" },
      { key: "os-people", nameKey: "os.people", href: "/os/people", area: "people", tipKey: "os.people_desc", serverAuthorized: true },
    ],
  },
  {
    key: "places-assets", labelKey: "os.places_assets", descKey: "os.places_assets_desc", href: "/os?area=places-assets", items: [
      { key: "property-management", nameKey: "nav.property_management", href: "/property-management", area: "places-assets", tipKey: "nav.property_management_desc", viewDomain: "maintenance", department: "maintenance" },
      { key: "inventory", nameKey: "nav.inventory", href: "/inventory", area: "places-assets", tipKey: "nav.inventory_tip", viewDomain: "inventory", action: "inventory.process", department: "inventory" },
      { key: "energy", nameKey: "nav.energy_management", href: "/energy", area: "places-assets", tipKey: "nav.management_tip", viewDomain: "maintenance", department: "maintenance" },
      { key: "map", nameKey: "nav.map", href: "/map", area: "places-assets", tipKey: "nav.gis_map_tip", viewDomain: "map" },
      { key: "orchard", nameKey: "nav.orchard_dashboard", href: "/orchard", area: "places-assets", tipKey: "nav.dashboard_tip", viewDomain: "orchard", department: "orchard", subItems: orchardSubItems },
      { key: "vineyard", nameKey: "nav.vineyard_dashboard", href: "/vineyard", area: "places-assets", tipKey: "nav.dashboard_tip", viewDomain: "vineyard", department: "vineyard", subItems: vineyardSubItems },
      { key: "cattle", nameKey: "nav.cattle_dashboard", href: "/cattle", area: "places-assets", tipKey: "nav.dashboard_tip", viewDomain: "cattle", department: "cattle", subItems: cattleSubItems },
      { key: "cattle-health", nameKey: "nav.cattle_health", href: "/cattle-health", area: "places-assets", tipKey: "nav.dashboard_tip", viewDomain: "cattle", department: "cattle" },
      { key: "fuel", nameKey: "nav.combustibles", href: "/combustibles", area: "places-assets", tipKey: "nav.combustibles_tip", viewDomain: "fuel", action: "fuel.review", department: "fuel" },
    ],
  },
  {
    key: "finance", labelKey: "os.finance", descKey: "os.finance_desc", href: "/os?area=finance", items: [
      { key: "budget", nameKey: "finance_budget", href: "/budgets", area: "finance", tipKey: "finance_budget_tip", viewDomain: "finance", action: "payments.record", department: "finance" },
      { key: "approvals", nameKey: "finance_approvals", href: "/budgets/approvals", area: "finance", tipKey: "finance_approvals_tip", viewDomain: "finance", badge: "finance_pending", action: "payments.record", department: "finance" },
      { key: "documents", nameKey: "finance_documents", href: "/budgets/documents", area: "finance", tipKey: "finance_documents_tip", viewDomain: "finance", action: "payments.record", department: "finance" },
      { key: "reconciliation", nameKey: "finance_reconciliation", href: "/budgets/reconciliation", area: "finance", tipKey: "finance_reconciliation_tip", viewDomain: "finance", action: "payments.record", department: "finance" },
      { key: "accounting", nameKey: "nav.accounting", href: "/accounting", area: "finance", tipKey: "nav.accounting_tip", viewDomain: "finance", department: "finance" },
      { key: "invoices", nameKey: "nav.invoices", href: "/bookings/invoices", area: "finance", tipKey: "nav.invoices_tip", viewDomain: "finance", action: "payments.record", department: "finance" },
    ],
  },
  {
    key: "network", labelKey: "os.network", descKey: "os.network_desc", href: "/os?area=network", items: [
      { key: "discovery", nameKey: "os.discovery", href: "/os/discovery", area: "network", tipKey: "os.network_desc", serverAuthorized: true },
      { key: "events", nameKey: "os.events", href: "/os/events", area: "network", tipKey: "os.network_desc", serverAuthorized: true },
      { key: "event-providers", nameKey: "os.event_providers", href: "/os/event-providers", area: "network", tipKey: "os.network_desc", serverAuthorized: true },
      { key: "front-door", nameKey: "os.front_door", href: "/os/front-door", area: "network", tipKey: "os.network_desc", serverAuthorized: true },
      { key: "education", nameKey: "os.education", href: "/os/education", area: "network", tipKey: "os.network_desc", serverAuthorized: true },
    ],
  },
]

const LOCALES = new Set(["en", "es", "de"])

export function normalizeOsPath(pathname: string) {
  const path = pathname.split("?")[0] || "/"
  const parts = path.split("/").filter(Boolean)
  if (parts[0] && LOCALES.has(parts[0])) parts.shift()
  return parts.length ? `/${parts.join("/")}` : "/"
}

export function resolveAreaForPath(pathname: string): OsAreaKey | null {
  const path = normalizeOsPath(pathname)
  if (path === "/os") return "today"
  const matches = osAreas.flatMap((area) => area.items.map((item) => ({ area: area.key, href: item.href })))
    .filter(({ href }) => path === href || path.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)
  return matches[0]?.area ?? null
}

export function filterOsAreas(areas: OsArea[], snapshot: CanonicalCapabilitySnapshot, access: { is_admin: boolean }): OsArea[] {
  return areas.map((area) => ({
    ...area,
    items: area.items.filter((item) => {
      if (item.serverAuthorized) return false
      if (item.adminOnly && !access.is_admin) return false
      if (item.viewDomain && !hasCapability(snapshot, item.viewDomain, "view")) return false
      return true
    }),
  }))
}

export function rankAreasForAccess(areas: OsArea[], access: { is_admin: boolean; role: string; departments: string[]; allowed_actions: string[] }): OsArea[] {
  const priority = new Map<OsAreaKey, number>([["today", -100]])
  const departments = new Set(access.departments.map((value) => value.toLowerCase()))
  if (departments.has("booking") || departments.has("operations") || departments.has("hospitality") || departments.has("maintenance")) priority.set("operations", -50)
  if (departments.has("administration") || departments.has("hr") || departments.has("people")) priority.set("people", -45)
  if (["maintenance", "inventory", "orchard", "vineyard", "cattle", "fuel"].some((value) => departments.has(value))) priority.set("places-assets", -40)
  if (departments.has("finance") || access.allowed_actions.includes("payments.record")) priority.set("finance", -35)
  return [...areas].sort((a, b) => (priority.get(a.key) ?? 0) - (priority.get(b.key) ?? 0))
}
