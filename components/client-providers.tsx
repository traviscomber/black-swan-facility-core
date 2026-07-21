'use client'

import React, { useEffect } from "react"
import { LanguageProvider } from "@/lib/language-provider"

export function ClientProviders({ children }: { children?: React.ReactNode } = {}) {
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('Failed to connect to MetaMask') || 
          event.reason?.includes('Failed to connect to MetaMask')) {
        console.debug('[v0] Suppressed MetaMask connection error')
        event.preventDefault()
        return
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [])

  return (
    <LanguageProvider>
      {children}
    </LanguageProvider>
  )
}
