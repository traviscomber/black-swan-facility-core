import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const LOCALES = ["en", "es", "de"] as const
const DEFAULT_LOCALE = "en"
const LOCALE_COOKIE = "site-locale"

const PUBLIC_PAGE_PATHS = new Set(["/auth/login"])
const PUBLIC_API_PREFIXES = ["/api/auth"]

type RouteLocale = (typeof LOCALES)[number]

function isRouteLocale(value: string | undefined): value is RouteLocale {
  return !!value && LOCALES.includes(value as RouteLocale)
}

function isPublicRequest(pathname: string) {
  if (PUBLIC_PAGE_PATHS.has(pathname)) return true
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isCalendarE2EHarness(pathname: string) {
  return process.env.E2E_CALENDAR_HARNESS === "1"
    && pathname === "/bookings/e2e-harness"
}

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/")
}

function isProcurementPath(pathname: string) {
  return pathname === "/procurement" || pathname.startsWith("/procurement/")
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

function getLocalizedPageRequest(request: NextRequest) {
  const { pathname } = request.nextUrl
  const segments = pathname.split("/").filter(Boolean)
  const locale = segments[0]

  if (!isRouteLocale(locale)) return null

  const internalPathname = `/${segments.slice(1).join("/")}`
  return {
    locale,
    internalPathname: internalPathname === "/" ? "/" : internalPathname,
  }
}

function localizedUrl(request: NextRequest, locale: RouteLocale, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`
  url.search = ""
  return url
}

function setLocaleCookie(response: NextResponse, locale: RouteLocale) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
  })
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const apiRequest = isApiRequest(pathname)

  let locale: RouteLocale | null = null
  let effectivePathname = pathname
  let rewriteUrl: URL | null = null

  if (!apiRequest) {
    const localized = getLocalizedPageRequest(request)

    if (!localized) {
      const savedLocale = request.cookies.get(LOCALE_COOKIE)?.value
      const legacyLocale = savedLocale === "deu" ? "de" : savedLocale
      const targetLocale = isRouteLocale(legacyLocale) ? legacyLocale : DEFAULT_LOCALE
      return NextResponse.redirect(localizedUrl(request, targetLocale, pathname))
    }

    locale = localized.locale
    effectivePathname = localized.internalPathname
    rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = effectivePathname
  }

  const createPageResponse = () => {
    const response = rewriteUrl
      ? NextResponse.rewrite(rewriteUrl, { request: { headers: request.headers } })
      : NextResponse.next({ request: { headers: request.headers } })

    return locale ? setLocaleCookie(response, locale) : response
  }

  if (isPublicRequest(effectivePathname) || isCalendarE2EHarness(effectivePathname)) {
    return createPageResponse()
  }

  let response = createPageResponse()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (apiRequest) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const activeLocale = locale ?? DEFAULT_LOCALE
    const loginUrl = localizedUrl(request, activeLocale, "/auth/login")
    loginUrl.searchParams.set("next", request.nextUrl.pathname)
    return setLocaleCookie(NextResponse.redirect(loginUrl), activeLocale)
  }

  const procurementRole = user.app_metadata?.procurement_role
  const isAdmin = procurementRole === "admin"
  const isApprover = procurementRole === "approver" || isAdmin

  if (effectivePathname === "/auth/login") {
    const activeLocale = locale ?? DEFAULT_LOCALE
    return setLocaleCookie(
      NextResponse.redirect(localizedUrl(request, activeLocale, "/")),
      activeLocale,
    )
  }

  if (isAdminPath(effectivePathname) && !isAdmin) {
    if (apiRequest) {
      return NextResponse.json({ error: "Administrator role required" }, { status: 403 })
    }

    const activeLocale = locale ?? DEFAULT_LOCALE
    return setLocaleCookie(
      NextResponse.redirect(localizedUrl(request, activeLocale, "/")),
      activeLocale,
    )
  }

  if (isProcurementPath(effectivePathname) && !isApprover) {
    if (!effectivePathname.startsWith("/procurement/requests")) {
      const activeLocale = locale ?? DEFAULT_LOCALE
      return setLocaleCookie(
        NextResponse.redirect(localizedUrl(request, activeLocale, "/procurement/requests")),
        activeLocale,
      )
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
}
