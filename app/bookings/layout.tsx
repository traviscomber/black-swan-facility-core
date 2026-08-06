"use client"

import type React from "react"
import type { ElementType } from "react"
import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Activity, Calculator, CalendarDays, CalendarOff, CreditCard, FileText, FolderLock, Home, MapPin, PackagePlus, Percent, ReceiptText, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react"
import { AccessGate } from "@/components/access/access-gate"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"

type BookingTab = {
  value: string
  route: string
  label: string
  icon: ElementType
  action?: string
  department?: string
  adminOnly?: boolean
  roles?: string[]
}

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useLanguage()
  const { access, loading, can, canAccessDepartment } = useEffectiveAccess()

  const tabs = useMemo<BookingTab[]>(() => [
    { value: "calendar", route: "/bookings", label: t("bookings.calendar"), icon: CalendarDays, action: "booking.modify", department: "booking" },
    { value: "activities", route: "/bookings/activities", label: "Operaciones", icon: Activity, action: "activities.operate", department: "activities" },
    { value: "housekeeping", route: "/bookings/housekeeping", label: "Housekeeping", icon: Sparkles, action: "housekeeping.operate", department: "housekeeping" },
    { value: "blocks", route: "/bookings/blocks", label: "Bloqueos", icon: CalendarOff, action: "booking.modify", department: "booking" },
    { value: "quotes", route: "/bookings/quotes", label: "Cotizador", icon: Calculator, action: "booking.modify", department: "booking" },
    { value: "rates", route: "/bookings/rates", label: "Tarifas", icon: Percent, action: "booking.modify", department: "booking" },
    { value: "extras", route: "/bookings/extras", label: "Extras", icon: PackagePlus, action: "services.operate", department: "services" },
    { value: "charges", route: "/bookings/charges", label: "Cargos", icon: ReceiptText, action: "payments.record", department: "finance" },
    { value: "documents", route: "/bookings/documents", label: "Documentos", icon: FolderLock, action: "booking.modify", department: "booking", roles: ["approver"] },
    { value: "audit", route: "/bookings/audit", label: "Auditoría", icon: ShieldCheck, adminOnly: true },
    { value: "guests", route: "/bookings/guests", label: t("bookings.guests"), icon: Users, action: "booking.modify", department: "booking" },
    { value: "payments", route: "/bookings/payments", label: "Pagos", icon: CreditCard, action: "payments.record", department: "finance" },
    { value: "invoices", route: "/bookings/invoices", label: "Facturas", icon: FileText, action: "payments.record", department: "finance" },
    { value: "facilities", route: "/bookings/facilities", label: t("bookings.facilities"), icon: MapPin, action: "booking.modify", department: "booking" },
    { value: "rooms", route: "/bookings/rooms", label: t("bookings.rooms"), icon: Home, action: "booking.modify", department: "booking" },
    { value: "reports", route: "/bookings/reports", label: t("bookings.reports"), icon: TrendingUp, action: "booking.modify", department: "booking" },
  ], [t])

  const visibleTabs = tabs.filter((tab) => {
    if (tab.adminOnly) return access.is_admin
    if (tab.roles && !access.is_admin && !tab.roles.includes(access.role)) return false
    if (tab.action && !can(tab.action)) return false
    if (tab.department && !canAccessDepartment(tab.department)) return false
    return true
  })

  const activeTab = [...visibleTabs].sort((a, b) => b.route.length - a.route.length).find((tab) => pathname === tab.route || (tab.route !== "/bookings" && pathname?.startsWith(tab.route)))?.value ?? "calendar"

  // The harness page is server-gated by E2E_CALENDAR_HARNESS and must render
  // without authentication, navigation, or access-provider side effects.
  if (pathname === "/bookings/e2e-harness") return <>{children}</>

  return (
    <AccessGate action="booking.modify" department="booking">
      <div className="flex min-h-screen flex-col bg-background">
        <div className="sticky top-0 z-40 border-b bg-card/95 px-4 py-3 backdrop-blur md:px-6">
          <Tabs value={activeTab} onValueChange={(value) => {
            const route = visibleTabs.find((tab) => tab.value === value)?.route
            if (route) router.push(route)
          }}>
            <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
              {!loading && visibleTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 gap-2">
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </AccessGate>
  )
}
