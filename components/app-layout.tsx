"use client"

import type React from "react"
import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { Sidebar } from "./sidebar"
import { Menu, ArrowLeft, Bot, LogOut, MessageSquare } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"
import { buildOsRouteContext } from "@/lib/os/route-context"

interface AppLayoutProps {
  children: React.ReactNode
}

function contextualHref(locale: string, target: string, pathname: string) {
  const context = buildOsRouteContext(pathname)
  const params = new URLSearchParams({ from: pathname })
  if (context.area) params.set("area", context.area)
  return `/${locale}${target}?${params.toString()}`
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userInitials, setUserInitials] = useState<string>("")
  const router = useRouter()
  const pathname = usePathname() || "/"
  const { language } = useLanguage()
  const { access, can, canAccessDepartment } = useEffectiveAccess()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        const parts = user.user_metadata?.full_name?.split(" ") ?? user.email.split("@")[0].split(".")
        setUserInitials(parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join(""))
      }
    })
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push(`/${language}/auth/login`)
  }

  const isOpen = sidebarOpen
  const onClose = () => setSidebarOpen(false)
  const sidebarSurface = "[&>div]:!border-sidebar-border [&>div]:!bg-sidebar"
  const showConcierge = can("hospitality.operate") && canAccessDepartment("hospitality")
  const conciergeHref = contextualHref(language, "/concierge", pathname)
  const aiHref = contextualHref(language, "/ai-ops", pathname)

  return (
    <div className="flex h-screen w-full bg-background">
      <div className={`brand-sidebar-shell hidden flex-shrink-0 lg:sticky lg:top-0 lg:z-40 lg:flex lg:h-screen lg:w-64 lg:flex-col ${sidebarSurface}`}>
        <Sidebar isOpen={true} onClose={() => {}} />
      </div>

      {isOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      {isOpen && (
        <div className={`brand-sidebar-shell fixed inset-y-0 left-0 z-50 w-64 lg:hidden ${sidebarSurface}`}>
          <Sidebar isOpen={isOpen} onClose={onClose} />
        </div>
      )}

      <div className="flex w-full flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-sidebar px-3 sm:h-16 sm:px-4 lg:hidden">
          <div className="flex items-center gap-1">
            <button onClick={() => setSidebarOpen(true)} className="rounded-md p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent" aria-label="Abrir navegación">
              <Menu className="h-5 w-5" />
            </button>
            <button onClick={() => router.back()} className="rounded-md p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent" title="Volver">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center gap-2">
            <img src="/blackswan-logo.png" alt="Blackswan Logo" className="h-7 w-7 object-contain" />
            <span className="text-xs font-semibold tracking-[0.12em] text-sidebar-foreground sm:text-sm">BFCS</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sidebar-foreground transition-colors hover:bg-sidebar-accent" title="Cerrar sesión">
            {userInitials && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{userInitials}</span>}
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <main className="relative min-h-0 flex-1 overflow-y-auto bg-background">
          {children}
          {(showConcierge || access.is_admin) && <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2">
            {showConcierge && <Link href={conciergeHref} className="inline-flex h-11 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium shadow-lg hover:bg-muted"><MessageSquare className="h-4 w-4" />Concierge</Link>}
            {access.is_admin && <Link href={aiHref} className="inline-flex h-11 w-11 items-center justify-center rounded-full border bg-background shadow-lg hover:bg-muted" aria-label="AI Ops"><Bot className="h-4 w-4" /></Link>}
          </div>}
        </main>
      </div>
    </div>
  )
}
