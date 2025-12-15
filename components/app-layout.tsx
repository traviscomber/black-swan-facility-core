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
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b border-secondary bg-gradient-to-r from-secondary/50 to-transparent px-4 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <Menu className="h-5 w-5 text-accent" />
          </button>
          <h1 className="text-sm font-bold text-accent">Black Swan Facility</h1>
          <div className="w-10" />
        </div>

        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  )
}
