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
import { createClient } from "@/lib/supabase/client"

type AppRole = "admin" | "approver" | "operator" | "viewer" | null

type NavigationItem = {
  nameKey: string
  href: string
  icon: ElementType
  tipKey: string
  adminOnly?: boolean
  procurementOnly?: boolean
  subItems?: Array<{ nameKey: string; href: string; icon: string }>
}

type NavigationGroup = {
  labelKey: string
  descKey: string
  items: NavigationItem[]
}

const navigationGroups: NavigationGroup[] = [
  {
    labelKey: "nav.admin_general",
    descKey: "nav.admin_general_desc",
    items: [
      { nameKey: "nav.dashboard", href: "/", icon: LayoutDashboard, tipKey: "nav.dashboard_tip" },
      { nameKey: "nav.budgets", href: "/budgets", icon: DollarSign, tipKey: "nav.budgets_tip" },
      { nameKey: "nav.people_operations", href: "/employees", icon: Users, tipKey: "nav.employees_tip" },
      { nameKey: "nav.energy_management", href: "/energy", icon: Zap, tipKey: "nav.management_tip" },
      { nameKey: "nav.ai_ops", href: "/ai-ops", icon: Bot, tipKey: "nav.ai_ops_tip" },
      { nameKey: "nav.admin", href: "/admin", icon: Settings, tipKey: "nav.admin_tip", adminOnly: true },
    ],
  },
  {
    labelKey: "nav.hospitality",
    descKey: "nav.hospitality_desc",
    items: [
      { nameKey: "nav.bookings", href: "/bookings", icon: Calendar, tipKey: "nav.bookings_tip" },
      { nameKey: "nav.invoices", href: "/bookings/invoices", icon: Receipt, tipKey: "nav.invoices_tip" },
      { nameKey: "nav.concierge", href: "/concierge", icon: MessageSquare, tipKey: "nav.concierge_tip" },
      { nameKey: "nav.guest_requests", href: "/guest-requests", icon: Tablet, tipKey: "nav.guest_requests_tip" },
      { nameKey: "nav.sovereignty_dashboard", href: "/sovereignty", icon: Crown, tipKey: "nav.sovereignty_dashboard_tip" },
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
        subItems: [
          { nameKey: "nav.cattle_overview", href: "/cattle", icon: "🐄" },
          { nameKey: "nav.cattle_health", href: "/cattle-health", icon: "❤️" },
        ],
      },
      { nameKey: "nav.combustibles", href: "/combustibles", icon: Fuel, tipKey: "nav.combustibles_tip" },
    ],
  },
  {
    labelKey: "nav.infrastructure",
    descKey: "nav.infrastructure_desc",
    items: [
      { nameKey: "nav.property_management", href: "/property-management", icon: Building, tipKey: "nav.property_management_desc" },
      { nameKey: "nav.inventory", href: "/inventory", icon: Package, tipKey: "nav.inventory_tip" },
      { nameKey: "nav.procurement", href: "/procurement", icon: TrendingUp, tipKey: "nav.procurement_tip", procurementOnly: true },
      { nameKey: "nav.maintenance", href: "/maintenance", icon: Wrench, tipKey: "nav.maintenance_tip" },
      { nameKey: "nav.tasks", href: "/tasks", icon: ClipboardList, tipKey: "nav.tasks_tip" },
      { nameKey: "nav.issues", href: "/issues", icon: AlertCircle, tipKey: "nav.facility_requests_tip" },
      { nameKey: "nav.checklists", href: "/checklists", icon: CheckSquare, tipKey: "nav.checklists_tip" },
      { nameKey: "nav.map", href: "/map", icon: Map, tipKey: "nav.gis_map_tip" },
    ],
  },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClient()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userInitials, setUserInitials] = useState("?")
  const [role, setRole] = useState<AppRole>(null)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setRole((user.app_metadata?.procurement_role as AppRole) || null)
      if (user.email) {
        setUserEmail(user.email)
        const parts = user.user_metadata?.full_name?.split(" ") ?? user.email.split("@")[0].split(".")
        setUserInitials(parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join(""))
      }
    })
  }, [])

  const visibleGroups = useMemo(() => navigationGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.adminOnly) return role === "admin"
      if (item.procurementOnly) return role === "admin" || role === "approver"
      return true
    }),
  })), [role])

  useEffect(() => {
    const initialExpanded = new Set<string>()
    visibleGroups.forEach((group) => {
      if (group.items.some((item) => pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href)) || item.subItems?.some((subItem) => pathname === subItem.href))) {
        initialExpanded.add(group.labelKey)
      }
    })
    setExpandedGroups(initialExpanded)
  }, [pathname, visibleGroups])

  useEffect(() => {
    const initialExpanded = new Set<string>()
    visibleGroups.forEach((group) => group.items.forEach((item) => {
      if (item.subItems?.some((subItem) => pathname === subItem.href)) initialExpanded.add(item.nameKey)
    }))
    setExpandedItems(initialExpanded)
  }, [pathname, visibleGroups])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
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
          <Link href="/" className="flex min-w-0 items-center gap-2 hover:opacity-80">
            <img src="/blackswan-logo.png" alt="Blackswan Logo" className="h-12 w-12 flex-shrink-0 object-contain sm:h-14 sm:w-14" />
            <div className="min-w-0"><h1 className="truncate text-sm font-bold uppercase tracking-wider text-accent sm:text-base">BFCS</h1><p className="text-xs text-muted-foreground">Core System</p></div>
          </Link>
          <button onClick={onClose} className="rounded p-1 hover:bg-secondary lg:hidden" aria-label="Cerrar navegación"><X className="h-5 w-5" /></button>
        </div>

        <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.labelKey} className="min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-1 px-2">
                <div className="min-w-0 flex-1"><h3 className="truncate text-xs font-bold uppercase tracking-wider text-foreground" title={t(group.labelKey)}>{t(group.labelKey)}</h3><p className="mt-1 hidden text-xs leading-tight text-muted-foreground sm:block">{t(group.descKey)}</p></div>
                <button onClick={() => toggleSetValue(setExpandedGroups, expandedGroups, group.labelKey)} className="rounded p-1 hover:bg-muted" aria-label={`Toggle ${t(group.labelKey)}`}><ChevronDown className={cn("h-4 w-4 transition-transform", expandedGroups.has(group.labelKey) ? "rotate-0" : "-rotate-90")} /></button>
              </div>
              {expandedGroups.has(group.labelKey) && <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
                  const hasSubItems = Boolean(item.subItems?.length)
                  const isExpanded = expandedItems.has(item.nameKey)
                  return <div key={item.nameKey} className="min-w-0">
                    <div className="flex min-w-0 items-center">
                      <Link href={item.href} onClick={onClose} className={cn("group flex min-w-0 flex-1 items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")} title={t(item.tipKey)}><item.icon className="h-5 w-5 flex-shrink-0" /><span className="flex-1 truncate">{t(item.nameKey)}</span>{isActive && <span className="h-2 w-2 rounded-full bg-current" />}</Link>
                      {hasSubItems && <button onClick={() => toggleSetValue(setExpandedItems, expandedItems, item.nameKey)} className="rounded p-2 hover:bg-muted" aria-label={`Toggle ${t(item.nameKey)}`}><ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded ? "rotate-0" : "-rotate-90")} /></button>}
                    </div>
                    {hasSubItems && isExpanded && <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-border pl-2">{item.subItems?.map((subItem) => <Link key={subItem.href} href={subItem.href} onClick={onClose} className={cn("flex items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors", pathname === subItem.href ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><span>{subItem.icon}</span><span className="truncate">{t(subItem.nameKey)}</span></Link>)}</div>}
                  </div>
                })}
              </div>}
            </div>
          ))}
        </nav>

        <div className="space-y-3 border-t border-secondary p-3">
          <LanguageSwitcher />
          <button onClick={handleOpenSearch} className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><HelpCircle className="h-5 w-5" /><span>Buscar</span><span className="ml-auto text-xs">⌘K</span></button>
          <div className="flex items-center gap-3 rounded bg-muted/40 px-3 py-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{userInitials}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{userEmail || "Usuario"}</p><p className="text-[11px] text-muted-foreground">{role || "usuario"}</p></div><button onClick={handleLogout} className="rounded p-1.5 hover:bg-muted" title="Cerrar sesión"><LogOut className="h-4 w-4" /></button></div>
        </div>
      </div>
    </>
  )
}
