import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { reservation_ids, operation_type } = await request.json()
  
  if (!reservation_ids?.length || !operation_type) {
    return Response.json({ error: "Missing parameters" }, { status: 400 })
  }

  // Retrieve previous state from audit log (if tracking enabled)
  // For now, this is a placeholder - actual implementation depends on audit schema
  // Typically you'd query a bulk_operation_audit table with snapshots
  const { data: audit, error: auditError } = await supabase
    .from("bulk_operations")
    .select("id, previous_state")
    .in("reservation_ids", reservation_ids)
    .eq("operation_type", operation_type)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (auditError || !audit) {
    return Response.json({ error: "No audit trail found for undo" }, { status: 404 })
  }

  if (!audit.previous_state) {
    return Response.json({ error: "No previous state to restore" }, { status: 400 })
  }

  // Restore from previous state
  const { error } = await supabase.rpc("restore_bulk_operation_state", {
    p_operation_id: audit.id,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, undone_count: reservation_ids.length })
}
