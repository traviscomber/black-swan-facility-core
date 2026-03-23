"use client"

import type React from "react"
import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Menu, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

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
          <div className="w-10" />
        </div>

        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  )
}
