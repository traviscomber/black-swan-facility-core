"use client"

import { useState, useEffect } from "react"

import { LayoutDashboard, Calendar, Receipt, ClipboardList, Crown, Brain, TrendingUp, Beef, Box, Package, Wrench, Anchor, Zap, FileText, Lightbulb, Code, Users, Heart, MessageSquare, Tablet, ChefHat, CheckSquare, AlertCircle, Bot, Settings, X, ChevronDown, HelpCircle, Map, Fuel, Building, Leaf, Grape, Images } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useLanguage } from "@/lib/hooks/use-language"

const navigationGroups = [
  {
    labelKey: "nav.core_operations",
    descKey: "nav.core_operations_desc",
    items: [
      { nameKey: "nav.dashboard", href: "/", icon: LayoutDashboard, tipKey: "nav.dashboard_tip" },
      { nameKey: "nav.bookings", href: "/bookings", icon: Calendar, tipKey: "nav.bookings_tip" },
      { nameKey: "nav.invoices", href: "/bookings/invoices", icon: Receipt, tipKey: "nav.invoices_tip" },
      { nameKey: "nav.tasks", href: "/tasks", icon: ClipboardList, tipKey: "nav.tasks_tip" },
    ],
  },
  {
    labelKey: "nav.sovereignty",
    descKey: "nav.sovereignty_desc",
    items: [
      { nameKey: "nav.sovereignty_dashboard", href: "/sovereignty", icon: Crown, tipKey: "nav.sovereignty_dashboard_tip" },
      { nameKey: "nav.coach", href: "/sovereignty/coach", icon: Brain, tipKey: "nav.coach_tip" },
      { nameKey: "nav.layers", href: "/sovereignty/layers", icon: TrendingUp, tipKey: "nav.layers_tip" },
    ],
  },
  {
    labelKey: "nav.cattle_operations",
    descKey: "nav.cattle_operations_desc",
    items: [
      { nameKey: "nav.dashboard", href: "/cattle", icon: Beef, tipKey: "nav.dashboard_tip" },
      { nameKey: "nav.cattle_health", href: "/cattle-health", icon: Heart, tipKey: "nav.cattle_health_tip" },
      { nameKey: "nav.expert_coach", href: "/cattle/expert-agent", icon: Brain, tipKey: "nav.expert_coach_tip" },
      { nameKey: "nav.business_plan", href: "/cattle/business-plan", icon: TrendingUp, tipKey: "nav.business_plan_tip" },
      { nameKey: "nav.pricing_costs", href: "/cattle/pricing-costs", icon: Box, tipKey: "nav.pricing_costs_tip" },
    ],
  },
  {
    labelKey: "nav.property_management",
    descKey: "nav.property_management_desc",
    items: [
      { nameKey: "nav.assets", href: "/assets", icon: Box, tipKey: "nav.assets_tip" },
      {
        nameKey: "nav.inventory",
        href: "/inventory",
        icon: Package,
        tipKey: "nav.inventory_tip",
        subItems: [
          { nameKey: "nav.all_assets", href: "/inventory", icon: "📦" },
          { nameKey: "nav.by_category", href: "/inventory/by-category", icon: "🏷️" },
          { nameKey: "nav.by_cost_center", href: "/inventory/by-cost-center", icon: "💼" },
          { nameKey: "nav.categories", href: "/inventory/categories", icon: "⚙️" },
          { nameKey: "nav.cost_centers", href: "/inventory/cost-centers", icon: "🏢" },
          { nameKey: "nav.audit_logs", href: "/inventory/audit-logs", icon: "📋" },
        ],
      },
      { nameKey: "nav.operations", href: "/operations", icon: Map, tipKey: "nav.operations_tip" },
      { nameKey: "nav.fuel_consumption", href: "/fuel-consumption", icon: Fuel, tipKey: "nav.fuel_consumption_tip" },
      { nameKey: "nav.maintenance", href: "/maintenance", icon: Wrench, tipKey: "nav.maintenance_tip" },
      { nameKey: "nav.gis_map", href: "/map", icon: Map, tipKey: "nav.gis_map_tip" },
      { nameKey: "nav.kmz_viewer", href: "/map/kmz-viewer", icon: Map, tipKey: "nav.kmz_viewer_tip" },
    ],
  },
  {
    labelKey: "nav.off_grid_energy",
    descKey: "nav.off_grid_energy_desc",
    items: [
      { nameKey: "nav.management", href: "/energy", icon: Zap, tipKey: "nav.management_tip" },
      { nameKey: "nav.energy_dashboard", href: "/energy-dashboard", icon: TrendingUp, tipKey: "nav.energy_dashboard_tip" },
      { nameKey: "nav.reports", href: "/energy-reports", icon: FileText, tipKey: "nav.reports_tip" },
      { nameKey: "nav.victron_setup", href: "/victron-setup", icon: Lightbulb, tipKey: "nav.victron_setup_tip" },
      {
        nameKey: "nav.integration_docs",
        href: "/integration-docs",
        icon: Code,
        tipKey: "nav.integration_docs_tip",
      },
    ],
  },
  {
    labelKey: "nav.orchard_farm",
    descKey: "nav.orchard_farm_desc",
    items: [
      { nameKey: "nav.orchard_dashboard", href: "/orchard", icon: Leaf, tipKey: "nav.orchard_dashboard_tip" },
      { nameKey: "nav.orchard_crops", href: "/orchard/crops", icon: Box, tipKey: "nav.orchard_crops_tip" },
      { nameKey: "nav.orchard_care", href: "/orchard/care", icon: Heart, tipKey: "nav.orchard_care_tip" },
      { nameKey: "nav.orchard_harvest", href: "/orchard/harvest", icon: TrendingUp, tipKey: "nav.orchard_harvest_tip" },
      { nameKey: "nav.orchard_pests", href: "/orchard/pests", icon: AlertCircle, tipKey: "nav.orchard_pests_tip" },
      { nameKey: "nav.orchard_soil", href: "/orchard/soil", icon: Box, tipKey: "nav.orchard_soil_tip" },
      { nameKey: "nav.orchard_equipment", href: "/orchard/equipment", icon: Wrench, tipKey: "nav.orchard_equipment_tip" },
      { nameKey: "nav.orchard_analytics", href: "/orchard/analytics", icon: TrendingUp, tipKey: "nav.orchard_analytics_tip" },
    ],
  },
  {
    labelKey: "nav.vineyard",
    descKey: "nav.vineyard_desc",
    items: [
      { nameKey: "nav.vineyard_dashboard", href: "/vineyard", icon: Grape, tipKey: "nav.vineyard_dashboard_tip" },
      { nameKey: "nav.vineyard_photos", href: "/vineyard/photos", icon: Images, tipKey: "nav.vineyard_photos_tip" },
      { nameKey: "nav.vineyard_vines", href: "/vineyard/crops", icon: Box, tipKey: "nav.vineyard_vines_tip" },
      { nameKey: "nav.vineyard_care", href: "/vineyard/care", icon: Heart, tipKey: "nav.vineyard_care_tip" },
      { nameKey: "nav.vineyard_harvest", href: "/vineyard/harvest", icon: TrendingUp, tipKey: "nav.vineyard_harvest_tip" },
      { nameKey: "nav.vineyard_pests", href: "/vineyard/pests", icon: AlertCircle, tipKey: "nav.vineyard_pests_tip" },
      { nameKey: "nav.vineyard_soil", href: "/vineyard/soil", icon: Box, tipKey: "nav.vineyard_soil_tip" },
      { nameKey: "nav.vineyard_equipment", href: "/vineyard/equipment", icon: Wrench, tipKey: "nav.vineyard_equipment_tip" },
      { nameKey: "nav.vineyard_analytics", href: "/vineyard/analytics", icon: TrendingUp, tipKey: "nav.vineyard_analytics_tip" },
    ],
  },
  {
    labelKey: "nav.supply_chain",
    descKey: "nav.supply_chain_desc",
    items: [
      { nameKey: "nav.procurement", href: "/procurement", icon: Box, tipKey: "nav.procurement_tip" },
      {
        nameKey: "nav.suppliers",
        href: "/procurement/suppliers",
        icon: Users,
        tipKey: "nav.suppliers_tip",
      },
      {
        nameKey: "nav.analytics",
        href: "/procurement/analytics",
        icon: TrendingUp,
        tipKey: "nav.analytics_tip",
      },
      {
        nameKey: "nav.property_management",
        href: "/procurement/facilities",
        icon: Building,
        tipKey: "nav.property_management_desc",
      },
    ],
  },
  {
    labelKey: "nav.people_operations",
    descKey: "nav.people_operations_desc",
    items: [
      { nameKey: "nav.employees", href: "/employees", icon: Users, tipKey: "nav.employees_tip" },
      { nameKey: "nav.volunteers", href: "/volunteers", icon: Heart, tipKey: "nav.volunteers_tip" },
      { nameKey: "nav.activities", href: "/activities-calendar", icon: Calendar, tipKey: "nav.activities_tip" },
      { nameKey: "nav.concierge", href: "/concierge", icon: MessageSquare, tipKey: "nav.concierge_tip" },
      {
        nameKey: "nav.guest_requests",
        href: "/guest-requests",
        icon: Tablet,
        tipKey: "nav.guest_requests_tip",
      },
      { nameKey: "nav.kitchen", href: "/kitchen", icon: ChefHat, tipKey: "nav.kitchen_tip" },
      { nameKey: "nav.checklists", href: "/checklists", icon: CheckSquare, tipKey: "nav.checklists_tip" },
    ],
  },
  {
    labelKey: "nav.advanced",
    descKey: "nav.advanced_desc",
    items: [
      {
        nameKey: "nav.facility_requests",
        href: "/issues",
        icon: AlertCircle,
        tipKey: "nav.facility_requests_tip",
      },
      { nameKey: "nav.ai_ops", href: "/ai-ops", icon: Bot, tipKey: "nav.ai_ops_tip" },
      { nameKey: "nav.admin", href: "/admin", icon: Settings, tipKey: "nav.admin_tip" },
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
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Initialize expanded groups based on pathname (only run on pathname changes)
  useEffect(() => {
    const initialExpanded = new Set<string>()
    navigationGroups.forEach((group) => {
      const isInGroup = group.items.some((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
        const subItemActive = item.subItems?.some((sub) => pathname === sub.href) ?? false
        return isActive || subItemActive
      })
      if (isInGroup) {
        initialExpanded.add(group.labelKey)
      }
    })
    setExpandedGroups(initialExpanded)
  }, [pathname])

  // Initialize expanded sub-items based on pathname (only run on pathname changes)
  useEffect(() => {
    const initialExpanded = new Set<string>()
    navigationGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.subItems) {
          const isSubActive = item.subItems.some((sub) => pathname === sub.href)
          if (isSubActive) {
            initialExpanded.add(item.nameKey)
          }
        }
      })
    })
    setExpandedItems(initialExpanded)
  }, [pathname])

  const toggleGroup = (label: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(label)) {
      newExpanded.delete(label)
    } else {
      newExpanded.add(label)
    }
    setExpandedGroups(newExpanded)
  }

  const toggleSubItems = (itemName: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemName)) {
      newExpanded.delete(itemName)
    } else {
      newExpanded.add(itemName)
    }
    setExpandedItems(newExpanded)
  }

  const handleOpenSearch = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      code: "KeyK",
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  }

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={onClose} />}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-secondary bg-white transition-transform duration-300 lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 lg:h-full overflow-y-auto min-h-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 sm:h-20 items-center justify-between border-b border-secondary bg-gradient-to-r from-primary/10 to-transparent px-3 sm:px-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0">
            <img
              src="/blackswan-logo.png"
              alt="Blackswan Logo"
              className="h-12 sm:h-14 w-12 sm:w-14 object-contain flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold uppercase tracking-wider text-accent truncate">BFCS</h1>
              <p className="text-xs text-gray-600">Core System</p>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-secondary rounded">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 sm:space-y-3 px-2 sm:px-3 py-3 sm:py-4 overflow-y-auto min-h-0">
          {navigationGroups.map((group) => (
            <div key={group.labelKey} className="space-y-1 min-w-0">
              <div className="flex items-start justify-between px-2 gap-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 truncate">{t(group.labelKey)}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-tight hidden sm:block break-words">{t(group.descKey)}</p>
                </div>
                <button
                  onClick={() => toggleGroup(group.labelKey)}
                  className="ml-1 p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                  aria-label={`Toggle ${t(group.labelKey)}`}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-gray-600 transition-transform duration-200",
                      expandedGroups.has(group.labelKey) ? "rotate-0" : "-rotate-90",
                    )}
                  />
                </button>
              </div>
              {expandedGroups.has(group.labelKey) && (
                <div className="space-y-0.5 min-w-0">
                  {group.items.map((item: any) => {
                    const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
                    const hasSubItems = item.subItems && item.subItems.length > 0
                    const isExpanded = expandedItems.has(item.nameKey)

                    return (
                      <div key={item.nameKey} className="min-w-0">
                        <div className="flex items-center gap-0 min-w-0">
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                              "group flex-1 flex items-center gap-2 sm:gap-3 rounded px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-all duration-200 min-w-0 truncate",
                              isActive
                                ? "bg-primary text-white shadow-md"
                                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                            )}
                            title={t(item.tipKey)}
                          >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            <span className="flex-1">{t(item.nameKey)}</span>
                            {isActive && <div className="h-2 w-2 rounded-full bg-white flex-shrink-0"></div>}
                          </Link>
                          {hasSubItems && (
                            <button
                              onClick={() => toggleSubItems(item.nameKey)}
                              className="px-2 py-2 hover:bg-gray-100 rounded transition-colors"
                            >
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-gray-600 transition-transform duration-200",
                                  isExpanded ? "rotate-0" : "-rotate-90",
                                )}
                              />
                            </button>
                          )}
                        </div>
                        {hasSubItems && isExpanded && (
                          <div className="ml-4 space-y-0.5 mt-1 border-l-2 border-gray-200 pl-2 min-w-0">
                            {item.subItems.map((subItem: any) => {
                              const isSubActive = pathname === subItem.href
                              return (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  onClick={onClose}
                                  className={cn(
                                    "flex items-center gap-2 rounded px-2 py-1 text-xs font-medium transition-all duration-200",
                                    isSubActive
                                      ? "bg-primary/20 text-primary"
                                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                                  )}
                                >
                                  <span>{subItem.icon}</span>
                                  <span>{t(subItem.nameKey)}</span>
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-secondary bg-secondary/20 p-3 sm:p-4 space-y-3">
          <div className="w-full">
            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">Language</p>
            <LanguageSwitcher />
          </div>
          <button
            onClick={handleOpenSearch}
            className="w-full flex items-start gap-2 hover:opacity-80 transition-opacity text-left"
          >
            <HelpCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-semibold text-gray-800">Need Help?</p>
              <p className="text-xs text-gray-600 mt-1">Press ⌘K to search</p>
            </div>
          </button>
          <div className="pt-2 border-t border-secondary/50">
            <p className="text-xs text-gray-500">BFCS v1.0</p>
          </div>
        </div>
      </div>

      {/* Using a portal wrapper to ensure dialog displays correctly */}
      {/* {openSearch && <UniversalSearchDialog open={openSearch} onOpenChange={setOpenSearch} />} */}
    </>
  )
}
