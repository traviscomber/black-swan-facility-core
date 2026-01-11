"use client"

import type React from "react"

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const inventoryItems = [
    { name: "All Assets", href: "/inventory", icon: "📦" },
    { name: "By Category", href: "/inventory/by-category", icon: "🏷️" },
    { name: "By Cost Center", href: "/inventory/by-cost-center", icon: "💼" },
    { name: "Categories", href: "/inventory/categories", icon: "🔧" },
    { name: "Cost Centers", href: "/inventory/cost-centers", icon: "🏢" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
