"use client"

import { useEffect, useMemo, useState } from "react"
import type { ElementType } from "react"
import {
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
  LayoutDashboard,
  Leaf,
  LogOut,
  Map,
  MessageSquare,
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

type NavigationItem = {
  nameKey: string
  href: string
  icon: ElementType
  tipKey: string
  badge?: "finance_pending"
  adminOnly?: boolean
  action?: string
  department?: string
  subItems?: Array<{ nameKey: string; href: string; icon: string }>
}

type NavigationGroup = {
  labelKey: string
  descKey: string
  items: NavigationItem[]
}

const ROUTE_LOCALES = new Set(["en", "es", "de"])

function stripLocale(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] && ROUTE_LOCALES.has(segments[0])) segments.shift()
  return segments.length ? `/${segments.join("/")}` : "/"
}

function localizedHref(locale: string, href: string) {
  return `/${locale}${href === "/" ? "" : href}`
}

const navigationGroups: NavigationGroup[] = [
  {
    labelKey: "nav.admin_general",
    descKey: "nav.admin_general_desc",
    items: [
      { nameKey: "nav.dashboard", href: "/", icon: LayoutDashboard, tipKey: "nav.dashboard_tip" },
      { nameKey: "nav.people_operations", href: "/employees", icon: Users, tipKey: "nav.employees_tip", department: "administration" },
      { nameKey: "nav.energy_management", href: "/energy", icon: Zap, tipKey: "nav.management_tip", department: "maintenance" },
      { nameKey: "nav.ai_ops", href: "/ai-ops", icon: Bot, tipKey: "nav.ai_ops_tip", adminOnly: true },
      { nameKey: "nav.admin", href: "/admin", icon: Settings, tipKey: "nav.admin_tip", adminOnly: true },
    ],
  },
  {
    labelKey: "finance",
    descKey: "finance_desc",
    items: [
      { nameKey: "finance_budget", href: "/budgets", icon: DollarSign, tipKey: "finance_budget_tip", action: "payments.record", department: "finance" },
      { nameKey: "finance_approvals", href: "/budgets/approvals", icon: CheckSquare, tipKey: "finance_approvals_tip", badge: "finance_pending", action: "payments.record", department: "finance" },
      { nameKey: "finance_documents", href: "/budgets/documents", icon: Receipt, tipKey: "finance_documents_tip", action: "payments.record", department: "finance" },
      { nameKey: "finance_reconciliation", href: "/budgets/reconciliation", icon: TrendingUp, tipKey: "finance_reconciliation_tip", action: "payments.record", department: "finance" },
    ],
  },
  {
    labelKey: "nav.hospitality",
    descKey: "nav.hospitality_desc",
    items: [
      { nameKey: "nav.bookings", href: "/bookings", icon: Calendar, tipKey: "nav.bookings_tip", action: "booking.modify", department: "booking" },
      { nameKey: "nav.invoices", href: "/bookings/invoices", icon: Receipt, tipKey: "nav.invoices_tip", action: "payments.record", department: "finance" },
      { nameKey: "nav.concierge", href: "/concierge", icon: MessageSquare, tipKey: "nav.concierge_tip", action: "hospitality.operate", department: "hospitality" },
      { nameKey: "nav.guest_requests", href: "/guest-requests", icon: Tablet, tipKey: "nav.guest_requests_tip", action: "hospitality.operate", department: "hospitality" },
      { nameKey: "nav.sovereignty_dashboard", href: "/sovereignty", icon: Crown, tipKey: "nav.sovereignty_dashboard_tip", adminOnly: true },
    ],
  },
  {
    labelKey: "nav.landscaping_farming",
    descKey: "nav.landscaping_farming_desc",
    items: [
      {
        nameKey: "nav.orchard_dashboard",
        href: "/orchard",
        icon: Leaf,
        tipKey: "nav.orchard_dashboard_tip",
        department: "orchard",
        subItems: [
          { nameKey: "nav.orchard_overview", href: "/orchard", icon: "🌳" },
          { nameKey: "nav.orchard_crops", href: "/orchard/crops", icon: "🌱" },
          { nameKey: "nav.orchard_care", href: "/orchard/care", icon: "❤️" },
          { nameKey: "nav.orchard_harvest", href: "/orchard/harvest", icon: "✂️" },
          { nameKey: "nav.orchard_health", href: "/orchard/pests", icon: "🐛" },
          { nameKey: "nav.orchard_soil", href: "/orchard/soil", icon: "🌍" },
          { nameKey: "nav.orchard_equipment", href: "/orchard/equipment", icon: "🔧" },
        ],
      },
      {
        nameKey: "nav.vineyard_dashboard",
        href: "/vineyard",
        icon: Grape,
        tipKey: "nav.vineyard_dashboard_tip",
        department: "vineyard",
        subItems: [
          { nameKey: "nav.vineyard_overview", href: "/vineyard", icon: "🍇" },
          { nameKey: "nav.vineyard_photos", href: "/vineyard/photos", icon: "📸" },
          { nameKey: "nav.vineyard_crops", href: "/vineyard/crops", icon: "🌱" },
          { nameKey: "nav.vineyard_harvest", href: "/vineyard/harvest", icon: "✂️" },
          { nameKey: "nav.vineyard_health", href: "/vineyard/pests", icon: "🐛" },
        ],
      },
      {
        nameKey: "nav.cattle_dashboard",
        href: "/cattle",
        icon: Beef,
        tipKey: "nav.dashboard_tip",
        department: "cattle",
        subItems: [
          { nameKey: "nav.cattle_overview", href: "/cattle", icon: "🐄" },
          { nameKey: "nav.cattle_health", href: "/cattle-health", icon: "❤️" },
        ],
      },
      { nameKey: "nav.combustibles", href: "/combustibles", icon: Fuel, tipKey: "nav.combustibles_tip", action: "fuel.review", department: "fuel" },
    ],
  },
  {
    labelKey: "nav.infrastructure",
    descKey: "nav.infrastructure_desc",
    items: [
      { nameKey: "nav.property_management", href: "/property-management", icon: Building, tipKey: "nav.property_management_desc", department: "maintenance" },
      { nameKey: "nav.inventory", href: "/inventory", icon: Package, tipKey: "nav.inventory_tip", action: "inventory.process", department: "inventory" },
      { nameKey: "nav.procurement", href: "/procurement", icon: TrendingUp, tipKey: "nav.procurement_tip", action: "procurement.operate", department: "procurement" },
      { nameKey: "nav.maintenance", href: "/maintenance", icon: Wrench, tipKey: "nav.maintenance_tip", action: "maintenance.operate", department: "maintenance" },
      { nameKey: "nav.tasks", href: "/tasks", icon: ClipboardList, tipKey: "nav.tasks_tip", department: "operations" },
      { nameKey: "nav.issues", href: "/issues", icon: AlertCircle, tipKey: "nav.facility_requests_tip", action: "maintenance.operate", department: "maintenance" },
      { nameKey: "nav.checklists", href: "/checklists", icon: CheckSquare, tipKey: "nav.checklists_tip", department: "operations" },
      { nameKey: "nav.map", href: "/map", icon: Map, tipKey: "nav.gis_map_tip" },
    ],
  },
]

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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userInitials, setUserInitials] = useState("?")
  const [financePendingCount, setFinancePendingCount] = useState(0)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      if (user.email) {
        setUserEmail(user.email)
        const parts = user.user_metadata?.full_name?.split(" ") ?? user.email.split("@")[0].split(".")
        setUserInitials(parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join(""))
      }
    })
  }, [supabase])

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
      const ready = readyResult.count ?? 0
      const mapping = reviewResult.data ? (mappingResult.count ?? 0) : 0
      setFinancePendingCount(ready + mapping)
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

  const visibleGroups = useMemo(() => navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.adminOnly && !access.is_admin) return false
        if (item.action && !can(item.action)) return false
        if (item.department && !canAccessDepartment(item.department)) return false
        return true
      }),
    }))
    .filter((group) => group.items.length > 0), [access.is_admin, can, canAccessDepartment])

  useEffect(() => {
    const initialExpanded = new Set<string>()
    visibleGroups.forEach((group) => {
      if (group.items.some((item) => internalPathname === item.href || (item.href !== "/" && internalPathname.startsWith(item.href)) || item.subItems?.some((subItem) => internalPathname === subItem.href))) {
        initialExpanded.add(group.labelKey)
      }
    })
    setExpandedGroups(initialExpanded)
  }, [internalPathname, visibleGroups])

  useEffect(() => {
    const initialExpanded = new Set<string>()
    visibleGroups.forEach((group) => group.items.forEach((item) => {
      if (item.subItems?.some((subItem) => internalPathname === subItem.href)) initialExpanded.add(item.nameKey)
    }))
    setExpandedItems(initialExpanded)
  }, [internalPathname, visibleGroups])

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

        <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {loading ? <p className="px-3 text-xs text-muted-foreground">{t("shell.loading_access")}</p> : visibleGroups.map((group) => {
            const groupLabel = t(group.labelKey)
            const groupDesc = t(group.descKey)
            return (
            <div key={group.labelKey} className="min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-1 px-2">
                <div className="min-w-0 flex-1"><h3 className="truncate text-xs font-bold uppercase tracking-wider text-foreground" title={groupLabel}>{groupLabel}</h3><p className="mt-1 hidden text-xs leading-tight text-muted-foreground sm:block">{groupDesc}</p></div>
                <button onClick={() => toggleSetValue(setExpandedGroups, expandedGroups, group.labelKey)} className="rounded p-1 hover:bg-muted" aria-label={`${t("shell.toggle")} ${groupLabel}`}><ChevronDown className={cn("h-4 w-4 transition-transform", expandedGroups.has(group.labelKey) ? "rotate-0" : "-rotate-90")} /></button>
              </div>
              {expandedGroups.has(group.labelKey) && <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = internalPathname === item.href || (item.href !== "/" && internalPathname.startsWith(item.href))
                  const hasSubItems = Boolean(item.subItems?.length)
                  const isExpanded = expandedItems.has(item.nameKey)
                  const itemName = t(item.nameKey)
                  const itemTip = t(item.tipKey)
                  const badgeValue = item.badge === "finance_pending" ? financePendingCount : 0
                  return <div key={item.nameKey} className="min-w-0">
                    <div className="flex min-w-0 items-center">
                      <Link href={localizedHref(language, item.href)} onClick={onClose} className={cn("group flex min-w-0 flex-1 items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")} title={itemTip}><item.icon className="h-5 w-5 flex-shrink-0" /><span className="flex-1 truncate">{itemName}</span>{badgeValue > 0 && <span className="min-w-6 bg-[var(--bs-warm-yellow)] px-1.5 py-0.5 text-center text-[11px] font-semibold text-[var(--bs-bg-primary)]">{badgeValue > 99 ? "99+" : badgeValue}</span>}{isActive && <span className="h-2 w-2 rounded-full bg-current" />}</Link>
                      {hasSubItems && <button onClick={() => toggleSetValue(setExpandedItems, expandedItems, item.nameKey)} className="rounded p-2 hover:bg-muted" aria-label={`${t("shell.toggle")} ${itemName}`}><ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded ? "rotate-0" : "-rotate-90")} /></button>}
                    </div>
                    {hasSubItems && isExpanded && <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-border pl-2">{item.subItems?.map((subItem) => <Link key={subItem.href} href={localizedHref(language, subItem.href)} onClick={onClose} className={cn("flex items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors", internalPathname === subItem.href ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><span>{subItem.icon}</span><span className="truncate">{t(subItem.nameKey)}</span></Link>)}</div>}
                  </div>
                })}
              </div>}
            </div>
          )})}
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
