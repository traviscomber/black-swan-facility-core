"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Map, Box, AlertCircle, Wrench, Users, CheckSquare, Settings, X } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "GIS Map", href: "/map", icon: Map },
  { name: "Assets", href: "/assets", icon: Box },
  { name: "Issues", href: "/issues", icon: AlertCircle },
  { name: "Maintenance", href: "/maintenance", icon: Wrench },
  { name: "Employees", href: "/employees", icon: Users },
  { name: "Checklists", href: "/checklists", icon: CheckSquare },
  { name: "Admin", href: "/admin", icon: Settings },
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
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo/Header */}
        <div className="flex h-14 items-center justify-between border-b border-gray-100 px-4">
          <h1 className="text-base font-semibold text-black">Black Swan</h1>
          <button onClick={onClose} className="md:hidden p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-700" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-2 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3">
          <p className="text-xs text-gray-400">Facility Core v1.0</p>
        </div>
      </div>
    </>
  )
}
