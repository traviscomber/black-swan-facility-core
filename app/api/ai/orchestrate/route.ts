import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { classifyCentralAIMode, routeCentralAI } from "@/lib/ai/central-router"
import { isUuid, parseAuthorizedAction } from "@/lib/ai/authorized-executor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_MESSAGE_LENGTH = 8_000
const MAX_OPERATIONAL_AREA_LENGTH = 120

function readString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) return null
  return normalized
}

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

  const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}
  const message = typeof input.message === "string" ? input.message.trim() : ""
  const confirmed = input.confirmed === true
  const proposalId = input.proposalId

  // Confirmation is bound to an immutable, server-persisted proposal. A caller cannot
  // replace the payload at confirmation time and a consumed proposal cannot be replayed.
  if (proposalId !== undefined) {
    if (!isUuid(proposalId)) {
      return NextResponse.json({ success: false, error: "invalid_proposal_id" }, { status: 400 })
    }

    if (!confirmed) {
      return NextResponse.json(
        { success: false, error: "explicit_confirmation_required", requiresConfirmation: true },
        { status: 409 },
      )
    }

    const { data: execution, error: executionError } = await supabase.rpc("execute_ai_action_proposal", {
      p_proposal_id: proposalId,
    })

    if (executionError) {
      console.error("[Black Swan AI] Authorized executor RPC failed", {
        userId: user.id,
        proposalId,
        error: executionError.message,
      })
      return NextResponse.json({ success: false, error: "executor_unavailable" }, { status: 503 })
    }

    const result = execution && typeof execution === "object" ? (execution as Record<string, unknown>) : null
    if (result?.success !== true) {
      const error = typeof result?.error === "string" ? result.error : "execution_failed"
      const status = error === "proposal_not_found" ? 404 : error === "agentic_access_denied" ? 403 : 409
      return NextResponse.json(
        { success: false, ...result, mode: "FULL_AGENTIC", requiresConfirmation: false },
        { status },
      )
    }

    return NextResponse.json({ ...result, mode: "FULL_AGENTIC", requiresConfirmation: false })
  }

  if (!message) {
    return NextResponse.json({ success: false, error: "message_required" }, { status: 400 })
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ success: false, error: "message_too_long" }, { status: 413 })
  }

  const mode = classifyCentralAIMode(message)

  if (mode === "FULL_AGENTIC") {
    const { data: agenticAccess, error: agenticAccessError } = await supabase
      .from("ai_agentic_access")
      .select("enabled")
      .eq("user_id", user.id)
      .maybeSingle()

    if (agenticAccessError) {
      console.error("[Black Swan AI] Agentic access check failed", {
        userId: user.id,
        error: agenticAccessError.message,
      })
      return NextResponse.json(
        { success: false, error: "agentic_access_check_failed", mode },
        { status: 503 },
      )
    }

    if (agenticAccess?.enabled !== true) {
      return NextResponse.json(
        {
          success: false,
          error: "agentic_access_denied",
          mode,
          requiresConfirmation: false,
        },
        { status: 403 },
      )
    }

    const authorizedAction = parseAuthorizedAction(message)
    if (authorizedAction) {
      const contextInput =
        typeof input.context === "object" && input.context !== null
          ? (input.context as Record<string, unknown>)
          : {}
      const operationalArea = readString(contextInput.operationalArea, MAX_OPERATIONAL_AREA_LENGTH)
      const locationId = isUuid(contextInput.locationId) ? contextInput.locationId : null

      const { data: proposal, error: proposalError } = await supabase.rpc("create_ai_task_proposal", {
        p_title: authorizedAction.title,
        p_description: authorizedAction.description,
        p_operational_area: operationalArea,
        p_location_id: locationId,
        p_context: {
          source: "central_ai",
          mode,
        },
      })

      if (proposalError) {
        const denied = proposalError.message.includes("task_scope_denied")
        console.error("[Black Swan AI] Proposal creation failed", {
          userId: user.id,
          capability: authorizedAction.capability,
          error: proposalError.message,
        })
        return NextResponse.json(
          {
            success: false,
            error: denied ? "task_scope_denied" : "proposal_creation_failed",
            mode,
            requiresConfirmation: false,
          },
          { status: denied ? 403 : 503 },
        )
      }

      const persisted = proposal && typeof proposal === "object" ? (proposal as Record<string, unknown>) : null
      const persistedId = persisted?.id
      const expiresAt = persisted?.expires_at

      if (!isUuid(persistedId)) {
        return NextResponse.json(
          { success: false, error: "invalid_persisted_proposal", mode },
          { status: 503 },
        )
      }

      return NextResponse.json({
        success: true,
        mode,
        source: "deterministic",
        response: `Preparé la tarea interna “${authorizedAction.title}”. Confirma para crearla en estado nueva.`,
        requiresConfirmation: true,
        executionStatus: "confirmation_required",
        proposalId: persistedId,
        expiresAt: typeof expiresAt === "string" ? expiresAt : null,
        capability: authorizedAction.capability,
        proposedAction: {
          title: authorizedAction.title,
          status: "nueva",
          operationalArea,
          locationId,
        },
      })
    }

    // Planning for any other write intent remains available, but execution stays fail-closed.
    try {
      const result = await routeCentralAI({
        message,
        context: {
          user: { id: user.id, email: user.email ?? null },
        },
      })
      return NextResponse.json({
        success: true,
        ...result,
        executionStatus: "blocked_unsupported_capability",
        requiresConfirmation: false,
      })
    } catch (error) {
      console.error("[Black Swan AI] Agentic planning failed", {
        userId: user.id,
        error: error instanceof Error ? error.message : "unknown_error",
      })
      return NextResponse.json({ success: false, error: "ai_unavailable", mode }, { status: 503 })
    }
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
