"use client"

import type React from "react"
import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { Sidebar } from "./sidebar"
import { OrchardSidebar } from "@/components/orchard/orchard-sidebar"
import { OrchardDesktopHeader } from "@/components/orchard/orchard-desktop-header"
import { OrchardHarvestSectionNav } from "@/components/orchard/harvest-section-nav"
import { BookingsSectionNav } from "@/components/bookings-section-nav"
import { HospitalityCommandStrip } from "@/components/hospitality-command-strip"
import { ObjectCommandPalette } from "./object-command-palette"
import { Menu, ArrowLeft, Bot, LogOut, MessageSquare } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"
import { buildOsRouteContext } from "@/lib/os/route-context"

interface AppLayoutProps {
  children: React.ReactNode
}

const mobileCopy = {
  es: {
    openNavigation: "Abrir navegación",
    back: "Volver",
    logout: "Cerrar sesión",
  },
  en: {
    openNavigation: "Open navigation",
    back: "Back",
    logout: "Sign out",
  },
  de: {
    openNavigation: "Navigation öffnen",
    back: "Zurück",
    logout: "Abmelden",
  },
} as const

function contextualHref(locale: string, target: string, pathname: string) {
  const context = buildOsRouteContext(pathname)
  const params = new URLSearchParams({ from: pathname })
  if (context.area) params.set("area", context.area)
  return `/${locale}${target}?${params.toString()}`
}

function isOrchardPath(pathname:string){
  return /^\/(?:en|es|de)\/orchard(?:\/|$)/.test(pathname) || /^\/orchard(?:\/|$)/.test(pathname)
}

function isBookingsPath(pathname:string){
  return /^\/(?:en|es|de)\/bookings(?:\/|$)/.test(pathname) || /^\/bookings(?:\/|$)/.test(pathname)
}

function isBookingsRoot(pathname:string){
  return /^\/(?:en|es|de)\/bookings\/?$/.test(pathname) || /^\/bookings\/?$/.test(pathname)
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userInitials, setUserInitials] = useState<string>("")
  const router = useRouter()
  const pathname = usePathname() || "/"
  const { language, t } = useLanguage()
  const mobileText = mobileCopy[language as keyof typeof mobileCopy] ?? mobileCopy.en
  const { access, can, canAccessDepartment } = useEffectiveAccess()
  const supabase = useMemo(() => createClient(), [])
  const orchardShell = isOrchardPath(pathname)
  const bookingsShell = isBookingsPath(pathname)
  const bookingsRoot = isBookingsRoot(pathname)

  useEffect(() => {
    let cancelled = false
    async function loadUser() {
      const result = await supabase.auth.getUser()
      const user = result.data.user
      if (cancelled || !user?.email) return
      const parts = user.user_metadata?.full_name?.split(" ") ?? user.email.split("@")[0].split(".")
      setUserInitials(parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join(""))
    }
    void loadUser()
    return () => { cancelled = true }
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push(`/${language}/auth/login`)
  }

  const isOpen = sidebarOpen
  const onClose = () => setSidebarOpen(false)
  const sidebarSurface = "[&>div]:!border-sidebar-border [&>div]:!bg-sidebar"
  const desktopSidebarClasses = orchardShell
    ? "md:sticky md:top-0 md:z-40 md:flex md:h-screen md:w-64 md:flex-col"
    : "lg:sticky lg:top-0 lg:z-40 lg:flex lg:h-screen lg:w-64 lg:flex-col"
  const mobileOnlyClass = orchardShell ? "md:hidden" : "lg:hidden"
  const showConcierge = !orchardShell && can("hospitality.operate") && canAccessDepartment("hospitality")
  const showGlobalAiOps = !orchardShell && access.is_admin
  const conciergeHref = contextualHref(language, "/concierge", pathname)
  const aiHref = contextualHref(language, "/ai-ops", pathname)
  const DesktopSidebar = orchardShell ? OrchardSidebar : Sidebar
  const MobileSidebar = orchardShell ? OrchardSidebar : Sidebar

  return (
    <div className="flex h-screen w-full bg-background">
      <ObjectCommandPalette access={access} canAccessDepartment={canAccessDepartment} />

      <div className={`brand-sidebar-shell hidden flex-shrink-0 ${desktopSidebarClasses} ${sidebarSurface}`}>
        <DesktopSidebar isOpen={true} onClose={() => {}} />
      </div>

      {isOpen && <div className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm ${mobileOnlyClass}`} onClick={onClose} />}
      {isOpen && (
        <div className={`brand-sidebar-shell fixed inset-y-0 left-0 z-50 w-64 ${mobileOnlyClass} ${sidebarSurface}`}>
          <MobileSidebar isOpen={isOpen} onClose={onClose} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {orchardShell ? <OrchardDesktopHeader /> : null}
        <div className={`sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-sidebar px-3 sm:h-16 sm:px-4 ${mobileOnlyClass}`}>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              aria-label={mobileText.openNavigation}
              title={mobileText.openNavigation}
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => router.back()}
              className="rounded-md p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              aria-label={mobileText.back}
              title={mobileText.back}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center gap-2">
            <img src="/blackswan-logo.png" alt="Blackswan Logo" className="h-7 w-7 object-contain" />
            <span className="text-xs font-semibold tracking-[0.12em] text-sidebar-foreground sm:text-sm">{orchardShell ? "ORCHARD" : "BSFC"}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            aria-label={mobileText.logout}
            title={mobileText.logout}
          >
            {userInitials && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{userInitials}</span>}
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-background overflow-x-hidden">
          {orchardShell && <OrchardHarvestSectionNav />}
          {bookingsShell && <BookingsSectionNav />}
          {bookingsRoot && <HospitalityCommandStrip />}
          {children}
          {(showConcierge || showGlobalAiOps) && <div className="fixed bottom-4 right-4 z-30 flex items-center">
            {showConcierge ? (
              <Link href={conciergeHref} className="inline-flex h-11 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium shadow-sm hover:bg-muted"><MessageSquare className="h-4 w-4" />{t("shell.concierge")}</Link>
            ) : showGlobalAiOps ? (
              <Link href={aiHref} className="inline-flex h-11 w-11 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted" aria-label={t("shell.ai_ops")} title={t("shell.ai_ops")}><Bot className="h-4 w-4" /></Link>
            ) : null}
          </div>}
        </main>
      </div>
    </div>
  )
}
