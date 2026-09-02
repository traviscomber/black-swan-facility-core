'use client'

import React, { useEffect } from "react"
import { Toaster } from "sonner"
import { LanguageProvider } from "@/lib/language-provider"

export function ClientProviders({ children }: { children?: React.ReactNode } = {}) {
  useEffect(() => {
    const root = document.documentElement

    const enforceDarkTheme = () => {
      if (!root.classList.contains("dark")) root.classList.add("dark")
      if (root.dataset.theme !== "dark") root.dataset.theme = "dark"
      if (root.style.colorScheme !== "dark") root.style.colorScheme = "dark"
      if (root.style.backgroundColor !== "rgb(23, 21, 18)" && root.style.backgroundColor !== "#171512") {
        root.style.backgroundColor = "#171512"
      }
    }

    enforceDarkTheme()
    const themeObserver = new MutationObserver(enforceDarkTheme)
    themeObserver.observe(root, { attributes: true, attributeFilter: ["class", "style", "data-theme"] })

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
    return () => {
      themeObserver.disconnect()
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return (
    <LanguageProvider>
      {children}
      <Toaster theme="dark" />
    </LanguageProvider>
  )
}
