"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Activity,
  Calculator,
  CalendarDays,
  CalendarOff,
  CreditCard,
  FileText,
  Home,
  MapPin,
  PackagePlus,
  Percent,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/lib/hooks/use-language"

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useLanguage()

  const activeTab =
    pathname === "/bookings"
      ? "calendar"
      : pathname?.includes("/activities")
        ? "activities"
        : pathname?.includes("/housekeeping")
          ? "housekeeping"
          : pathname?.includes("/blocks")
            ? "blocks"
            : pathname?.includes("/quotes")
              ? "quotes"
              : pathname?.includes("/rates")
                ? "rates"
                : pathname?.includes("/extras")
                  ? "extras"
                  : pathname?.includes("/charges")
                    ? "charges"
                    : pathname?.includes("/audit")
                      ? "audit"
                      : pathname?.includes("/guests")
                        ? "guests"
                        : pathname?.includes("/payments")
                          ? "payments"
                          : pathname?.includes("/invoices")
                            ? "invoices"
                            : pathname?.includes("/reports")
                              ? "reports"
                              : pathname?.includes("/rooms")
                                ? "rooms"
                                : pathname?.includes("/facilities")
                                  ? "facilities"
                                  : "calendar"

  function handleTabChange(value: string) {
    const routes: Record<string, string> = {
      calendar: "/bookings",
      activities: "/bookings/activities",
      housekeeping: "/bookings/housekeeping",
      blocks: "/bookings/blocks",
      quotes: "/bookings/quotes",
      rates: "/bookings/rates",
      extras: "/bookings/extras",
      charges: "/bookings/charges",
      audit: "/bookings/audit",
      guests: "/bookings/guests",
      payments: "/bookings/payments",
      invoices: "/bookings/invoices",
      reports: "/bookings/reports",
      rooms: "/bookings/rooms",
      facilities: "/bookings/facilities",
    }

    const route = routes[value]
    if (route) router.push(route)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-40 border-b bg-card/95 px-4 py-3 backdrop-blur md:px-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
            <TabsTrigger value="calendar" className="shrink-0 gap-2">
              <CalendarDays className="h-4 w-4" />
              {t("bookings.calendar")}
            </TabsTrigger>
            <TabsTrigger value="activities" className="shrink-0 gap-2">
              <Activity className="h-4 w-4" />
              Operaciones
            </TabsTrigger>
            <TabsTrigger value="housekeeping" className="shrink-0 gap-2">
              <Sparkles className="h-4 w-4" />
              Housekeeping
            </TabsTrigger>
            <TabsTrigger value="blocks" className="shrink-0 gap-2">
              <CalendarOff className="h-4 w-4" />
              Bloqueos
            </TabsTrigger>
            <TabsTrigger value="quotes" className="shrink-0 gap-2">
              <Calculator className="h-4 w-4" />
              Cotizador
            </TabsTrigger>
            <TabsTrigger value="rates" className="shrink-0 gap-2">
              <Percent className="h-4 w-4" />
              Tarifas
            </TabsTrigger>
            <TabsTrigger value="extras" className="shrink-0 gap-2">
              <PackagePlus className="h-4 w-4" />
              Extras
            </TabsTrigger>
            <TabsTrigger value="charges" className="shrink-0 gap-2">
              <ReceiptText className="h-4 w-4" />
              Cargos
            </TabsTrigger>
            <TabsTrigger value="audit" className="shrink-0 gap-2">
              <ShieldCheck className="h-4 w-4" />
              Auditoría
            </TabsTrigger>
            <TabsTrigger value="guests" className="shrink-0 gap-2">
              <Users className="h-4 w-4" />
              {t("bookings.guests")}
            </TabsTrigger>
            <TabsTrigger value="payments" className="shrink-0 gap-2">
              <CreditCard className="h-4 w-4" />
              Pagos
            </TabsTrigger>
            <TabsTrigger value="invoices" className="shrink-0 gap-2">
              <FileText className="h-4 w-4" />
              Facturas
            </TabsTrigger>
            <TabsTrigger value="facilities" className="shrink-0 gap-2">
              <MapPin className="h-4 w-4" />
              {t("bookings.facilities")}
            </TabsTrigger>
            <TabsTrigger value="rooms" className="shrink-0 gap-2">
              <Home className="h-4 w-4" />
              {t("bookings.rooms")}
            </TabsTrigger>
            <TabsTrigger value="reports" className="shrink-0 gap-2">
              <TrendingUp className="h-4 w-4" />
              {t("bookings.reports")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
