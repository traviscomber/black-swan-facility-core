import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Decision = "execute" | "reject"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await context.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Invalid proposal id" }, { status: 400 })
  const body = await request.json().catch(() => null) as { decision?: unknown } | null
  const decision = body?.decision as Decision | undefined
  if (decision !== "execute" && decision !== "reject") return NextResponse.json({ error: "Invalid decision" }, { status: 400 })

  const rpc = decision === "execute" ? "execute_orchard_ai_action" : "reject_orchard_ai_action"
  const result = await supabase.rpc(rpc, { p_proposal_id: id })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })
  const payload = result.data as { status?: string; error?: string } | null
  if (payload?.status === "failed") return NextResponse.json(payload, { status: 422 })
  return NextResponse.json(payload ?? { status: decision === "execute" ? "executed" : "rejected" })
}
