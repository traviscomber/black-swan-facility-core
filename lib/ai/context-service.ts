import { createClient } from "@/lib/supabase/server"
import type { AISession, AIEvent, AIContext, AIArtifact } from "@/lib/types"

/**
 * Google ADK Context Service
 * Implements tiered context architecture: Sessions → Events → Context → Artifacts
 */
export class ContextService {
  /**
   * Create a new AI session
   */
  static async createSession(agentId: string, title: string, metadata: Record<string, any> = {}): Promise<AISession> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("ai_sessions")
      .insert({
        agent_id: agentId,
        title,
        metadata,
        status: "active",
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`)
    }

    return data
  }

  /**
   * End a session and mark it as completed
   */
  static async endSession(sessionId: string, status: "completed" | "failed"): Promise<void> {
    const supabase = await createClient()

    await supabase
      .from("ai_sessions")
      .update({
        status,
        ended_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
  }

  /**
   * Log an event within a session
   */
  static async logEvent(
    sessionId: string,
    eventType: string,
    eventData: Record<string, any>,
    contextSnapshot?: Record<string, any>,
  ): Promise<AIEvent> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("ai_events")
      .insert({
        session_id: sessionId,
        event_type: eventType,
        event_data: eventData,
        context_snapshot: contextSnapshot || null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to log event: ${error.message}`)
    }

    return data
  }

  /**
   * Store structured context for a session
   */
  static async storeContext(
    sessionId: string,
    contextType: string,
    contextData: Record<string, any>,
    priority = 5,
    expiresInHours?: number,
  ): Promise<AIContext> {
    const supabase = await createClient()

    const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString() : null

    const { data, error } = await supabase
      .from("ai_context")
      .insert({
        session_id: sessionId,
        context_type: contextType,
        context_data: contextData,
        priority,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to store context: ${error.message}`)
    }

    return data
  }

  /**
   * Get all context for a session, ordered by priority
   */
  static async getSessionContext(sessionId: string): Promise<AIContext[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("ai_context")
      .select("*")
      .eq("session_id", sessionId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      throw new Error(`Failed to get session context: ${error.message}`)
    }

    return data || []
  }

  /**
   * Compact old context to reduce memory usage
   * Implements Google ADK's context compaction strategy with detailed logging
   */
  static async compactContext(sessionId: string): Promise<number> {
    const supabase = await createClient()

    // Get all context items older than 1 hour with low priority
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data: oldContext } = await supabase
      .from("ai_context")
      .select("*")
      .eq("session_id", sessionId)
      .eq("is_compacted", false)
      .lt("created_at", oneHourAgo)
      .lte("priority", 3)

    if (!oldContext || oldContext.length === 0) {
      return 0
    }

    const originalSize = JSON.stringify(oldContext).length / 1024 // KB

    // Create a compacted summary
    const compactedSummary = {
      compacted_items: oldContext.length,
      context_types: [...new Set(oldContext.map((c) => c.context_type))],
      timestamp: new Date().toISOString(),
      sample_data: oldContext.slice(0, 3).map((c) => ({
        type: c.context_type,
        created: c.created_at,
      })),
    }

    // Store compacted context
    await this.storeContext(sessionId, "compacted_summary", compactedSummary, 10)

    const compactedSize = JSON.stringify(compactedSummary).length / 1024 // KB
    const compressionRatio = originalSize > 0 ? compactedSize / originalSize : 0

    await supabase.from("ai_context_compactions").insert({
      session_id: sessionId,
      compacted_count: oldContext.length,
      original_size_kb: originalSize,
      compacted_size_kb: compactedSize,
      compression_ratio: compressionRatio,
      compaction_strategy: "time_based_low_priority",
    })

    // Mark old items as compacted
    const ids = oldContext.map((c) => c.id)
    await supabase.from("ai_context").update({ is_compacted: true }).in("id", ids)

    return oldContext.length
  }

  /**
   * Create or update an artifact
   */
  static async createArtifact(
    artifactType: string,
    title: string,
    content?: string,
    fileUrl?: string,
    sessionId?: string,
    metadata: Record<string, any> = {},
    tags: string[] = [],
  ): Promise<AIArtifact> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("ai_artifacts")
      .insert({
        session_id: sessionId || null,
        artifact_type: artifactType,
        title,
        content: content || null,
        file_url: fileUrl || null,
        metadata,
        tags,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create artifact: ${error.message}`)
    }

    return data
  }

  /**
   * Search artifacts by type or tags
   */
  static async searchArtifacts(artifactType?: string, tags?: string[]): Promise<AIArtifact[]> {
    const supabase = await createClient()

    let query = supabase.from("ai_artifacts").select("*")

    if (artifactType) {
      query = query.eq("artifact_type", artifactType)
    }

    if (tags && tags.length > 0) {
      query = query.contains("tags", tags)
    }

    const { data, error } = await query.order("created_at", { ascending: false })

    if (error) {
      throw new Error(`Failed to search artifacts: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get session summary with events and context count
   */
  static async getSessionSummary(sessionId: string): Promise<{
    session: AISession
    eventCount: number
    contextCount: number
    artifacts: AIArtifact[]
  }> {
    const supabase = await createClient()

    const [{ data: session }, { data: events }, { data: contexts }, { data: artifacts }] = await Promise.all([
      supabase.from("ai_sessions").select("*").eq("id", sessionId).single(),
      supabase.from("ai_events").select("id").eq("session_id", sessionId),
      supabase.from("ai_context").select("id").eq("session_id", sessionId),
      supabase.from("ai_artifacts").select("*").eq("session_id", sessionId),
    ])

    return {
      session: session!,
      eventCount: events?.length || 0,
      contextCount: contexts?.length || 0,
      artifacts: artifacts || [],
    }
  }
}
