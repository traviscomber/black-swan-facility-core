import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildCentralAICanonicalContext } from "@/lib/ai/canonical-context"
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
  const requestedCapability = typeof input.capability === "string" ? input.capability : null
  const requestId = input.requestId
  const reservationId = input.reservationId

  if (requestedCapability === "hospitality.prepare_arrival") {
    if (!isUuid(reservationId)) {
      return NextResponse.json({ success: false, error: "invalid_reservation_id" }, { status: 400 })
    }

    const contextInput =
      typeof input.context === "object" && input.context !== null
        ? (input.context as Record<string, unknown>)
        : {}
    const persona = readString(contextInput.persona, 40)
    const source = readString(contextInput.source, 80)

    const { data: proposal, error: proposalError } = await supabase.rpc("create_ai_arrival_preparation_proposal", {
      p_reservation_id: reservationId,
      p_context: {
        source: source ?? "role_agentic_brief",
        persona,
        mode: "FULL_AGENTIC",
      },
    })

    if (proposalError) {
      console.error("[Black Swan AI] Arrival preparation proposal failed", {
        userId: user.id,
        reservationId,
        error: proposalError.message,
      })
      return NextResponse.json(
        { success: false, error: proposalError.message.includes("denied") ? "arrival_preparation_denied" : "proposal_creation_failed" },
        { status: proposalError.message.includes("denied") ? 403 : 409 },
      )
    }

    const persisted = proposal && typeof proposal === "object" ? (proposal as Record<string, unknown>) : null
    const persistedId = persisted?.id
    const payload = persisted?.payload && typeof persisted.payload === "object" ? (persisted.payload as Record<string, unknown>) : null

    if (!isUuid(persistedId)) {
      return NextResponse.json({ success: false, error: "invalid_persisted_proposal" }, { status: 503 })
    }

    return NextResponse.json({
      success: true,
      mode: "FULL_AGENTIC",
      source: "deterministic",
      requiresConfirmation: true,
      executionStatus: "confirmation_required",
      proposalId: persistedId,
      capability: "hospitality.prepare_arrival",
      proposedAction: {
        reservationId,
        guestName: payload?.guest_name ?? null,
        checkIn: payload?.check_in ?? null,
        locationName: payload?.location_name ?? null,
        roomNumber: payload?.room_number ?? null,
        bundleSize: payload?.bundle_size ?? null,
        existingTasks: payload?.existing_tasks ?? null,
      },
      response: `Preparé el set de llegada para ${typeof payload?.guest_name === "string" ? payload.guest_name : "la próxima reserva"}. Confirma para crear sólo las tareas que aún no existan.`,
    })
  }

  if (requestedCapability === "hospitality.assign_request") {
    if (!isUuid(requestId)) {
      return NextResponse.json({ success: false, error: "invalid_request_id" }, { status: 400 })
    }

    const contextInput =
      typeof input.context === "object" && input.context !== null
        ? (input.context as Record<string, unknown>)
        : {}
    const persona = readString(contextInput.persona, 40)
    const source = readString(contextInput.source, 80)

    const { data: proposal, error: proposalError } = await supabase.rpc("create_ai_hospitality_assignment_proposal", {
      p_request_id: requestId,
      p_context: {
        source: source ?? "role_agentic_brief",
        persona,
        mode: "FULL_AGENTIC",
      },
    })

    if (proposalError) {
      console.error("[Black Swan AI] Hospitality assignment proposal failed", {
        userId: user.id,
        requestId,
        error: proposalError.message,
      })
      return NextResponse.json(
        { success: false, error: proposalError.message.includes("denied") ? "hospitality_assignment_denied" : "proposal_creation_failed" },
        { status: proposalError.message.includes("denied") ? 403 : 409 },
      )
    }

    const persisted = proposal && typeof proposal === "object" ? (proposal as Record<string, unknown>) : null
    const persistedId = persisted?.id
    const payload = persisted?.payload && typeof persisted.payload === "object" ? (persisted.payload as Record<string, unknown>) : null

    if (!isUuid(persistedId)) {
      return NextResponse.json({ success: false, error: "invalid_persisted_proposal" }, { status: 503 })
    }

    return NextResponse.json({
      success: true,
      mode: "FULL_AGENTIC",
      source: "deterministic",
      requiresConfirmation: true,
      executionStatus: "confirmation_required",
      proposalId: persistedId,
      capability: "hospitality.assign_request",
      proposedAction: {
        requestId,
        employeeId: payload?.employee_id ?? null,
        employeeName: payload?.employee_name ?? null,
        guestName: payload?.guest_name ?? null,
        requestType: payload?.request_type ?? null,
      },
      response: `Preparé la asignación de la solicitud a ${typeof payload?.employee_name === "string" ? payload.employee_name : "un responsable disponible"}. Confirma para aplicarla.`,
    })
  }

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
      return NextResponse.json({ success: false, error: "agentic_access_check_failed", mode }, { status: 503 })
    }

    if (agenticAccess?.enabled !== true) {
      return NextResponse.json(
        { success: false, error: "agentic_access_denied", mode, requiresConfirmation: false },
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
      const persona = readString(contextInput.persona, 40)
      const source = readString(contextInput.source, 80)

      const { data: proposal, error: proposalError } = await supabase.rpc("create_ai_task_proposal", {
        p_title: authorizedAction.title,
        p_description: authorizedAction.description,
        p_operational_area: operationalArea,
        p_location_id: locationId,
        p_context: {
          source: source ?? "central_ai",
          mode,
          persona,
          operational_area: operationalArea,
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
        return NextResponse.json({ success: false, error: "invalid_persisted_proposal", mode }, { status: 503 })
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
  }

  let operationalContext = undefined
  if (mode !== "DIRECT") {
    try {
      operationalContext = (await buildCentralAICanonicalContext(supabase, mode)) ?? undefined
    } catch (error) {
      console.error("[Black Swan AI] Canonical context unavailable", {
        mode,
        userId: user.id,
        error: error instanceof Error ? error.message : "unknown_error",
      })
    }
  }

  try {
    const result = await routeCentralAI({
      message,
      context: {
        authorization: { authenticated: true },
        operational: operationalContext,
      },
    })

    if (mode === "FULL_AGENTIC") {
      return NextResponse.json({
        success: true,
        ...result,
        executionStatus: "blocked_unsupported_capability",
        requiresConfirmation: false,
      })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[Black Swan AI] Orchestration failed", {
      mode,
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown_error",
    })

    return NextResponse.json({ success: false, error: "ai_unavailable", mode }, { status: 503 })
  }
}
