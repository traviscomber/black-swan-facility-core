import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Webhook endpoint for agent to log messages and actions
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, payload } = body

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    switch (action) {
      case "log_message":
        // Log incoming/outgoing WhatsApp message
        const { error: msgError } = await supabase.from("messages").insert({
          phone: payload.phone,
          direction: payload.direction, // inbound/outbound
          text: payload.text,
          intent: payload.intent,
          sentiment: payload.sentiment,
          lead_id: payload.lead_id,
          reservation_id: payload.reservation_id,
        })
        if (msgError) throw msgError
        break

      case "create_lead":
        // Create or update lead
        const { data: existingLead } = await supabase.from("leads").select("id").eq("phone", payload.phone).single()

        if (existingLead) {
          // Update existing lead
          await supabase
            .from("leads")
            .update({
              ...payload,
              last_msg_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingLead.id)
        } else {
          // Create new lead
          await supabase.from("leads").insert({
            phone: payload.phone,
            name: payload.name,
            stage: payload.stage || "new",
            dates_requested: payload.dates_requested,
            num_guests: payload.num_guests,
            unit_preference: payload.unit_preference,
            notes: payload.notes,
          })
        }
        break

      case "create_task":
        // Create operational task
        await supabase.from("tasks").insert({
          title: payload.title,
          description: payload.description,
          priority: payload.priority || "medium",
          status: "new",
          due_date: payload.due_date,
          location_name: payload.location_name,
        })
        break

      case "log_audit":
        // Log agent action for audit trail
        await supabase.from("audit_actions").insert({
          actor: payload.actor || "agent",
          action_type: payload.action_type,
          payload: payload.details,
          phone: payload.phone,
          reservation_id: payload.reservation_id,
          lead_id: payload.lead_id,
          success: payload.success !== false,
          error_message: payload.error_message,
        })
        break

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Concierge Webhook Error]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
