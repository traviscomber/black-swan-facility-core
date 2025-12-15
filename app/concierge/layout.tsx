"use client"

import type React from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter, usePathname } from "next/navigation"
import { LayoutDashboard, Users, MessageSquare, AlertTriangle } from "lucide-react"
import { AppLayout } from "@/components/app-layout"

export default function ConciergeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Determine active tab based on pathname
  const activeTab =
    pathname === "/concierge"
      ? "dashboard"
      : pathname?.includes("/leads")
        ? "leads"
        : pathname?.includes("/messages")
          ? "messages"
          : pathname?.includes("/incidents")
            ? "incidents"
            : "dashboard"

  function handleTabChange(value: string) {
    switch (value) {
      case "dashboard":
        router.push("/concierge")
        break
      case "leads":
        router.push("/concierge/leads")
        break
      case "messages":
        router.push("/concierge/messages")
        break
      case "incidents":
        router.push("/concierge/incidents")
        break
    }
  }

  return (
    <AppLayout>
      <div className="flex h-screen flex-col">
        {/* Sub-navigation tabs */}
        <div className="border-b bg-card px-6 py-3">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="leads" className="gap-2">
                <Users className="h-4 w-4" />
                Leads
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="incidents" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Incidents
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
    </AppLayout>
  )
}
