"use client"

import { useEffect, useMemo, useState } from "react"
import type { ElementType } from "react"
import {
  Activity,
  AlertCircle,
  Beef,
  Bot,
  Building,
  Calendar,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Crown,
  DollarSign,
  Fuel,
  Grape,
  HelpCircle,
  Home,
  LayoutDashboard,
  Leaf,
  LogOut,
  Map,
  MessageSquare,
  Network,
  Package,
  Receipt,
  Settings,
  Tablet,
  TrendingUp,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useLanguage } from "@/lib/hooks/use-language"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { createClient } from "@/lib/supabase/client"
import { normalizeCapabilitySnapshot, type CanonicalCapabilitySnapshot } from "@/lib/access/capabilities"
import { filterOsAreas, osAreas, rankAreasForAccess, type OsNavItem } from "@/lib/os/navigation"

const ROUTE_LOCALES = new Set(["en", "es", "de"])

function stripLocale(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] && ROUTE_LOCALES.has(segments[0])) segments.shift()
  return segments.length ? `/${segments.join("/")}` : "/"
}

function localizedHref(locale: string, href: string) {
  return `/${locale}${href === "/" ? "" : href}`
}

const itemIcons: Record<string, ElementType> = {
  bookings: Calendar,
  activities: Activity,
  tasks: ClipboardList,
  checklists: CheckSquare,
  procurement: TrendingUp,
  maintenance: Wrench,
  issues: AlertCircle,
  "guest-requests": Tablet,
  employees: Users,
  "os-people": Users,
  "property-management": Building,
  inventory: Package,
  energy: Zap,
  map: Map,
  orchard: Leaf,
  vineyard: Grape,
  cattle: Beef,
  "cattle-health": Beef,
  fuel: Fuel,
  budget: DollarSign,
  approvals: CheckSquare,
  documents: Receipt,
  reconciliation: TrendingUp,
  accounting: DollarSign,
  invoices: Receipt,
  discovery: Network,
  events: Calendar,
  "event-providers": Users,
  "front-door": Home,
  education: Users,
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname() || "/"
  const { t, language } = useLanguage()
  const internalPathname = useMemo(() => stripLocale(pathname), [pathname])
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { access, loading, error, can, canAccessDepartment } = useEffectiveAccess()
  const [routeCapabilities, setRouteCapabilities] = useState<CanonicalCapabilitySnapshot>({ domains: {} })
  const [routeCapabilitiesLoading, setRouteCapabilitiesLoading] = useState(true)
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userInitials, setUserInitials] = useState("?")
  const [financePendingCount, setFinancePendingCount] = useState(0)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) return
      setUserEmail(user.email)
      const parts = user.user_metadata?.full_name?.split(" ") ?? user.email.split("@")[0].split(".")
      setUserInitials(parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join(""))
    })
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    if (loading) return () => { cancelled = true }
    setRouteCapabilitiesLoading(true)
    void supabase.rpc("get_current_route_access").then(({ data, error: routeError }) => {
      if (cancelled) return
      setRouteCapabilities(routeError ? { domains: {} } : normalizeCapabilitySnapshot(data))
      setRouteCapabilitiesLoading(false)
    })
    return () => { cancelled = true }
  }, [loading, supabase])

  useEffect(() => {
    if (!canAccessDepartment("finance")) {
      setFinancePendingCount(0)
      return
    }
    let cancelled = false
    const loadFinancePendingCount = async () => {
      const [readyResult, mappingResult, reviewResult] = await Promise.all([
        supabase.from("finance_documents").select("id", { count: "exact", head: true }).eq("approval_status", "ready"),
        supabase.from("finance_documents").select("id", { count: "exact", head: true }).eq("approval_status", "pending_mapping"),
        supabase.rpc("can_finance_review_ambiguous"),
      ])
      if (cancelled) return
      setFinancePendingCount((readyResult.count ?? 0) + (reviewResult.data ? (mappingResult.count ?? 0) : 0))
    }
    void loadFinancePendingCount()
    const handler = () => void loadFinancePendingCount()
    window.addEventListener("finance-workbook-imported", handler)
    return () => {
      cancelled = true
      window.removeEventListener("finance-workbook-imported", handler)
    }
  }, [canAccessDepartment, supabase])

  useEffect(() => {
    if (!loading && (error || access.role === "none")) {
      void supabase.auth.signOut().finally(() => router.replace(localizedHref(language, "/auth/login?reason=access")))
    }
  }, [access.role, error, language, loading, router, supabase])

  const visibleAreas = useMemo(() => rankAreasForAccess(
    filterOsAreas(osAreas, routeCapabilities, access),
    access,
  ), [access, routeCapabilities])

  useEffect(() => {
    const initial = new Set<string>()
    visibleAreas.forEach((area) => {
      if (area.items.some((item) => isItemActive(internalPathname, item))) initial.add(area.key)
    })
    setExpandedAreas(initial)
  }, [internalPathname, visibleAreas])

  useEffect(() => {
    const initial = new Set<string>()
    visibleAreas.forEach((area) => area.items.forEach((item) => {
      if (item.subItems?.some((subItem) => internalPathname === subItem.href)) initial.add(item.key)
    }))
    setExpandedItems(initial)
  }, [internalPathname, visibleAreas])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push(localizedHref(language, "/auth/login"))
  }

  const toggleSetValue = (setter: (value: Set<string>) => void, current: Set<string>, value: string) => {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  const handleOpenSearch = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", metaKey: true, bubbles: true }))
  const showConcierge = can("hospitality.operate") && canAccessDepartment("hospitality")
  const accessLoading = loading || routeCapabilitiesLoading

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={onClose} />}
      <div className={cn("fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col overflow-y-auto border-r border-secondary bg-white transition-transform duration-300 lg:relative lg:inset-auto lg:z-auto lg:h-full lg:translate-x-0", isOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-16 items-center justify-between border-b border-secondary bg-primary/5 px-4 sm:h-20">
          <Link href={localizedHref(language, "/")} className="flex min-w-0 items-center gap-2 hover:opacity-80">
            <img src="/blackswan-logo.png" alt="Blackswan Logo" className="h-12 w-12 flex-shrink-0 object-contain sm:h-14 sm:w-14" />
            <div className="min-w-0"><h1 className="truncate text-sm font-bold uppercase tracking-wider text-accent sm:text-base">BFCS</h1><p className="text-xs text-muted-foreground">Core System</p></div>
          </Link>
          <button onClick={onClose} className="rounded p-1 hover:bg-secondary lg:hidden" aria-label={t("shell.close_navigation")}><X className="h-5 w-5" /></button>
        </div>

        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {accessLoading ? <p className="px-3 text-xs text-muted-foreground">{t("shell.loading_access")}</p> : visibleAreas.map((area) => {
            const isToday = area.key === "today"
            const areaActive = isToday ? internalPathname === "/os" : area.items.some((item) => isItemActive(internalPathname, item))
            return <div key={area.key} className="space-y-1">
              <div className="flex items-center gap-1">
                <Link href={localizedHref(language, area.href)} onClick={onClose} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded px-3 py-2 text-sm font-semibold", areaActive ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  <span className="truncate">{t(area.labelKey)}</span>
                </Link>
                {!isToday && area.items.length > 0 && <button onClick={() => toggleSetValue(setExpandedAreas, expandedAreas, area.key)} className="rounded p-2 hover:bg-muted" aria-label={`${t("shell.toggle")} ${t(area.labelKey)}`}><ChevronDown className={cn("h-4 w-4 transition-transform", expandedAreas.has(area.key) ? "rotate-0" : "-rotate-90")} /></button>}
              </div>
              {!isToday && expandedAreas.has(area.key) && <div className="space-y-0.5 pl-2">{area.items.map((item) => <NavItem key={item.key} item={item} language={language} internalPathname={internalPathname} t={t} onClose={onClose} financePendingCount={financePendingCount} expandedItems={expandedItems} toggleItem={() => toggleSetValue(setExpandedItems, expandedItems, item.key)} />)}</div>}
            </div>
          })}

          <div className="mt-4 border-t pt-3">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("shell.global_tools")}</p>
            <UtilityLink href="/" icon={LayoutDashboard} label={t("nav.dashboard")} language={language} onClose={onClose} />
            {showConcierge && <UtilityLink href="/concierge" icon={MessageSquare} label={t("shell.concierge")} language={language} onClose={onClose} />}
            {access.is_admin && <UtilityLink href="/ai-ops" icon={Bot} label={t("shell.ai_ops")} language={language} onClose={onClose} />}
            {access.is_admin && <UtilityLink href="/sovereignty" icon={Crown} label={t("nav.sovereignty_dashboard")} language={language} onClose={onClose} />}
            {access.is_admin && <UtilityLink href="/admin" icon={Settings} label={t("shell.admin")} language={language} onClose={onClose} />}
          </div>
        </nav>

        <div className="space-y-3 border-t border-secondary p-3">
          <LanguageSwitcher />
          <button onClick={handleOpenSearch} className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><HelpCircle className="h-5 w-5" /><span>{t("shell.search")}</span><span className="ml-auto text-xs">⌘K</span></button>
          <div className="flex items-center gap-3 rounded bg-muted/40 px-3 py-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{userInitials}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{userEmail || t("shell.user")}</p><p className="text-[11px] text-muted-foreground">{access.role || "user"}</p></div><button onClick={handleLogout} className="rounded p-1.5 hover:bg-muted" title={t("shell.logout")}><LogOut className="h-4 w-4" /></button></div>
        </div>
      </div>
    </>
  )
}

