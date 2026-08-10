import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { verifyPublicGuestAccessToken } from "@/lib/guest-request-public-access"

const schema = z.object({
  access: z.string().min(20),
  reservationId: z.string().uuid(),
  category: z.enum(["blankets", "towels", "cleaning", "maintenance", "amenities", "activities", "food", "other"]),
  requestLabel: z.string().trim().min(2).max(160),
  language: z.enum(["es", "en", "de"]).default("es"),
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

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json())
    const verified = verifyPublicGuestAccessToken(payload.access)
    if (!verified || verified.v !== 2 || verified.scope !== "global") {
      return NextResponse.json({ error: "Acceso inválido o expirado." }, { status: 401 })
    }

    const supabase = admin()
    const today = chileDate()
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("id,guest_name,room_id,location_id,check_in,check_out,status,room:rooms(room_number)")
      .eq("id", payload.reservationId)
      .lte("check_in", today)
      .gte("check_out", today)
      .not("status", "in", "(cancelled,canceled,void,voided,checked_out,checked-out)")
      .maybeSingle()

    if (reservationError) throw reservationError
    if (!reservation) return NextResponse.json({ error: "Esta estadía ya no está activa." }, { status: 403 })

    const priority = payload.category === "maintenance" ? "high" : "normal"
    const sourceCopy = {
      es: "Solicitud enviada desde portal de huésped por QR global",
      en: "Request submitted from global QR guest portal",
      de: "Anfrage über das globale QR-Gästeportal gesendet",
    } as const

    const { data: created, error: insertError } = await supabase
      .from("hospitality_requests")
      .insert({
        room_id: reservation.room_id,
        location_id: reservation.location_id,
        reservation_id: reservation.id,
        guest_name: reservation.guest_name,
        request_type: payload.requestLabel,
        category: payload.category,
        description: `${sourceCopy[payload.language]}.`,
        priority,
        status: "pending",
      })
      .select("id")
      .single()

    if (insertError) throw insertError

    const roomNumber = Array.isArray(reservation.room) ? reservation.room[0]?.room_number ?? null : reservation.room?.room_number ?? null
    return NextResponse.json({
      success: true,
      requestId: created.id,
      guestName: reservation.guest_name,
      roomNumber,
    })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
    console.error("Guest portal request error", error)
    return NextResponse.json({ error: "No fue posible registrar la solicitud." }, { status: 500 })
  }
}
