"use client"

import type { ElementType } from "react"
import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Activity, AlertTriangle, Calculator, CalendarDays, CalendarOff, ClipboardList, CreditCard, FileText, FolderLock, Home, MapPin, PackagePlus, Percent, ReceiptText, ShieldCheck, Sparkles, Tablet, TrendingUp, Users } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"
import { bookingsTranslations } from "@/lib/translations/bookings"

type BookingTab = { value: string; route: string; label: string; icon: ElementType; action?: string; department?: string; adminOnly?: boolean; roles?: string[] }
const ROUTE_LOCALES = new Set(["en", "es", "de"])

function stripLocale(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (ROUTE_LOCALES.has(segments[0])) segments.shift()
  return `/${segments.join("/")}` || "/"
}

function localizeRoute(route: string, language: "en" | "es" | "de") {
  return `/${language}${route === "/" ? "" : route}`
}

export function BookingsSectionNav() {
  const router = useRouter()
  const pathname = usePathname() || "/"
  const { language } = useLanguage()
  const copy = bookingsTranslations[language]
  const exceptionsLabel = { en: "Exceptions", es: "Excepciones", de: "Ausnahmen" }[language]
  const { access, loading, can, canAccessDepartment } = useEffectiveAccess()
  const internalPathname = stripLocale(pathname)

  const tabs = useMemo<BookingTab[]>(() => [
    { value: "calendar", route: "/bookings", label: copy.calendar, icon: CalendarDays, action: "booking.modify", department: "booking" },
    { value: "exceptions", route: "/bookings/exceptions", label: exceptionsLabel, icon: AlertTriangle, action: "booking.modify", department: "booking" },
    { value: "activities", route: "/bookings/activities", label: copy.operations, icon: Activity, action: "activities.operate", department: "activities" },
    { value: "housekeeping", route: "/bookings/housekeeping", label: copy.housekeeping, icon: Sparkles, action: "housekeeping.operate", department: "housekeeping" },
    { value: "requests", route: "/bookings/requests", label: copy.requests, icon: Tablet, action: "hospitality.operate", department: "hospitality" },
    { value: "handovers", route: "/bookings/handovers", label: copy.handovers, icon: ClipboardList, action: "booking.modify", department: "booking" },
    { value: "blocks", route: "/bookings/blocks", label: copy.blocks, icon: CalendarOff, action: "booking.modify", department: "booking" },
    { value: "quotes", route: "/bookings/quotes", label: copy.quotes, icon: Calculator, action: "booking.modify", department: "booking" },
    { value: "rates", route: "/bookings/rates", label: copy.rates, icon: Percent, action: "booking.modify", department: "booking" },
    { value: "extras", route: "/bookings/extras", label: copy.extras, icon: PackagePlus, action: "services.operate", department: "services" },
    { value: "charges", route: "/bookings/charges", label: copy.charges, icon: ReceiptText, action: "finance.record_payment", department: "finance" },
    { value: "documents", route: "/bookings/documents", label: copy.documents, icon: FolderLock, action: "booking.modify", department: "booking", roles: ["approver"] },
    { value: "audit", route: "/bookings/audit", label: copy.audit, icon: ShieldCheck, adminOnly: true },
    { value: "guests", route: "/bookings/guests", label: copy.guests, icon: Users, action: "booking.modify", department: "booking" },
    { value: "payments", route: "/bookings/payments", label: copy.payments, icon: CreditCard, action: "finance.record_payment", department: "finance" },
    { value: "invoices", route: "/bookings/invoices", label: copy.invoices, icon: FileText, action: "finance.record_payment", department: "finance" },
    { value: "facilities", route: "/bookings/facilities", label: copy.facilities, icon: MapPin, action: "booking.modify", department: "booking" },
    { value: "rooms", route: "/bookings/rooms", label: copy.rooms, icon: Home, action: "booking.modify", department: "booking" },
    { value: "reports", route: "/bookings/reports", label: copy.reports, icon: TrendingUp, action: "booking.modify", department: "booking" },
  ], [copy, exceptionsLabel])

  if (internalPathname === "/bookings/e2e-harness") return null

  const visibleTabs = tabs.filter((tab) => {
    if (tab.adminOnly) return access.is_admin
    if (tab.roles && !access.is_admin && !tab.roles.includes(access.role)) return false
    if (tab.action && !can(tab.action)) return false
    if (tab.department && !canAccessDepartment(tab.department)) return false
    return true
  })

  const activeTab = [...visibleTabs]
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => internalPathname === tab.route || (tab.route !== "/bookings" && internalPathname.startsWith(tab.route)))?.value ?? "calendar"

  return (
    <nav aria-label={copy.calendar} className="sticky top-0 z-30 border-b bg-card/95 px-3 py-2 backdrop-blur sm:px-4">
      <Tabs value={activeTab} onValueChange={(value) => {
        const route = visibleTabs.find((tab) => tab.value === value)?.route
        if (route) router.push(localizeRoute(route, language))
      }}>
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
          {!loading && visibleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 gap-2">
              <tab.icon className="h-4 w-4" />{tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  )
}
