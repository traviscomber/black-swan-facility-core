import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createPublicGuestAccessToken, verifyPublicGuestAccessToken } from "@/lib/guest-request-public-access"

const qrSchema = z.object({
  locationId: z.string().uuid(),
  deviceId: z.string().trim().min(8).max(160),
})

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

function publicName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return parts[0] ?? "Huésped"
  return `${parts[0]} ${parts[parts.length - 1]?.charAt(0) ?? ""}.`
}

export async function POST(request: Request) {
  try {
    const payload = qrSchema.parse(await request.json())
    const supabase = admin()

    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id,name,is_active")
      .eq("id", payload.locationId)
      .eq("is_active", true)
      .maybeSingle()
    if (locationError) throw locationError
    if (!location) return NextResponse.json({ error: "Ubicación no disponible." }, { status: 404 })

    const { data: device } = await supabase
      .from("tablet_devices")
      .select("device_id,location_id,is_active")
      .eq("device_id", payload.deviceId)
      .eq("location_id", payload.locationId)
      .eq("is_active", true)
      .maybeSingle()

    if (!device) {
      const { error: deviceError } = await supabase.from("tablet_devices").upsert(
        {
          device_id: payload.deviceId,
          device_name: `${location.name} Tablet`,
          location_id: payload.locationId,
          last_active_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: "device_id" },
      )
      if (deviceError) throw deviceError
    }

    const token = createPublicGuestAccessToken(payload.locationId, payload.deviceId, 180 * 24 * 60 * 60)
    return NextResponse.json({ token, locationName: location.name })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Configuración inválida." }, { status: 400 })
    console.error("Guest access QR error", error)
    return NextResponse.json({ error: "No fue posible generar el acceso de huéspedes." }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get("access") ?? ""
    const verified = verifyPublicGuestAccessToken(token)
    if (!verified) return NextResponse.json({ error: "Acceso inválido o expirado." }, { status: 401 })

    const supabase = admin()
    const today = chileDate()

    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id,name,is_active")
      .eq("id", verified.locationId)
      .eq("is_active", true)
      .maybeSingle()
    if (locationError) throw locationError
    if (!location) return NextResponse.json({ error: "La casa ya no está disponible." }, { status: 404 })

    const { data: reservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("id,guest_name,room_id,check_in,check_out,status,room:rooms(room_number)")
      .eq("location_id", verified.locationId)
      .lte("check_in", today)
      .gte("check_out", today)
      .not("status", "in", "(cancelled,canceled,void,voided,checked_out,checked-out)")
      .order("guest_name")

    if (reservationsError) throw reservationsError

    const guests = (reservations ?? []).map((reservation) => ({
      reservationId: reservation.id,
      displayName: publicName(reservation.guest_name),
      roomNumber: Array.isArray(reservation.room) ? reservation.room[0]?.room_number ?? null : reservation.room?.room_number ?? null,
    }))

    return NextResponse.json({ location: { id: location.id, name: location.name }, guests })
  } catch (error) {
    console.error("Guest access lookup error", error)
    return NextResponse.json({ error: "No fue posible cargar los huéspedes activos." }, { status: 500 })
  }
}
