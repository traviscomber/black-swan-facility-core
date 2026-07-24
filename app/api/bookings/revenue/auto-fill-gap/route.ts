import { createClient } from "@/lib/supabase/server"
import { differenceInCalendarDays } from "date-fns"

export async function POST(request: Request) {
  try {
    const { bed_id, check_in, check_out, daily_rate } = await request.json()
    if (!bed_id || !check_in || !check_out || !daily_rate) {
      return Response.json({ error: "Parámetros faltantes" }, { status: 400 })
    }

    const supabase = await createClient()
    const totalNights = differenceInCalendarDays(new Date(check_out), new Date(check_in))
    const totalAmount = daily_rate * totalNights

    const { data, error } = await supabase.from("reservations").insert([
      {
        bed_id,
        check_in,
        check_out,
        guest_name: "[GAP FILLER]",
        num_guests: 0,
        total_amount: totalAmount,
        status: "confirmed",
      },
    ]).select()

    if (error) throw error

    return Response.json({ success: true, reservation_id: data?.[0]?.id })
  } catch (err) {
    console.error("[auto-fill-gap]", err)
    return Response.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 })
  }
}
