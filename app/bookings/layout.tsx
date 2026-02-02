"use client"

import type React from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter, usePathname } from "next/navigation"
import { Calendar, Users, TrendingUp, Home, MapPin } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useLanguage()

  const activeTab =
    pathname === "/bookings"
      ? "calendar"
      : pathname?.includes("/guests")
        ? "guests"
        : pathname?.includes("/reports")
          ? "reports"
          : pathname?.includes("/rooms")
            ? "rooms"
            : pathname?.includes("/facilities")
              ? "facilities"
              : "calendar"

  function handleTabChange(value: string) {
    switch (value) {
      case "calendar":
        router.push("/bookings")
        break
      case "guests":
        router.push("/bookings/guests")
        break
      case "reports":
        router.push("/bookings/reports")
        break
      case "rooms":
        router.push("/bookings/rooms")
        break
      case "facilities":
        router.push("/bookings/facilities")
        break
    }
  }

  return (
    <div className="flex flex-col">
      {/* Sub-navigation tabs */}
      <div className="border-b bg-card px-6 py-3">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              {t("bookings.calendar")}
            </TabsTrigger>
            <TabsTrigger value="facilities" className="gap-2">
              <MapPin className="h-4 w-4" />
              {t("bookings.facilities")}
            </TabsTrigger>
            <TabsTrigger value="rooms" className="gap-2">
              <Home className="h-4 w-4" />
              {t("bookings.rooms")}
            </TabsTrigger>
            <TabsTrigger value="guests" className="gap-2">
              <Users className="h-4 w-4" />
              {t("bookings.guests")}
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              {t("bookings.reports")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
