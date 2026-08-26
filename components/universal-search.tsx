"use client"

import { useCallback, useEffect, useState } from "react"
import { Search, MapPin, AlertCircle, Wrench, Users, Home, Calendar, Anchor } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"

type SearchResultType =
  | "asset"
  | "issue"
  | "maintenance"
  | "employee"
  | "room"
  | "reservation"
  | "guest"
  | "location"
  | "port"
  | "boat"
  | "page"
  | "supplier"
  | "analytics"

interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string | null
  badge?: string | null
  status?: string | null
}

type NavigationPage = SearchResult & { type: "page"; href: string }

const navigationPages: NavigationPage[] = [
  { id: "dashboard", title: "Dashboard", subtitle: "Overview of your property", href: "/", type: "page" },
  { id: "bookings", title: "Bookings", subtitle: "Manage reservations and availability", href: "/bookings", type: "page" },
  { id: "tasks", title: "Tasks", subtitle: "Daily management tasks", href: "/tasks", type: "page" },
  { id: "assets", title: "Assets", subtitle: "Inventory and equipment", href: "/inventory", type: "page" },
  { id: "maintenance", title: "Maintenance", subtitle: "Schedule and track repairs", href: "/maintenance", type: "page" },
  { id: "map", title: "GIS Map", subtitle: "Property location and layout", href: "/map", type: "page" },
  { id: "cattle", title: "Cattle", subtitle: "Livestock and pasture management", href: "/cattle", type: "page" },
  { id: "ports-boats", title: "Ports & Boats", subtitle: "Manage port facilities and boat fleet", href: "/ports-boats", type: "page" },
  { id: "energy", title: "Off Grid Energy", subtitle: "Solar panels and electricity consumption", href: "/energy", type: "page" },
  { id: "energy-dashboard", title: "Energy Dashboard", subtitle: "Real-time energy monitoring", href: "/energy-dashboard", type: "page" },
  { id: "energy-reports", title: "Energy Reports", subtitle: "Historical reports and analytics", href: "/energy-reports", type: "page" },
  { id: "victron-setup", title: "Victron Setup", subtitle: "Victron integration guide", href: "/victron-setup", type: "page" },
  { id: "integration-docs", title: "Integration Docs", subtitle: "MQTT, Node-RED, and VRM API documentation", href: "/integration-docs", type: "page" },
  { id: "procurement", title: "Compras", subtitle: "Órdenes de compra y adquisiciones", href: "/procurement", type: "page" },
  { id: "procurement-suppliers", title: "Suppliers", subtitle: "Manage supplier contacts and relationships", href: "/procurement/suppliers", type: "page" },
  { id: "procurement-analytics", title: "Analítica de Compras", subtitle: "Análisis de gasto y rendimiento de proveedores", href: "/procurement/analytics", type: "page" },
  { id: "employees", title: "Employees", subtitle: "Team management", href: "/employees", type: "page" },
  { id: "concierge", title: "Concierge", subtitle: "Guest communication", href: "/concierge", type: "page" },
  { id: "kitchen", title: "Kitchen", subtitle: "Kitchen and food preparation facilities", href: "/kitchen", type: "page" },
  { id: "checklists", title: "Checklists", subtitle: "Operational checklists", href: "/checklists", type: "page" },
  { id: "issues", title: "Issues", subtitle: "Track and resolve problems", href: "/issues", type: "page" },
  { id: "ai-ops", title: "AI Operations", subtitle: "AI-powered insights", href: "/ai-ops", type: "page" },
  { id: "admin", title: "Admin", subtitle: "System configuration", href: "/admin", type: "page" },
]

const resultRoutes: Record<Exclude<SearchResultType, "page">, string> = {
  asset: "/inventory",
  issue: "/issues",
  maintenance: "/maintenance",
  employee: "/employees",
  room: "/bookings",
  reservation: "/bookings",
  guest: "/guests",
  location: "/locations",
  port: "/ports-boats",
  boat: "/ports-boats",
  supplier: "/procurement/suppliers",
  analytics: "/procurement/analytics",
}

