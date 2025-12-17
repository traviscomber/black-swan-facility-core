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
} from "lucide-react"

const navigationGroups = [
  {
    label: "Core Operations",
    description: "Manage your property bookings and reservations",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, tip: "Overview of your property" },
      { name: "Bookings", href: "/bookings", icon: Calendar, tip: "Manage reservations and availability" },
      { name: "Tasks", href: "/tasks", icon: ClipboardList, tip: "Daily management tasks" },
    ],
  },
  {
    label: "Property Management",
    description: "Configure and maintain your facility",
    items: [
      { name: "Assets", href: "/assets", icon: Box, tip: "Inventory and equipment" },
      { name: "Maintenance", href: "/maintenance", icon: Wrench, tip: "Schedule and track repairs" },
      { name: "GIS Map", href: "/map", icon: Map, tip: "Property location and layout" },
      { name: "Cattle", href: "/cattle", icon: Beef, tip: "Livestock and pasture management" },
    ],
  },
  {
    label: "Supply Chain",
    description: "Procurement, suppliers, and acquisitions",
    items: [{ name: "Procurement", href: "/procurement", icon: Box, tip: "Purchase orders and acquisitions" }],
  },
  {
    label: "People & Operations",
    description: "Staff management and guest services",
    items: [
      { name: "Employees", href: "/employees", icon: Users, tip: "Team management" },
      { name: "Concierge", href: "/concierge", icon: MessageSquare, tip: "Guest communication" },
      { name: "Checklists", href: "/checklists", icon: CheckSquare, tip: "Operational checklists" },
    ],
  },
  {
    label: "Advanced",
    description: "Analytics and system settings",
    items: [
      { name: "Issues", href: "/issues", icon: AlertCircle, tip: "Track and resolve problems" },
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

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={onClose} />}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-secondary bg-white transition-transform duration-300 md:relative md:translate-x-0 overflow-hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-secondary bg-gradient-to-r from-primary/10 to-transparent px-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/blackswan-logo.png" alt="Blackswan Logo" className="h-14 w-14 object-contain flex-shrink-0" />
            <div>
              <h1 className="text-base font-bold text-accent">BFCS</h1>
              <p className="text-xs text-gray-600">Core System</p>
            </div>
          </Link>
          <button onClick={onClose} className="md:hidden p-1 hover:bg-secondary rounded">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
          {navigationGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="px-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{group.label}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-tight">{group.description}</p>
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-all duration-200",
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
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-secondary bg-secondary/20 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <HelpCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Need Help?</p>
              <p className="text-xs text-gray-600 mt-1">Press ⌘K to search</p>
            </div>
          </div>
          <div className="pt-2 border-t border-secondary/50">
            <p className="text-xs text-gray-500">BFCS v1.0</p>
          </div>
        </div>
      </div>
    </>
  )
}
