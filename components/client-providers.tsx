'use client'

import { UniversalSearch } from "@/components/universal-search"
import { LanguageProvider } from "@/lib/language-context"

export function ClientProviders() {
  return (
    <LanguageProvider>
      <UniversalSearch />
    </LanguageProvider>
  )
}
