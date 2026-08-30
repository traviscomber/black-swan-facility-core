'use client'

import { useEffect, useMemo, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { translations } from './language-context'
import { deTranslations } from './translations/de'
import { shellTranslations } from './translations/shell'
import { installRuntimeTranslationBridge } from './translations/runtime-bridge'
import { LanguageContext, type Language } from './hooks/use-language'

const ROUTE_LOCALES = ['en', 'es', 'de'] as const

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
  const routeLocale = useMemo(() => getRouteLocale(pathname), [pathname])
  const language: Language = routeLocale

  useEffect(() => {
    localStorage.setItem('language', routeLocale)
    document.cookie = `site-locale=${routeLocale}; path=/; samesite=lax`
    document.documentElement.lang = routeLocale
    document.documentElement.dir = 'ltr'
  }, [routeLocale])

  useEffect(() => installRuntimeTranslationBridge(language), [language, pathname])

  const handleSetLanguage = (lang: Language) => {
    const nextPath = replaceLocalePrefix(pathname, lang)
    localStorage.setItem('language', lang)
    document.cookie = `site-locale=${lang}; path=/; samesite=lax`
    window.location.assign(nextPath)
  }

  const t = (key: string): string => {
    const shellValue = shellTranslations[language][key]
    if (shellValue) return shellValue

    if (language === 'de') {
      // Never leak English into /de. Missing German keys stay explicit so
      // Polyglot/CI can catch the gap instead of silently shipping mixed UI.
      return deTranslations[key] ?? key
    }

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
