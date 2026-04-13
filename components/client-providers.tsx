'use client'

import React, { useEffect } from "react"

import { UniversalSearch } from "@/components/universal-search"
import { LanguageProvider } from "@/lib/language-provider"

export function ClientProviders({ children }: { children?: React.ReactNode } = {}) {
  useEffect(() => {
    // Handle unhandled promise rejections (e.g., MetaMask connection errors)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Suppress known non-critical errors
      if (event.reason?.message?.includes('Failed to connect to MetaMask') || 
          event.reason?.includes('Failed to connect to MetaMask')) {
        console.debug('[v0] Suppressed MetaMask connection error - MetaMask not available')
        event.preventDefault()
        return
      }
      // Allow other errors to be handled normally
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [])

  return (
    <LanguageProvider>
      <UniversalSearch />
      {children}
    </LanguageProvider>
  )
}
