"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Map,
  Box,
  AlertCircle,
  Wrench,
  Users,
  CheckSquare,
  Settings,
  X,
  Bot,
  Calendar,
  ClipboardList,
  MessageSquare,
  HelpCircle,
  Beef,
  Anchor,
  ChefHat,
  Zap,
  Code,
  TrendingUp,
  FileText,
  Lightbulb,
  ChevronDown,
  Tablet,
  Heart,
  Crown,
  Brain,
  Receipt,
} from "lucide-react"
import { useState } from "react"
// import { UniversalSearchDialog } from "@/components/universal-search-dialog" // Assuming UniversalSearchDialog is in a separate file

const Building = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="3" y1="9" x2="21" y2="9"></line>
    <line x1="9" y1="21" x2="9" y2="9"></line>
    <line x1="15" y1="21" x2="15" y2="9"></line>
  </svg>
)

const navigationGroups = [
  {
    label: "Core Operations",
    description: "Manage your property bookings and reservations",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, tip: "Overview of your property" },
      { name: "Bookings", href: "/bookings", icon: Calendar, tip: "Manage reservations and availability" },
      { name: "Invoices", href: "/bookings/invoices", icon: Receipt, tip: "Manage invoices and payments" },
      { name: "Tasks", href: "/tasks", icon: ClipboardList, tip: "Daily management tasks" },
    ],
  },
  {
    label: "Sovereignty",
    description: "Track facility independence and self-sufficiency",
    items: [
      { name: "Dashboard", href: "/sovereignty", icon: Crown, tip: "Track facility autonomy and independence" },
      { name: "Coach", href: "/sovereignty/coach", icon: Brain, tip: "AI advisor for achieving independence" },
      { name: "Layers", href: "/sovereignty/layers", icon: TrendingUp, tip: "View 5-layer sovereignty pyramid" },
    ],
  },
  {
    label: "Cattle Operations",
    description: "Livestock management and breeding operations",
    items: [
      { name: "Dashboard", href: "/cattle", icon: Beef, tip: "Cattle areas and pasture management" },
      { name: "Expert Coach", href: "/cattle/expert-agent", icon: Brain, tip: "AI advisor for cattle business" },
      { name: "Business Plan", href: "/cattle/business-plan", icon: TrendingUp, tip: "Financial projections" },
      { name: "Pricing & Costs", href: "/cattle/pricing-costs", icon: Box, tip: "Cost analysis and pricing" },
    ],
  },
  {
    label: "Property Management",
    description: "Configure and maintain your facility",
    items: [
      { name: "Assets", href: "/assets", icon: Box, tip: "Inventory and equipment" },
      {
        name: "Inventory",
        href: "/inventory",
        icon: Box,
        tip: "Multimedia inventory tracking and QR codes",
        subItems: [
          { name: "All Assets", href: "/inventory", icon: "📦" },
          { name: "By Category", href: "/inventory/by-category", icon: "🏷️" },
          { name: "By Cost Center", href: "/inventory/by-cost-center", icon: "💼" },
          { name: "Categories", href: "/inventory/categories", icon: "⚙️" },
          { name: "Cost Centers", href: "/inventory/cost-centers", icon: "🏢" },
        ],
      },
      { name: "Maintenance", href: "/maintenance", icon: Wrench, tip: "Schedule and track repairs" },
      { name: "GIS Map", href: "/map", icon: Map, tip: "Property location and layout" },
      { name: "KMZ Viewer", href: "/map/kmz-viewer", icon: Map, tip: "Upload and view KMZ overlays" },
      { name: "Ports & Boats", href: "/ports-boats", icon: Anchor, tip: "Manage port facilities and boat fleet" },
    ],
  },
  {
    label: "Off Grid Energy",
    description: "Solar panels, batteries, and Victron monitoring",
    items: [
      { name: "Management", href: "/energy", icon: Zap, tip: "Solar panels and electricity consumption" },
      { name: "Dashboard", href: "/energy-dashboard", icon: TrendingUp, tip: "Real-time energy monitoring" },
      { name: "Reports", href: "/energy-reports", icon: FileText, tip: "Historical reports and analytics" },
      { name: "Victron Setup", href: "/victron-setup", icon: Lightbulb, tip: "Victron integration guide" },
      {
        name: "Integration Docs",
        href: "/integration-docs",
        icon: Code,
        tip: "MQTT, Node-RED, and VRM API documentation",
      },
    ],
  },
  {
    label: "Supply Chain",
    description: "Procurement, suppliers, and acquisitions",
    items: [
      { name: "Procurement", href: "/procurement", icon: Box, tip: "Purchase orders and acquisitions" },
      {
        name: "Suppliers",
        href: "/procurement/suppliers",
        icon: Users,
        tip: "Manage supplier contacts and relationships",
      },
      {
        name: "Analytics",
        href: "/procurement/analytics",
        icon: TrendingUp,
        tip: "Spending analysis and supplier performance",
      },
      {
        name: "Facilities",
        href: "/procurement/facilities",
        icon: Building,
        tip: "Manage facilities and their procurement needs",
      },
    ],
  },
  {
    label: "People & Operations",
    description: "Staff management and guest services",
    items: [
      { name: "Employees", href: "/employees", icon: Users, tip: "Team management" },
      { name: "Volunteers", href: "/volunteers", icon: Heart, tip: "Volunteer coordination and tracking" },
      { name: "Concierge", href: "/concierge", icon: MessageSquare, tip: "Guest communication" },
      {
        name: "Guest Requests",
        href: "/guest-requests",
        icon: Tablet,
        tip: "Tablet interface for hospitality requests",
      },
      { name: "Kitchen", href: "/kitchen", icon: ChefHat, tip: "Kitchen and food preparation facilities" },
      { name: "Checklists", href: "/checklists", icon: CheckSquare, tip: "Operational checklists" },
    ],
  },
  {
    label: "Advanced",
    description: "Analytics and system settings",
    items: [
      {
        name: "Facility Requests",
        href: "/issues",
        icon: AlertCircle,
        tip: "Track facility requests and service tickets",
      },
      { name: "AI Operations", href: "/ai-ops", icon: Bot, tip: "AI-powered insights" },
      { name: "Admin", href: "/admin", icon: Settings, tip: "System configuration" },
    ],
  },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

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
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-secondary bg-white transition-transform duration-300 lg:relative lg:translate-x-0 overflow-hidden",
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

        <nav className="flex-1 space-y-3 sm:space-y-4 px-2 sm:px-3 py-3 sm:py-4 overflow-y-auto">
          {navigationGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <div className="flex-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{group.label}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-tight hidden sm:block">{group.description}</p>
                </div>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                  aria-label={`Toggle ${group.label}`}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-gray-600 transition-transform duration-200",
                      expandedGroups.has(group.label) ? "rotate-0" : "-rotate-90",
                    )}
                  />
                </button>
              </div>
              {expandedGroups.has(group.label) && (
                <div className="space-y-1">
                  {group.items.map((item: any) => {
                    const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
                    const hasSubItems = item.subItems && item.subItems.length > 0
                    const isExpanded = expandedItems.has(item.name)

                    return (
                      <div key={item.name}>
                        <div className="flex items-center gap-0">
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                              "group flex-1 flex items-center gap-2 sm:gap-3 rounded px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-all duration-200",
                              isActive
                                ? "bg-primary text-white shadow-md"
                                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                            )}
                            title={item.tip}
                          >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            <span className="flex-1">{item.name}</span>
                            {isActive && <div className="h-2 w-2 rounded-full bg-white flex-shrink-0"></div>}
                          </Link>
                          {hasSubItems && (
                            <button
                              onClick={() => toggleSubItems(item.name)}
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
                          <div className="ml-4 space-y-1 mt-1 border-l-2 border-gray-200 pl-2">
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
                                  <span>{subItem.name}</span>
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
