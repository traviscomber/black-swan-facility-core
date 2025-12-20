"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, MapPin, AlertCircle, Wrench, Users, Home, Calendar } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"

interface SearchResult {
  id: string
  type: "asset" | "issue" | "maintenance" | "employee" | "room" | "reservation" | "guest" | "location" | "port" | "boat"
  title: string
  subtitle?: string
  status?: string
  badge?: string
}

export function UniversalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Handle Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const searchPattern = `%${searchQuery}%`

      const [assets, issues, maintenance, employees, rooms, reservations, guests, locations, portsBoats] =
        await Promise.all([
          supabase.from("assets").select("id, name, type, location").ilike("name", searchPattern).limit(5),
          supabase.from("issues").select("id, description, status").ilike("description", searchPattern).limit(5),
          supabase.from("maintenance_tasks").select("id, title, status").ilike("title", searchPattern).limit(5),
          supabase.from("employees").select("id, name, role, email").ilike("name", searchPattern).limit(5),
          supabase
            .from("rooms")
            .select("id, room_number, room_type, status")
            .ilike("room_number", searchPattern)
            .limit(5),
          supabase
            .from("reservations")
            .select("id, guest_name, check_in, check_out, status")
            .ilike("guest_name", searchPattern)
            .limit(5),
          supabase.from("guests").select("id, name, email").ilike("name", searchPattern).limit(5),
          supabase.from("locations").select("id, name, description").ilike("name", searchPattern).limit(5),
          supabase.from("ports_boats").select("id, name, type, location, status").ilike("name", searchPattern).limit(5),
        ])

      const combinedResults: SearchResult[] = [
        ...(assets.data || []).map((a) => ({
          id: a.id,
          type: "asset" as const,
          title: a.name,
          subtitle: a.location,
          badge: a.type,
        })),
        ...(issues.data || []).map((i) => ({
          id: i.id,
          type: "issue" as const,
          title: i.description?.substring(0, 60) || "Issue",
          status: i.status,
        })),
        ...(maintenance.data || []).map((m) => ({
          id: m.id,
          type: "maintenance" as const,
          title: m.title,
          status: m.status,
        })),
        ...(employees.data || []).map((e) => ({
          id: e.id,
          type: "employee" as const,
          title: e.name,
          subtitle: e.email,
          badge: e.role,
        })),
        ...(rooms.data || []).map((r) => ({
          id: r.id,
          type: "room" as const,
          title: r.room_number,
          subtitle: r.room_type,
          status: r.status,
        })),
        ...(reservations.data || []).map((r) => ({
          id: r.id,
          type: "reservation" as const,
          title: r.guest_name,
          subtitle: `${r.check_in} to ${r.check_out}`,
          status: r.status,
        })),
        ...(guests.data || []).map((g) => ({
          id: g.id,
          type: "guest" as const,
          title: g.name,
          subtitle: g.email,
        })),
        ...(locations.data || []).map((l) => ({
          id: l.id,
          type: "location" as const,
          title: l.name,
          subtitle: l.description,
        })),
        ...(portsBoats.data || []).map((pb) => ({
          id: pb.id,
          type: pb.type === "port" ? "port" : "boat",
          title: pb.name,
          subtitle: pb.location,
          badge: pb.type === "port" ? "Port" : "Vessel",
          status: pb.status,
        })),
      ]

      setResults(combinedResults)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(debounce)
  }, [query, performSearch])

  const getIcon = (type: string) => {
    switch (type) {
      case "asset":
        return <MapPin className="h-4 w-4" />
      case "issue":
        return <AlertCircle className="h-4 w-4" />
      case "maintenance":
        return <Wrench className="h-4 w-4" />
      case "employee":
        return <Users className="h-4 w-4" />
      case "room":
        return <Home className="h-4 w-4" />
      case "reservation":
        return <Calendar className="h-4 w-4" />
      case "guest":
        return <Users className="h-4 w-4" />
      case "location":
        return <MapPin className="h-4 w-4" />
      case "port":
        return <MapPin className="h-4 w-4" />
      case "boat":
        return <Users className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery("")

    const routes: Record<string, string> = {
      asset: "/assets",
      issue: "/issues",
      maintenance: "/maintenance",
      employee: "/employees",
      room: "/hospitality",
      reservation: "/hospitality",
      guest: "/guests",
      location: "/locations",
      port: "/ports-boats",
      boat: "/ports-boats",
    }

    const route = routes[result.type]
    if (route) {
      router.push(route)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets, issues, maintenance, employees, rooms..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ESC
          </kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Searching...</div>
          )}

          {!loading && results.length === 0 && query && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">No results found</div>
          )}

          {!loading && results.length === 0 && !query && (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-50" />
              <p>Start typing to search...</p>
              <p className="text-xs mt-2">
                Assets, Issues, Maintenance, Employees, Rooms, Guests, Locations, Ports, Boats
              </p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-1">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent text-left transition-colors"
                >
                  <div className="text-muted-foreground">{getIcon(result.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    {result.subtitle && <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {result.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {result.badge}
                      </Badge>
                    )}
                    {result.status && (
                      <Badge
                        variant={result.status === "open" || result.status === "pending" ? "destructive" : "default"}
                        className="text-xs"
                      >
                        {result.status}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>Press ESC to close</span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↵</kbd> to select
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
