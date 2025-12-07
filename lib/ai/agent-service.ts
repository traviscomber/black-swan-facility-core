import { createClient } from "@/lib/supabase/server"
import type { AIAgent, AIAgentExecution } from "@/lib/types"
import { ContextService } from "./context-service"
import { MemoryService } from "./memory-service"
import { HandoffService } from "./handoff-service"

export interface AgentExecutionContext {
  agentId: string
  input: Record<string, any>
  memory: Record<string, any>
}

export interface AgentExecutionResult {
  success: boolean
  output: Record<string, any>
  error?: string
  duration: number
}

/**
 * AI Agent Service
 * Manages agent lifecycle, execution, memory, and logging
 */
export class AIAgentService {
  /**
   * Execute an AI agent with ADK context tracking
   */
  static async executeAgent(agentId: string, input: Record<string, any> = {}): Promise<AIAgentExecution> {
    const supabase = await createClient()
    const startTime = Date.now()

    const session = await ContextService.createSession(agentId, `Agent execution at ${new Date().toISOString()}`, {
      input,
    })

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from("ai_agent_executions")
      .insert({
        agent_id: agentId,
        status: "running",
        input_data: input,
      })
      .select()
      .single()

    if (execError || !execution) {
      await ContextService.endSession(session.id, "failed")
      throw new Error(`Failed to create execution: ${execError?.message}`)
    }

    await ContextService.logEvent(session.id, "execution_started", {
      execution_id: execution.id,
      agent_id: agentId,
    })

    try {
      // Get agent configuration
      const { data: agent } = await supabase.from("ai_agents").select("*").eq("id", agentId).single()

      if (!agent) {
        throw new Error("Agent not found")
      }

      await ContextService.storeContext(session.id, "agent_config", agent.config, 8)

      const memories = await MemoryService.getMemories(agentId, undefined, 10)
      const memoryContext = memories.reduce(
        (acc, m) => ({
          ...acc,
          [`${m.memory_type}_${m.id}`]: m.content,
        }),
        {},
      )

      await ContextService.storeContext(session.id, "agent_memories", memoryContext, 7)

      const pendingHandoffs = await HandoffService.getPendingHandoffs(agentId)
      if (pendingHandoffs.length > 0) {
        await ContextService.logEvent(session.id, "handoffs_detected", {
          count: pendingHandoffs.length,
        })
      }

      // Execute agent logic based on type
      const result = await this.runAgentLogic(agent, input, memoryContext, session.id)

      const duration = Date.now() - startTime

      if (result.success) {
        await MemoryService.storeMemory(
          agentId,
          "episodic",
          `Successfully executed ${agent.name}: ${JSON.stringify(result.output).substring(0, 200)}`,
          {
            execution_id: execution.id,
            duration_ms: duration,
            output_summary: result.output,
          },
          0.9,
        )
      }

      // Update execution with results
      const { data: updatedExecution } = await supabase
        .from("ai_agent_executions")
        .update({
          status: "completed",
          output_data: result.output,
          duration_ms: duration,
          completed_at: new Date().toISOString(),
        })
        .eq("id", execution.id)
        .select()
        .single()

      await ContextService.logEvent(session.id, "execution_completed", {
        execution_id: execution.id,
        duration_ms: duration,
        output: result.output,
      })
      await ContextService.endSession(session.id, "completed")

      // Log success
      await this.log(agentId, execution.id, "info", `Agent executed successfully in ${duration}ms`)

      // Update agent last_run
      await supabase.from("ai_agents").update({ last_run: new Date().toISOString() }).eq("id", agentId)

      const compactedCount = await ContextService.compactContext(session.id)
      if (compactedCount > 0) {
        await this.log(agentId, execution.id, "debug", `Compacted ${compactedCount} context items`)
      }

      return updatedExecution!
    } catch (error: any) {
      // Update execution with error
      await supabase
        .from("ai_agent_executions")
        .update({
          status: "failed",
          error_message: error.message,
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        })
        .eq("id", execution.id)

      await MemoryService.storeMemory(
        agentId,
        "episodic",
        `Failed execution: ${error.message}`,
        {
          execution_id: execution.id,
          error: error.message,
        },
        0.8,
      )

      await ContextService.logEvent(session.id, "execution_failed", {
        execution_id: execution.id,
        error: error.message,
      })
      await ContextService.endSession(session.id, "failed")

      // Log error
      await this.log(agentId, execution.id, "error", `Agent execution failed: ${error.message}`)

      throw error
    }
  }

  /**
   * Run agent-specific logic with session tracking
   */
  private static async runAgentLogic(
    agent: AIAgent,
    input: Record<string, any>,
    memory: Record<string, any>,
    sessionId: string,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now()

    try {
      switch (agent.type) {
        case "maintenance":
          return await this.runMaintenanceAgent(input, memory, sessionId, agent.id)
        case "issue_resolution":
          return await this.runIssueResolutionAgent(input, memory, sessionId, agent.id)
        case "documentation":
          return await this.runDocumentationAgent(input, memory, sessionId, agent.id)
        case "communication":
          return await this.runCommunicationAgent(input, memory, sessionId, agent.id)
        case "execution":
          return await this.runExecutionAgent(input, memory, sessionId, agent.id)
        default:
          throw new Error(`Unknown agent type: ${agent.type}`)
      }
    } finally {
      const duration = Date.now() - startTime
      console.log("[v0] Agent logic completed in:", duration, "ms")
    }
  }

