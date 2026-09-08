import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { classifyCentralAIMode, routeCentralAI } from "@/lib/ai/central-router"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_MESSAGE_LENGTH = 8_000

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 })
  }

  const message =
    typeof body === "object" && body !== null && typeof (body as { message?: unknown }).message === "string"
      ? (body as { message: string }).message.trim()
      : ""
  const confirmed =
    typeof body === "object" && body !== null && (body as { confirmed?: unknown }).confirmed === true

  if (!message) {
    return NextResponse.json({ success: false, error: "message_required" }, { status: 400 })
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ success: false, error: "message_too_long" }, { status: 413 })
  }

  const mode = classifyCentralAIMode(message)

  if (mode === "FULL_AGENTIC" && confirmed) {
    return NextResponse.json(
      {
        success: false,
        error: "execution_not_enabled",
        mode,
        requiresConfirmation: true,
        executionStatus: "blocked_no_authorized_executor",
        message:
          "La confirmacion fue recibida, pero este orquestador aun no tiene habilitada la ejecucion de efectos externos.",
      },
      { status: 409 },
    )
  }

  try {
    const result = await routeCentralAI({
      message,
      context: {
        user: {
          id: user.id,
          email: user.email ?? null,
        },
      },
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[Black Swan AI] Orchestration failed", {
      mode,
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown_error",
    })

    return NextResponse.json(
      {
        success: false,
        error: "ai_unavailable",
        mode,
      },
      { status: 503 },
    )
  }
}
