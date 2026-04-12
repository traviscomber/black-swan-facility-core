'use client'

import React, { useEffect } from "react"

import { UniversalSearch } from "@/components/universal-search"
import { LanguageProvider } from "@/lib/language-provider"

export function ClientProviders({ children }: { children?: React.ReactNode } = {}) {
  useEffect(() => {
    // Handle unhandled promise rejections that may come from browser extensions
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const reasonStr = reason?.toString?.() ?? String(reason)
      const messageStr = reason?.message?.toString?.() ?? ''
      
      // Suppress MetaMask and other extension-related errors
      if (
        reasonStr.includes('MetaMask') ||
        reasonStr.includes('Failed to connect') ||
        reasonStr.includes('ethereum') ||
        messageStr.includes('MetaMask') ||
        messageStr.includes('Failed to connect') ||
        messageStr.includes('ethereum')
      ) {
        event.preventDefault()
        // Silently suppress extension errors, don't log them
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
