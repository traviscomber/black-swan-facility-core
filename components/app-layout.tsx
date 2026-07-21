"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Sidebar } from "./sidebar"
import { Menu, ArrowLeft, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userInitials, setUserInitials] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        const parts = user.user_metadata?.full_name?.split(' ') ?? user.email.split('@')[0].split('.')
        setUserInitials(parts.slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join(''))
      }
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isOpen = sidebarOpen
  const onClose = () => setSidebarOpen(false)

  return (
    <div className="flex h-screen bg-background w-full">
      {/* Desktop sidebar - sticky */}
      <div className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:z-40 lg:w-64 flex-shrink-0">
        <Sidebar isOpen={true} onClose={() => {}} />
      </div>

      {/* Mobile sidebar overlay */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={onClose} />}
      {isOpen && (
        <div className="fixed inset-0 z-50 w-64 lg:hidden">
          <Sidebar isOpen={isOpen} onClose={onClose} />
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden w-full">
        <div className="sticky top-0 z-40 flex h-14 sm:h-16 items-center justify-between border-b border-secondary bg-gradient-to-r from-secondary/50 to-transparent px-3 sm:px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5 text-accent" />
            </button>
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              title="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-accent" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-1 justify-center">
            <img src="/blackswan-logo.png" alt="Blackswan Logo" className="h-6 w-6 object-contain" />
            <span className="text-xs sm:text-sm font-bold text-accent">BFCS</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-secondary transition-colors"
            title="Cerrar sesión"
          >
            {userInitials && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                {userInitials}
              </span>
            )}
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  )
}
