import type React from 'react'
import { Toaster } from 'sonner'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {children}
      <Toaster richColors position="top-center" />
    </div>
  )
}
