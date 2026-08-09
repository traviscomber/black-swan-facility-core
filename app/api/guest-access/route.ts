import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createGlobalGuestAccessToken, verifyPublicGuestAccessToken } from "@/lib/guest-request-public-access"

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server configuration is incomplete")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function chileDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

export async function POST() {
  try {
    return NextResponse.json({ token: createGlobalGuestAccessToken() })
  } catch (error) {
    console.error("Guest access QR error", error)
    return NextResponse.json({ error: "No fue posible generar el acceso de huéspedes." }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get("access") ?? ""
    const verified = verifyPublicGuestAccessToken(token)
    if (!verified || verified.v !== 2 || verified.scope !== "global") {
      return NextResponse.json({ error: "Acceso inválido o expirado." }, { status: 401 })
    }

    const supabase = admin()
    const today = chileDate()
    const { data: reservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("id,guest_name,check_in,check_out,status")
      .lte("check_in", today)
      .gte("check_out", today)
      .not("status", "in", "(cancelled,canceled,void,voided,checked_out,checked-out)")
      .order("guest_name")

    if (reservationsError) throw reservationsError

    const guests = (reservations ?? []).map((reservation) => ({
      reservationId: reservation.id,
      displayName: reservation.guest_name,
    }))

    return NextResponse.json({ guests })
  } catch (error) {
    console.error("Guest access lookup error", error)
    return NextResponse.json({ error: "No fue posible cargar los huéspedes activos." }, { status: 500 })
  }
}