export function UniversalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const performSearch = useCallback(async (searchQuery: string) => {
    const cleanQuery = searchQuery.trim()
    if (!cleanQuery) {
      setResults([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      const searchPattern = `%${cleanQuery}%`
      const [assets, issues, maintenance, employees, rooms, reservations, guests, locations, portsBoats] = await Promise.all([
        supabase.from("assets").select("id,name,type,location").ilike("name", searchPattern).limit(5),
        supabase.from("issues").select("id,description,status").ilike("description", searchPattern).limit(5),
        supabase.from("maintenance_tasks").select("id,title,status").ilike("title", searchPattern).limit(5),
        supabase.from("employees").select("id,name,role,email").ilike("name", searchPattern).limit(5),
        supabase.from("rooms").select("id,room_number,room_type,status").ilike("room_number", searchPattern).limit(5),
        supabase.from("reservations").select("id,guest_name,check_in,check_out,status").ilike("guest_name", searchPattern).limit(5),
        supabase.from("guests").select("id,name,email").ilike("name", searchPattern).limit(5),
        supabase.from("locations").select("id,name,description").ilike("name", searchPattern).limit(5),
        supabase.from("ports_boats").select("id,name,type,location,status").ilike("name", searchPattern).limit(5),
      ])

      const queryErrors = [assets, issues, maintenance, employees, rooms, reservations, guests, locations, portsBoats]
        .map((result) => result.error)
        .filter(Boolean)
      if (queryErrors.length === 9) throw queryErrors[0]

      const navigationResults = navigationPages.filter((page) => `${page.title} ${page.subtitle ?? ""}`.toLowerCase().includes(cleanQuery.toLowerCase()))
      const combinedResults: SearchResult[] = [
        ...(assets.data ?? []).map((asset): SearchResult => ({ id: asset.id, type: "asset", title: asset.name, subtitle: asset.location, badge: asset.type })),
        ...(issues.data ?? []).map((issue): SearchResult => ({ id: issue.id, type: "issue", title: issue.description?.substring(0, 60) || "Issue", status: issue.status })),
        ...(maintenance.data ?? []).map((task): SearchResult => ({ id: task.id, type: "maintenance", title: task.title, status: task.status })),
        ...(employees.data ?? []).map((employee): SearchResult => ({ id: employee.id, type: "employee", title: employee.name, subtitle: employee.email, badge: employee.role })),
        ...(rooms.data ?? []).map((room): SearchResult => ({ id: room.id, type: "room", title: room.room_number, subtitle: room.room_type, status: room.status })),
        ...(reservations.data ?? []).map((reservation): SearchResult => ({ id: reservation.id, type: "reservation", title: reservation.guest_name || "Reservation", subtitle: `${reservation.check_in} to ${reservation.check_out}`, status: reservation.status })),
        ...(guests.data ?? []).map((guest): SearchResult => ({ id: guest.id, type: "guest", title: guest.name, subtitle: guest.email })),
        ...(locations.data ?? []).map((location): SearchResult => ({ id: location.id, type: "location", title: location.name, subtitle: location.description })),
        ...(portsBoats.data ?? []).map((item): SearchResult => ({ id: item.id, type: item.type === "port" ? "port" : "boat", title: item.name, subtitle: item.location, badge: item.type === "port" ? "Port" : "Vessel", status: item.status })),
        ...navigationResults,
      ]

      setResults(combinedResults)
    } catch (searchError) {
      console.error("Search error:", searchError)
      setResults([])
      setError("No fue posible completar la búsqueda.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const debounce = window.setTimeout(() => { void performSearch(query) }, 300)
    return () => window.clearTimeout(debounce)
  }, [query, performSearch])

  const getIcon = (type: SearchResultType) => {
    switch (type) {
      case "asset": return <MapPin className="h-4 w-4" />
      case "issue": return <AlertCircle className="h-4 w-4" />
      case "maintenance": return <Wrench className="h-4 w-4" />
      case "employee": case "guest": case "supplier": return <Users className="h-4 w-4" />
      case "room": case "page": return <Home className="h-4 w-4" />
      case "reservation": case "analytics": return <Calendar className="h-4 w-4" />
      case "location": return <MapPin className="h-4 w-4" />
      case "port": case "boat": return <Anchor className="h-4 w-4" />
      default: return <Search className="h-4 w-4" />
    }
  }

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery("")
    if (result.type === "page") {
      const page = navigationPages.find((candidate) => candidate.id === result.id)
      if (page) router.push(page.href)
      return
    }
    router.push(resultRoutes[result.type])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search pages, assets, issues, employees, ports, boats, suppliers, analytics..." className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {loading && <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Searching...</div>}
          {!loading && error && <div className="flex items-center justify-center py-8 text-sm text-destructive">{error}</div>}
          {!loading && !error && results.length === 0 && query && <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">No results found</div>}
          {!loading && !error && results.length === 0 && !query && <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground"><Search className="h-8 w-8 mb-2 opacity-50" /><p>Start typing to search...</p><p className="text-xs mt-2">Pages, Assets, Issues, Maintenance, Employees, Rooms, Guests, Locations, Ports, Boats, Suppliers, Analytics</p></div>}

          {!loading && !error && results.length > 0 && <div className="space-y-1">{results.map((result) => (
            <button key={`${result.type}-${result.id}`} onClick={() => handleSelect(result)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent text-left transition-colors">
              <div className="text-muted-foreground">{getIcon(result.type)}</div>
              <div className="flex-1 min-w-0"><div className="font-medium truncate">{result.title}</div>{result.subtitle && <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>}</div>
              <div className="flex items-center gap-2">{result.badge && <Badge variant="secondary" className="text-xs">{result.badge}</Badge>}{result.status && <Badge variant={result.status === "open" || result.status === "pending" ? "destructive" : "default"} className="text-xs">{result.status}</Badge>}</div>
            </button>
          ))}</div>}
        </div>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between"><span>Press ESC to close</span><span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↵</kbd> to select</span></div>
      </DialogContent>
    </Dialog>
  )
}