  /**
   * Maintenance Scheduler Agent with context tracking and handoffs
   */
  private static async runMaintenanceAgent(
    input: Record<string, any>,
    memory: Record<string, any>,
    sessionId: string,
    agentId: string,
  ): Promise<AgentExecutionResult> {
    const supabase = await createClient()

    await ContextService.logEvent(sessionId, "analyzing_maintenance_tasks", {})

    // Get all pending maintenance tasks
    const { data: tasks } = await supabase
      .from("maintenance_tasks")
      .select("*, assets(*)")
      .eq("status", "pending")
      .is("next_run", null)

    await ContextService.storeContext(sessionId, "pending_tasks", { count: tasks?.length || 0, tasks }, 6)

    let optimizedCount = 0

    // Optimize scheduling for tasks without next_run
    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        const nextRun = new Date()
        nextRun.setDate(nextRun.getDate() + 7) // Schedule 7 days from now

        await supabase
          .from("maintenance_tasks")
          .update({ next_run: nextRun.toISOString().split("T")[0] })
          .eq("id", task.id)

        optimizedCount++
      }

      await ContextService.logEvent(sessionId, "tasks_optimized", { count: optimizedCount })
    }

    return {
      success: true,
      output: {
        tasksOptimized: optimizedCount,
        message: `Optimized ${optimizedCount} maintenance tasks`,
      },
      duration: 0,
    }
  }

  /**
   * Issue Resolution Agent with context tracking and smart handoffs
   */
  private static async runIssueResolutionAgent(
    input: Record<string, any>,
    memory: Record<string, any>,
    sessionId: string,
    agentId: string,
  ): Promise<AgentExecutionResult> {
    const supabase = await createClient()

    await ContextService.logEvent(sessionId, "analyzing_issues", {})

    // Get all open issues
    const { data: issues } = await supabase.from("issues").select("*, assets(*)").eq("status", "open")

    await ContextService.storeContext(sessionId, "open_issues", { count: issues?.length || 0, issues }, 7)

    let analyzedCount = 0

    if (issues && issues.length > 0) {
      // For each issue, determine if it needs a maintenance task or handoff
      for (const issue of issues) {
        if (issue.assets && issue.assets.is_critical) {
          // Create maintenance task for critical asset issues
          await supabase.from("maintenance_tasks").insert({
            asset_id: issue.asset_id,
            title: `Fix: ${issue.description?.substring(0, 50)}`,
            description: `Auto-generated from issue: ${issue.description}`,
            status: "pending",
            next_run: new Date().toISOString().split("T")[0],
          })

          const maintenanceAgentId = await HandoffService.suggestHandoff("maintenance_required", {
            issue_id: issue.id,
            asset_critical: true,
          })

          if (maintenanceAgentId) {
            await HandoffService.createHandoff(
              sessionId,
              agentId,
              maintenanceAgentId,
              "Critical asset requires maintenance scheduling",
              {
                issue_id: issue.id,
                asset_id: issue.asset_id,
                description: issue.description,
              },
            )
          }

          analyzedCount++
        }
      }

      await ContextService.logEvent(sessionId, "issues_resolved", { tasks_created: analyzedCount })
    }

    return {
      success: true,
      output: {
        issuesAnalyzed: issues?.length || 0,
        tasksCreated: analyzedCount,
        message: `Analyzed ${issues?.length || 0} issues, created ${analyzedCount} maintenance tasks`,
      },
      duration: 0,
    }
  }

  /**
   * Documentation Generator Agent
   */
  private static async runDocumentationAgent(
    input: Record<string, any>,
    memory: Record<string, any>,
    sessionId: string,
    agentId: string,
  ): Promise<AgentExecutionResult> {
    return {
      success: true,
      output: {
        message: "Documentation generation ready for implementation",
      },
      duration: 0,
    }
  }

  /**
   * Communication Alert Agent
   */
  private static async runCommunicationAgent(
    input: Record<string, any>,
    memory: Record<string, any>,
    sessionId: string,
    agentId: string,
  ): Promise<AgentExecutionResult> {
    return {
      success: true,
      output: {
        message: "Communication alerts ready for implementation",
      },
      duration: 0,
    }
  }

  /**
   * Task Execution Agent
   */
  private static async runExecutionAgent(
    input: Record<string, any>,
    memory: Record<string, any>,
    sessionId: string,
    agentId: string,
  ): Promise<AgentExecutionResult> {
    return {
      success: true,
      output: {
        message: "Task execution ready for implementation",
      },
      duration: 0,
    }
  }

  /**
   * Log agent activity
   */
  static async log(
    agentId: string,
    executionId: string | null,
    level: "debug" | "info" | "warn" | "error",
    message: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    const supabase = await createClient()

    await supabase.from("ai_operation_logs").insert({
      agent_id: agentId,
      execution_id: executionId,
      log_level: level,
      message,
      metadata,
    })
  }

  /**
   * Store agent memory
   */
  static async storeMemory(
    agentId: string,
    memoryType: "short_term" | "long_term" | "context",
    content: Record<string, any>,
    expiresInDays?: number,
  ): Promise<void> {
    const supabase = await createClient()

    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null

    await supabase.from("ai_agent_memory").insert({
      agent_id: agentId,
      memory_type: memoryType,
      content,
      expires_at: expiresAt,
    })
  }
}
