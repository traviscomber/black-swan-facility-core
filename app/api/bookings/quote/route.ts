import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type QuoteExtra = {
  extra_id: string
  quantity?: number
}

type QuoteRequest = {
  check_in?: string
  check_out?: string
  guests?: number
  adults?: number
  children_0_3?: number
  children_4_10?: number
  room_id?: string | null
  extras?: QuoteExtra[]
}

export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = (await request.json()) as QuoteRequest
    const checkIn = body.check_in?.trim()
    const checkOut = body.check_out?.trim()
    const adults = Number(body.adults ?? body.guests ?? 1)
    const children03 = Number(body.children_0_3 ?? 0)
    const children410 = Number(body.children_4_10 ?? 0)
    const guests = adults + children03 + children410

    if (!checkIn || !checkOut) {
      return NextResponse.json({ error: "check_in and check_out are required" }, { status: 400 })
    }

    if (![adults, children03, children410].every(Number.isInteger) || adults < 1 || children03 < 0 || children410 < 0) {
      return NextResponse.json({ error: "guest counts must be non-negative integers and adults must be at least 1" }, { status: 400 })
    }

    const extras = Array.isArray(body.extras)
      ? body.extras
          .filter((extra) => typeof extra?.extra_id === "string" && extra.extra_id.length > 0)
          .map((extra) => ({
            extra_id: extra.extra_id,
            quantity: Math.max(Number(extra.quantity ?? 1), 0),
          }))
      : []

    const { data, error } = await supabase.rpc("calculate_booking_quote_v2", {
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_adults: adults,
      p_children_0_3: children03,
      p_children_4_10: children410,
      p_room_id: body.room_id || null,
      p_extras: extras,
    })

    if (error) {
      const status = error.message.includes("after check_in") || error.message.includes("at least 1") ? 400 : 500
      return NextResponse.json({ error: error.message }, { status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[bookings/quote] Failed to calculate quote", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to calculate booking quote" },
      { status: 500 },
    )
  }
}
