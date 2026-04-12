'use client'

import React, { useEffect } from "react"

import { UniversalSearch } from "@/components/universal-search"
import { LanguageProvider } from "@/lib/language-provider"

export function ClientProviders({ children }: { children?: React.ReactNode } = {}) {
  useEffect(() => {
    // Handle unhandled promise rejections that may come from browser extensions
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Log but suppress MetaMask and other extension-related errors
      if (
        event.reason?.message?.includes('MetaMask') ||
        event.reason?.message?.includes('Failed to connect') ||
        event.reason?.toString().includes('ethereum')
      ) {
        event.preventDefault()
        console.debug('[Extension Error]', event.reason)
      }
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
