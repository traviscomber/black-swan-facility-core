"use client"

import type React from "react"

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col w-full">
      {/* Page content - no height constraints */}
      <div className="flex-1 w-full">{children}</div>
    </div>
  )
}
