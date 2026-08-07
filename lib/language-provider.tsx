'use client'

import { useEffect, useMemo, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { translations, type Language } from './language-context'
import { LanguageContext } from './hooks/use-language'

const ROUTE_LOCALES = ['en', 'es', 'deu'] as const

type RouteLocale = (typeof ROUTE_LOCALES)[number]

function isRouteLocale(value: string | undefined): value is RouteLocale {
  return !!value && ROUTE_LOCALES.includes(value as RouteLocale)
}

function getRouteLocale(pathname: string): RouteLocale {
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  return isRouteLocale(firstSegment) ? firstSegment : 'en'
}

function replaceLocalePrefix(pathname: string, locale: RouteLocale) {
  const segments = pathname.split('/').filter(Boolean)

  if (isRouteLocale(segments[0])) {
    segments[0] = locale
    return `/${segments.join('/')}`
  }

  return `/${locale}${pathname === '/' ? '' : pathname}`
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const routeLocale = useMemo(() => getRouteLocale(pathname), [pathname])

  // German has its own isolated URL space now. Until the German translation
  // catalogue is added, it intentionally falls back to the canonical English copy.
  const language: Language = routeLocale === 'es' ? 'es' : 'en'

  useEffect(() => {
    localStorage.setItem('language', routeLocale)
    document.cookie = `site-locale=${routeLocale}; path=/; samesite=lax`
    document.documentElement.lang = routeLocale === 'deu' ? 'de' : routeLocale
  }, [routeLocale])

  const handleSetLanguage = (lang: Language) => {
    const targetLocale: RouteLocale = lang
    localStorage.setItem('language', targetLocale)
    document.cookie = `site-locale=${targetLocale}; path=/; samesite=lax`
    router.push(replaceLocalePrefix(pathname, targetLocale))
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
