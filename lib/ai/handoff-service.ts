import { createClient } from "@/lib/supabase/server"
import type { AIAgentHandoff } from "@/lib/types"

/**
 * Google ADK Phase 2: Multi-Agent Handoff Service
 * Enables agents to coordinate and hand off tasks to specialized agents
 */
export class HandoffService {
  /**
   * Create a handoff from one agent to another
   */
  static async createHandoff(
    sessionId: string,
    fromAgentId: string,
    toAgentId: string,
    reason: string,
    contextSnapshot: Record<string, any>,
  ): Promise<AIAgentHandoff> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("ai_agent_handoffs")
      .insert({
        session_id: sessionId,
        from_agent_id: fromAgentId,
        to_agent_id: toAgentId,
        handoff_reason: reason,
        context_snapshot: contextSnapshot,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create handoff: ${error.message}`)
    }

    return data as AIAgentHandoff
  }

  /**
   * Accept a handoff and begin execution
   */
  static async acceptHandoff(handoffId: string): Promise<void> {
    const supabase = await createClient()

    await supabase.from("ai_agent_handoffs").update({ status: "accepted" }).eq("id", handoffId)
  }

  /**
   * Complete a handoff
   */
  static async completeHandoff(handoffId: string): Promise<void> {
    const supabase = await createClient()

    await supabase
      .from("ai_agent_handoffs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", handoffId)
  }

  /**
   * Get pending handoffs for an agent
   */
  static async getPendingHandoffs(agentId: string): Promise<AIAgentHandoff[]> {
    const supabase = await createClient()

    const { data } = await supabase
      .from("ai_agent_handoffs")
      .select("*, from_agent:ai_agents!from_agent_id(*), to_agent:ai_agents!to_agent_id(*)")
      .eq("to_agent_id", agentId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })

    return (data || []) as AIAgentHandoff[]
  }

  /**
   * Suggest best agent for a handoff based on task type
   */
  static async suggestHandoff(taskType: string, context: Record<string, any>): Promise<string | null> {
    const supabase = await createClient()

    // Simple rule-based routing - in production, use ML model
    const routingRules: Record<string, string> = {
      maintenance_required: "maintenance",
      critical_issue: "issue_resolution",
      documentation_needed: "documentation",
      alert_required: "communication",
    }

    const suggestedType = routingRules[taskType]

    if (!suggestedType) {
      return null
    }

    const { data } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("type", suggestedType)
      .eq("status", "active")
      .single()

    return data?.id || null
  }
}