function isItemActive(pathname: string, item: OsNavItem) {
  return pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)) || Boolean(item.subItems?.some((subItem) => pathname === subItem.href))
}

function NavItem({ item, language, internalPathname, t, onClose, financePendingCount, expandedItems, toggleItem }: { item: OsNavItem; language: string; internalPathname: string; t: (key: string) => string; onClose?: () => void; financePendingCount: number; expandedItems: Set<string>; toggleItem: () => void }) {
  const Icon = itemIcons[item.key] ?? LayoutDashboard
  const isActive = isItemActive(internalPathname, item)
  const hasSubItems = Boolean(item.subItems?.length)
  const isExpanded = expandedItems.has(item.key)
  const badgeValue = item.badge === "finance_pending" ? financePendingCount : 0
  return <div className="min-w-0">
    <div className="flex min-w-0 items-center">
      <Link href={localizedHref(language, item.href)} onClick={onClose} className={cn("group flex min-w-0 flex-1 items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")} title={t(item.tipKey)}><Icon className="h-4 w-4 flex-shrink-0" /><span className="flex-1 truncate">{t(item.nameKey)}</span>{badgeValue > 0 && <span className="min-w-6 bg-[var(--bs-warm-yellow)] px-1.5 py-0.5 text-center text-[11px] font-semibold text-[var(--bs-bg-primary)]">{badgeValue > 99 ? "99+" : badgeValue}</span>}</Link>
      {hasSubItems && <button onClick={toggleItem} className="rounded p-2 hover:bg-muted"><ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded ? "rotate-0" : "-rotate-90")} /></button>}
    </div>
    {hasSubItems && isExpanded && <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-border pl-2">{item.subItems?.map((subItem) => <Link key={subItem.href} href={localizedHref(language, subItem.href)} onClick={onClose} className={cn("flex items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors", internalPathname === subItem.href ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><span>{subItem.icon}</span><span className="truncate">{t(subItem.nameKey)}</span></Link>)}</div>}
  </div>
}

function UtilityLink({ href, icon: Icon, label, language, onClose }: { href: string; icon: ElementType; label: string; language: string; onClose?: () => void }) {
  return <Link href={localizedHref(language, href)} onClick={onClose} className="flex items-center gap-3 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><Icon className="h-4 w-4" /><span className="truncate">{label}</span></Link>
}
