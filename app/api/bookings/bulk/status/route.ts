import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = createClient()
  const { reservation_ids, status } = await request.json()
  
  if (!reservation_ids?.length || !status) {
    return Response.json({ error: "Missing reservation_ids or status" }, { status: 400 })
  }

  const { error } = await supabase
    .from("reservations")
    .update({ status })
    .in("id", reservation_ids)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, updated_count: reservation_ids.length })
}
