import { createClient } from "@/lib/supabase/server"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: "Authentication required" }, { status: 401 })
  }

  if (user.app_metadata?.procurement_role !== "admin") {
    return Response.json({ error: "Administrator role required" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const reservationIds =
    typeof body === "object" && body !== null && Array.isArray((body as { reservation_ids?: unknown }).reservation_ids)
      ? (body as { reservation_ids: unknown[] }).reservation_ids
      : []

  const validIds = [...new Set(reservationIds.filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id)))]

  if (validIds.length === 0 || validIds.length !== reservationIds.length) {
    return Response.json({ error: "reservation_ids must contain valid UUIDs" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("reservations")
    .delete()
    .in("id", validIds)
    .select("id")

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, deleted_count: data?.length ?? 0 })
}
