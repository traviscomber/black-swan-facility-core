'use client'

import React from "react"

import { UniversalSearch } from "@/components/universal-search"
import { LanguageProvider } from "@/lib/language-context"

export function ClientProviders({ children }: { children?: React.ReactNode } = {}) {
  return (
    <LanguageProvider>
      <UniversalSearch />
      {children}
    </LanguageProvider>
  )
}
