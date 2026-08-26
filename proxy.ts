import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { hasCapability, normalizeCapabilitySnapshot, type CapabilityLevel } from "./lib/access/capabilities"

const LOCALES = ["en", "es", "de"] as const
const DEFAULT_LOCALE = "en"
const LOCALE_COOKIE = "site-locale"
const LOCALE_HEADER = "x-site-locale"

const PUBLIC_PAGE_PATHS = new Set(["/auth/login", "/guest-access"])
const PUBLIC_PAGE_PREFIXES = ["/event/"]
const PUBLIC_API_PREFIXES = ["/api/auth"]
const CALENDAR_E2E_PATH = "/bookings/e2e-harness"

type RouteLocale = (typeof LOCALES)[number]
type RouteAccess = {
  role_key?: string | null
  is_admin?: boolean
  can_approve_procurement?: boolean
  capabilities?: unknown
}

type RouteRequirement = { domain: string; required: CapabilityLevel }

function isRouteLocale(value: string | undefined): value is RouteLocale {
  return !!value && LOCALES.includes(value as RouteLocale)
}

function isPublicRequest(pathname: string, method: string) {
  if (PUBLIC_PAGE_PATHS.has(pathname)) return true
  if (PUBLIC_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true

  if (pathname === "/api/guest-access" && method === "GET") return true
  if (pathname === "/api/guest-access/request" && method === "POST") return true

  return false
}

function isCalendarE2EHarness(pathname: string) {
  return process.env.E2E_CALENDAR_HARNESS === "1" && pathname === CALENDAR_E2E_PATH
}

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/")
}

function isPathFamily(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`)
}

function isSafeInternalStartPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && value !== "/"
}

export function getRouteRequirement(pathname: string): RouteRequirement | null {
  if (isPathFamily(pathname, "/bookings/invoices")) return { domain: "finance", required: "view" }
  if (isPathFamily(pathname, "/bookings/requests")) return { domain: "operations", required: "view" }
  if (isPathFamily(pathname, "/bookings")) return { domain: "booking", required: "view" }
  if (isPathFamily(pathname, "/activities-calendar") || isPathFamily(pathname, "/tasks") || isPathFamily(pathname, "/checklists")) return { domain: "operations", required: "view" }
  if (isPathFamily(pathname, "/employees") || isPathFamily(pathname, "/os/people")) return { domain: "people", required: "view" }
  if (isPathFamily(pathname, "/map")) return { domain: "map", required: "view" }
  if (isPathFamily(pathname, "/admin")) return { domain: "admin", required: "admin" }
  if (isPathFamily(pathname, "/procurement/requests")) return { domain: "procurement", required: "view" }
  if (isPathFamily(pathname, "/procurement")) return { domain: "procurement", required: "approve" }
  return null
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

  if (isCalendarE2EHarness(pathname)) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(LOCALE_HEADER, "es")
    return setLocaleCookie(
      NextResponse.next({ request: { headers: requestHeaders } }),
      "es",
    )
  }

  const apiRequest = isApiRequest(pathname)

  let locale: RouteLocale | null = null
  let effectivePathname = pathname
  let rewriteUrl: URL | null = null

  if (!apiRequest) {
    const segments = pathname.split("/").filter(Boolean)
    if (segments[0] === "deu") {
      const legacyUrl = request.nextUrl.clone()
      const rest = segments.slice(1).join("/")
      legacyUrl.pathname = `/de${rest ? `/${rest}` : ""}`
      return setLocaleCookie(NextResponse.redirect(legacyUrl), "de")
    }

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
    const requestHeaders = new Headers(request.headers)
    if (locale) requestHeaders.set(LOCALE_HEADER, locale)

    const response = rewriteUrl
      ? NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
      : NextResponse.next({ request: { headers: requestHeaders } })

    return locale ? setLocaleCookie(response, locale) : response
  }

  if (isPublicRequest(effectivePathname, request.method)) {
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

  const { data: routeAccessData, error: routeAccessError } = await supabase.rpc(
    "get_current_route_access",
  )

  const routeAccess = (routeAccessData ?? {}) as RouteAccess
  const capabilitySnapshot = routeAccessError
    ? normalizeCapabilitySnapshot(null)
    : normalizeCapabilitySnapshot(routeAccess)

  if (!apiRequest && effectivePathname === "/") {
    const { data: osProfile } = await supabase
      .from("user_access_profiles")
      .select("os_start_path")
      .eq("user_id", user.id)
      .maybeSingle()

    const preferredStartPath = isSafeInternalStartPath(osProfile?.os_start_path)
      ? osProfile.os_start_path
      : "/os"
    const startRequirement = getRouteRequirement(preferredStartPath)
    const startAllowed = !startRequirement || hasCapability(
      capabilitySnapshot,
      startRequirement.domain,
      startRequirement.required,
    )
    const activeLocale = locale ?? DEFAULT_LOCALE

    return setLocaleCookie(
      NextResponse.redirect(localizedUrl(request, activeLocale, startAllowed ? preferredStartPath : "/os")),
      activeLocale,
    )
  }

  const requirement = getRouteRequirement(effectivePathname)

  if (effectivePathname === "/auth/login") {
    const activeLocale = locale ?? DEFAULT_LOCALE
    return setLocaleCookie(
      NextResponse.redirect(localizedUrl(request, activeLocale, "/")),
      activeLocale,
    )
  }

  if (requirement && !hasCapability(capabilitySnapshot, requirement.domain, requirement.required)) {
    if (apiRequest) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const activeLocale = locale ?? DEFAULT_LOCALE
    return setLocaleCookie(
      NextResponse.redirect(localizedUrl(request, activeLocale, "/")),
      activeLocale,
    )
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
}
