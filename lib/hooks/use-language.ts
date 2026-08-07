'use client'

import { createContext, useContext } from 'react'

export type Language = 'en' | 'es' | 'de'

export type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    return {
      language: 'en' as Language,
      setLanguage: (_lang: Language) => {},
      t: (key: string) => key,
    }
  }
  return context
}
