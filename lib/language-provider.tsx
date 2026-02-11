'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { LanguageContext, type Language } from './language-context-client'
import { translations } from './language-context'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('language') as Language | null
    if (saved && (saved === 'en' || saved === 'es')) {
      setLanguage(saved)
    }
    setMounted(true)
  }, [])

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('language', lang)
  }

  const t = (key: string): string => {
    const currentLang = translations[language]
    if (!currentLang) return key
    return (currentLang as Record<string, string>)[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
