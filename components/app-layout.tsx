"use client"

import type React from "react"
import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Menu } from "lucide-react"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-white">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-14 items-center justify-between border-b border-gray-100 px-4 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1 hover:bg-gray-100 rounded">
            <Menu className="h-5 w-5 text-gray-700" />
          </button>
          <h1 className="text-sm font-semibold text-black">Black Swan Facility Core</h1>
          <div className="w-6" /> {/* Spacer for centering */}
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
