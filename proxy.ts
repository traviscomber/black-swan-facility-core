import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_PAGE_PATHS = new Set(["/auth/login"])
const PUBLIC_API_PREFIXES = ["/api/auth"]

function isPublicRequest(pathname: string) {
  if (PUBLIC_PAGE_PATHS.has(pathname)) return true
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicRequest(pathname)) return NextResponse.next()

  let response = NextResponse.next({ request: { headers: request.headers } })

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
    if (isApiRequest(pathname)) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const procurementRole = user.app_metadata?.procurement_role
  const isAdmin = procurementRole === "admin"
  const isApprover = procurementRole === "approver" || isAdmin

  if (pathname === "/auth/login") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (isAdminPath(pathname) && !isAdmin) {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ error: "Administrator role required" }, { status: 403 })
    }
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (isProcurementPath(pathname) && !isApprover) {
    if (!pathname.startsWith("/procurement/requests")) {
      return NextResponse.redirect(new URL("/procurement/requests", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
}
