import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

const requestSchema = z.object({
  guestName: z.string().trim().min(2).max(120),
  category: z.enum(["blankets", "towels", "cleaning", "maintenance", "amenities", "activities", "food", "other"]),
  requestLabel: z.string().trim().min(2).max(160),
  locationId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  reservationId: z.string().uuid().nullable().optional(),
  roomNumber: z.string().trim().max(80).nullable().optional(),
  deviceId: z.string().trim().min(8).max(160),
  language: z.enum(["es", "en"]).default("es"),
})

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error("Supabase server configuration is incomplete")
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function GET(request: Request) {
  try {
    const supabase = getAdminClient()
    const url = new URL(request.url)
    const roomId = url.searchParams.get("room_id")
    const locationId = url.searchParams.get("location_id")

    const { data: locations, error: locationsError } = await supabase
      .from("locations")
      .select("id, name, is_active")
      .eq("is_active", true)
      .order("name")

    if (locationsError) throw locationsError

    let room = null
    if (roomId) {
      const query = supabase.from("rooms").select("id, room_number, location_id").eq("id", roomId)
      const { data, error } = locationId ? await query.eq("location_id", locationId).maybeSingle() : await query.maybeSingle()
      if (error) throw error
      room = data
    }

    return NextResponse.json({ locations: locations ?? [], room })
  } catch (error) {
    console.error("Guest request configuration error", error)
    return NextResponse.json({ error: "No fue posible cargar la configuración de la tablet." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json())
    const supabase = getAdminClient()

    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id, name, is_active")
      .eq("id", payload.locationId)
      .eq("is_active", true)
      .maybeSingle()

    if (locationError) throw locationError
    if (!location) return NextResponse.json({ error: "La ubicación asignada no está disponible." }, { status: 400 })

    let room: { id: string; room_number: string; location_id: string } | null = null
    if (payload.roomId) {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, room_number, location_id")
        .eq("id", payload.roomId)
        .eq("location_id", payload.locationId)
        .maybeSingle()
      if (error) throw error
      if (!data) return NextResponse.json({ error: "La habitación no pertenece a la ubicación asignada." }, { status: 400 })
      room = data
    }

    let reservationId: string | null = null
    if (payload.reservationId) {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, room_id, location_id")
        .eq("id", payload.reservationId)
        .maybeSingle()
      if (error) throw error
      if (data && (!room || data.room_id === room.id) && (!data.location_id || data.location_id === payload.locationId)) reservationId = data.id
    }

    const priority = payload.category === "maintenance" ? "high" : payload.category === "cleaning" ? "medium" : "medium"
    const description = `${payload.language === "es" ? "Solicitud enviada desde tablet" : "Request submitted from tablet"}. Dispositivo: ${payload.deviceId}.`

    const { data: created, error: insertError } = await supabase
      .from("hospitality_requests")
      .insert({
        room_id: room?.id ?? null,
        location_id: payload.locationId,
        reservation_id: reservationId,
        tablet_device_id: payload.deviceId,
        guest_name: payload.guestName,
        request_type: payload.requestLabel,
        category: payload.category,
        description,
        priority,
        status: "pending",
      })
      .select("id")
      .single()

    if (insertError) throw insertError

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
    if (deviceError) console.error("Tablet registry update failed", deviceError)

    return NextResponse.json({
      success: true,
      requestId: created.id,
      locationName: location.name,
      roomNumber: room?.room_number ?? payload.roomNumber ?? null,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "La solicitud contiene datos incompletos o inválidos." }, { status: 400 })
    }
    console.error("Guest request submission error", error)
    return NextResponse.json({ error: "No fue posible registrar la solicitud." }, { status: 500 })
  }
}
