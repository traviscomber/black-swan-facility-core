'use client'

import { createContext, useContext } from 'react'
import type { Language } from '../language-context'

export type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    // Return a default implementation if context is not available
    return {
      language: 'en' as const,
      setLanguage: () => {},
      t: (key: string) => key,
    }
  }
  return context
}
