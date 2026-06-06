'use client'

import { createContext, useContext } from 'react'

export interface LanguageContextType {
  language: 'en' | 'es'
  setLanguage: (lang: 'en' | 'es') => void
  t: (key: string) => string
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
