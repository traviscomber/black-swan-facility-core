import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = createClient()
  const { reservation_ids } = await request.json()
  
  if (!reservation_ids?.length) {
    return Response.json({ error: "Missing reservation_ids" }, { status: 400 })
  }

  const { error } = await supabase
    .from("reservations")
    .delete()
    .in("id", reservation_ids)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, deleted_count: reservation_ids.length })
}
