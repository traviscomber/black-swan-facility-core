"use client"

import { useEffect, useMemo, useState } from "react"
import { Command } from "cmdk"
import { BedDouble, CalendarDays, Loader2, Package, Search, ShoppingCart } from "lucide-react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { hasCapability, normalizeCapabilitySnapshot, type CanonicalCapabilitySnapshot } from "@/lib/access/capabilities"
import type { EffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"
import { createClient } from "@/lib/supabase/client"

interface ObjectCommandPaletteProps {
  access: EffectiveAccess
  canAccessDepartment: (department: string) => boolean
}

type SearchKind = "reservation" | "room" | "asset" | "purchase"

type SearchResult = {
  id: string
  kind: SearchKind
  title: string
  subtitle: string
  href: string
}

type ReservationRow = {
  id: string
  guest_name: string | null
  guest_email: string | null
  bedbooking_ref: string | null
  status: string | null
  check_in: string | null
  check_out: string | null
}

type RoomRow = {
  id: string
  room_number: string | null
  room_type: string | null
  location: string | null
  status: string | null
}

type AssetRow = {
  id: string
  name: string | null
  asset_code: string | null
  serial_number: string | null
  status: string | null
  location: string | null
}

type PurchaseRow = {
  id: string
  request_number: string | null
  title: string | null
  status: string | null
  priority: string | null
}

const copy = {
  es: {
    title: "Buscar objetos",
    description: "Abre reservas, habitaciones, activos y compras autorizadas.",
    placeholder: "Buscar por nombre, código o referencia…",
    start: "Escribe al menos 2 caracteres.",
    empty: "No hay objetos autorizados que coincidan.",
    loading: "Buscando…",
    reservation: "Reserva",
    room: "Habitación",
    asset: "Activo",
    purchase: "Compra",
  },
  en: {
    title: "Search objects",
    description: "Open authorized reservations, rooms, assets and purchases.",
    placeholder: "Search by name, code or reference…",
    start: "Type at least 2 characters.",
    empty: "No authorized objects match your search.",
    loading: "Searching…",
    reservation: "Reservation",
    room: "Room",
    asset: "Asset",
    purchase: "Purchase",
  },
  de: {
    title: "Objekte suchen",
    description: "Autorisierte Reservierungen, Zimmer, Anlagen und Einkäufe öffnen.",
    placeholder: "Nach Name, Code oder Referenz suchen…",
    start: "Mindestens 2 Zeichen eingeben.",
    empty: "Keine autorisierten Objekte gefunden.",
    loading: "Suche…",
    reservation: "Reservierung",
    room: "Zimmer",
    asset: "Anlage",
    purchase: "Einkauf",
  },
} as const

function safeSearchTerm(input: string) {
  return input.replace(/[,%()*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
}

function resultIcon(kind: SearchKind) {
  if (kind === "reservation") return CalendarDays
  if (kind === "room") return BedDouble
  if (kind === "asset") return Package
  return ShoppingCart
}

export function ObjectCommandPalette({ access, canAccessDepartment }: ObjectCommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [routeCapabilities, setRouteCapabilities] = useState<CanonicalCapabilitySnapshot>({ domains: {} })
  const [capabilitiesReady, setCapabilitiesReady] = useState(false)
  const router = useRouter()
  const { language } = useLanguage()
  const supabase = useMemo(() => createClient(), [])
  const text = copy[language as keyof typeof copy] ?? copy.en

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setLoading(false)
      return
    }

    let cancelled = false
    setCapabilitiesReady(false)
    void supabase.rpc("get_current_route_access").then(({ data, error }) => {
      if (cancelled) return
      setRouteCapabilities(error ? { domains: {} } : normalizeCapabilitySnapshot(data))
      setCapabilitiesReady(true)
    })
    return () => { cancelled = true }
  }, [open, supabase])

  const canSearchBooking = access.is_admin || (hasCapability(routeCapabilities, "booking", "view") && canAccessDepartment("booking"))
  const canSearchInventory = access.is_admin || (hasCapability(routeCapabilities, "inventory", "view") && canAccessDepartment("inventory"))
  const canSearchProcurement = access.is_admin || (hasCapability(routeCapabilities, "procurement", "view") && canAccessDepartment("procurement"))

  useEffect(() => {
    const term = safeSearchTerm(query)
    if (!open || !capabilitiesReady || access.role === "none" || term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      const pattern = `%${term}%`

      void (async () => {
        const searches: Array<PromiseLike<SearchResult[]>> = []

        if (canSearchBooking) {
          searches.push(
            supabase
              .from("reservations")
              .select("id, guest_name, guest_email, bedbooking_ref, status, check_in, check_out")
              .or(`guest_name.ilike.${pattern},guest_email.ilike.${pattern},bedbooking_ref.ilike.${pattern}`)
              .order("check_in", { ascending: false })
              .limit(6)
              .then(({ data, error }) => error ? [] : ((data ?? []) as ReservationRow[]).map((row) => ({
                id: row.id,
                kind: "reservation" as const,
                title: row.guest_name || row.bedbooking_ref || row.id,
                subtitle: [row.bedbooking_ref, row.status, row.check_in && row.check_out ? `${row.check_in} → ${row.check_out}` : null].filter(Boolean).join(" · "),
                href: `/bookings/reservations/${row.id}`,
              }))),
            supabase
              .from("rooms")
              .select("id, room_number, room_type, location, status")
              .or(`room_number.ilike.${pattern},room_type.ilike.${pattern},location.ilike.${pattern}`)
              .order("room_number", { ascending: true })
              .limit(6)
              .then(({ data, error }) => error ? [] : ((data ?? []) as RoomRow[]).map((row) => ({
                id: row.id,
                kind: "room" as const,
                title: row.room_number || row.id,
                subtitle: [row.room_type, row.location, row.status].filter(Boolean).join(" · "),
                href: `/bookings/rooms/${row.id}`,
              }))),
          )
        }

        if (canSearchInventory) {
          searches.push(
            supabase
              .from("assets")
              .select("id, name, asset_code, serial_number, status, location")
              .or(`name.ilike.${pattern},asset_code.ilike.${pattern},serial_number.ilike.${pattern},location.ilike.${pattern}`)
              .order("name", { ascending: true })
              .limit(6)
              .then(({ data, error }) => error ? [] : ((data ?? []) as AssetRow[]).map((row) => ({
                id: row.id,
                kind: "asset" as const,
                title: row.name || row.asset_code || row.id,
                subtitle: [row.asset_code, row.serial_number, row.location, row.status].filter(Boolean).join(" · "),
                href: `/inventory/${row.id}`,
              }))),
          )
        }

        if (canSearchProcurement) {
          searches.push(
            supabase
              .from("procurement_requests")
              .select("id, request_number, title, status, priority")
              .or(`request_number.ilike.${pattern},title.ilike.${pattern},status.ilike.${pattern}`)
              .order("created_at", { ascending: false })
              .limit(6)
              .then(({ data, error }) => error ? [] : ((data ?? []) as PurchaseRow[]).map((row) => ({
                id: row.id,
                kind: "purchase" as const,
                title: row.title || row.request_number || row.id,
                subtitle: [row.request_number, row.status, row.priority].filter(Boolean).join(" · "),
                href: `/procurement/requests/${row.id}`,
              }))),
          )
        }

        const groups = await Promise.all(searches)
        if (cancelled) return
        setResults(groups.flat().slice(0, 24))
        setLoading(false)
      })()
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [access.role, canSearchBooking, canSearchInventory, canSearchProcurement, capabilitiesReady, open, query, supabase])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(`/${language}${href}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <DialogTitle className="sr-only">{text.title}</DialogTitle>
        <DialogDescription className="sr-only">{text.description}</DialogDescription>
        <Command shouldFilter={false} className="bg-background text-foreground">
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input
              autoFocus
              aria-label={text.title}
              value={query}
              onValueChange={setQuery}
              placeholder={text.placeholder}
              className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <span className="hidden rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">ESC</span>
          </div>
          <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            {loading && <div className="flex items-center gap-2 px-3 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{text.loading}</div>}
            {!loading && query.trim().length < 2 && <div className="px-3 py-8 text-sm text-muted-foreground">{text.start}</div>}
            {!loading && query.trim().length >= 2 && results.length === 0 && <Command.Empty className="px-3 py-8 text-sm text-muted-foreground">{text.empty}</Command.Empty>}
            {!loading && results.map((result) => {
              const Icon = resultIcon(result.kind)
              return (
                <Command.Item
                  key={`${result.kind}:${result.id}`}
                  value={`${result.kind}:${result.id}`}
                  onSelect={() => navigate(result.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-sm outline-none data-[selected=true]:bg-muted"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/40"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate font-medium">{result.title}</span><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{text[result.kind]}</span></span>
                    {result.subtitle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.subtitle}</span>}
                  </span>
                </Command.Item>
              )
            })}
          </Command.List>
          <div className="flex items-center justify-between gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
            <span className="min-w-0">{text.description}</span>
            <span className="shrink-0 whitespace-nowrap">⌘K / Ctrl K</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
