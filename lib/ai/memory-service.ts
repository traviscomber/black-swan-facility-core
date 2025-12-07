import { createClient } from "@/lib/supabase/server"
import type { AIMemory } from "@/lib/types"

/**
 * Google ADK Phase 2: Memory Service
 * Implements episodic, semantic, and procedural memory with vector search
 */
export class MemoryService {
  /**
   * Store a memory with optional embedding for semantic search
   */
  static async storeMemory(
    agentId: string,
    memoryType: "episodic" | "semantic" | "procedural",
    content: string,
    metadata: Record<string, any> = {},
    relevanceScore = 1.0,
  ): Promise<void> {
    const supabase = await createClient()

    await supabase.from("ai_memory_store").insert({
      agent_id: agentId,
      memory_type: memoryType,
      content,
      metadata,
      relevance_score: relevanceScore,
    })
  }

  /**
   * Retrieve memories for an agent, ordered by relevance and recency
   */
  static async getMemories(
    agentId: string,
    memoryType?: "episodic" | "semantic" | "procedural",
    limit = 10,
  ): Promise<AIMemory[]> {
    const supabase = await createClient()

    let query = supabase
      .from("ai_memory_store")
      .select("*")
      .eq("agent_id", agentId)
      .order("relevance_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit)

    if (memoryType) {
      query = query.eq("memory_type", memoryType)
    }

    const { data } = await query

    return (data || []) as AIMemory[]
  }

  /**
   * Search memories by content (simple text search)
   * In production, this would use vector embeddings for semantic search
   */
  static async searchMemories(agentId: string, searchQuery: string, limit = 5): Promise<AIMemory[]> {
    const supabase = await createClient()

    const { data } = await supabase
      .from("ai_memory_store")
      .select("*")
      .eq("agent_id", agentId)
      .ilike("content", `%${searchQuery}%`)
      .order("relevance_score", { ascending: false })
      .limit(limit)

    return (data || []) as AIMemory[]
  }

  /**
   * Update memory access tracking (for memory decay/reinforcement)
   */
  static async recordMemoryAccess(memoryId: string): Promise<void> {
    const supabase = await createClient()

    await supabase.rpc("increment_memory_access", { memory_id: memoryId })

    await supabase
      .from("ai_memory_store")
      .update({
        last_accessed: new Date().toISOString(),
      })
      .eq("id", memoryId)
  }

  /**
   * Decay old memories (reduce relevance over time)
   */
  static async decayMemories(agentId: string, decayFactor = 0.95): Promise<number> {
    const supabase = await createClient()

    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: oldMemories } = await supabase
      .from("ai_memory_store")
      .select("id, relevance_score")
      .eq("agent_id", agentId)
      .lt("created_at", oneMonthAgo)
      .is("last_accessed", null)

    if (!oldMemories || oldMemories.length === 0) {
      return 0
    }

    for (const memory of oldMemories) {
      const newScore = memory.relevance_score * decayFactor

      await supabase.from("ai_memory_store").update({ relevance_score: newScore }).eq("id", memory.id)
    }

    return oldMemories.length
  }

  /**
   * Get most relevant memories for a context (proactive memory recall)
   */
  static async recallRelevantMemories(agentId: string, contextKeywords: string[], limit = 5): Promise<AIMemory[]> {
    const supabase = await createClient()

    // Simple keyword matching - in production, use vector similarity
    const searchPattern = contextKeywords.join("|")

    const { data } = await supabase
      .from("ai_memory_store")
      .select("*")
      .eq("agent_id", agentId)
      .or(contextKeywords.map((keyword) => `content.ilike.%${keyword}%`).join(","))
      .order("relevance_score", { ascending: false })
      .limit(limit)

    return (data || []) as AIMemory[]
  }
}
