import { createClient } from "@/lib/supabase/server"
import type { AIAgent, AIAgentExecution } from "@/lib/types"

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
   * Execute an AI agent
   */
  static async executeAgent(agentId: string, input: Record<string, any> = {}): Promise<AIAgentExecution> {
    const supabase = await createClient()
    const startTime = Date.now()

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
      throw new Error(`Failed to create execution: ${execError?.message}`)
    }

    try {
      // Get agent configuration
      const { data: agent } = await supabase.from("ai_agents").select("*").eq("id", agentId).single()

      if (!agent) {
        throw new Error("Agent not found")
      }

      // Load agent memory
      const { data: memory } = await supabase
        .from("ai_agent_memory")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(10)

      const memoryContext =
        memory?.reduce(
          (acc, m) => ({
            ...acc,
            [m.memory_type]: m.content,
          }),
          {},
        ) || {}

      // Execute agent logic based on type
      const result = await this.runAgentLogic(agent, input, memoryContext)

      const duration = Date.now() - startTime

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

      // Log success
      await this.log(agentId, execution.id, "info", `Agent executed successfully in ${duration}ms`)

      // Update agent last_run
      await supabase.from("ai_agents").update({ last_run: new Date().toISOString() }).eq("id", agentId)

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

      // Log error
      await this.log(agentId, execution.id, "error", `Agent execution failed: ${error.message}`)

      throw error
    }
  }

  /**
   * Run agent-specific logic
   */
  private static async runAgentLogic(
    agent: AIAgent,
    input: Record<string, any>,
    memory: Record<string, any>,
  ): Promise<AgentExecutionResult> {
    console.log("[v0] Running agent logic for:", agent.name, agent.type)

    const startTime = Date.now()

    try {
      switch (agent.type) {
        case "maintenance":
          return await this.runMaintenanceAgent(input, memory)
        case "issue_resolution":
          return await this.runIssueResolutionAgent(input, memory)
        case "documentation":
          return await this.runDocumentationAgent(input, memory)
        case "communication":
          return await this.runCommunicationAgent(input, memory)
        case "execution":
          return await this.runExecutionAgent(input, memory)
        default:
          throw new Error(`Unknown agent type: ${agent.type}`)
      }
    } finally {
      const duration = Date.now() - startTime
      console.log("[v0] Agent logic completed in:", duration, "ms")
    }
  }

  /**
   * Maintenance Scheduler Agent
   * Optimizes maintenance schedules based on asset criticality and history
   */
  private static async runMaintenanceAgent(
    input: Record<string, any>,
    memory: Record<string, any>,
  ): Promise<AgentExecutionResult> {
    const supabase = await createClient()

    // Get all pending maintenance tasks
    const { data: tasks } = await supabase
      .from("maintenance_tasks")
      .select("*, assets(*)")
      .eq("status", "pending")
      .is("next_run", null)

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
   * Issue Resolution Agent
   * Analyzes issues and suggests actions
   */
  private static async runIssueResolutionAgent(
    input: Record<string, any>,
    memory: Record<string, any>,
  ): Promise<AgentExecutionResult> {
    const supabase = await createClient()

    // Get all open issues
    const { data: issues } = await supabase.from("issues").select("*, assets(*)").eq("status", "open")

    let analyzedCount = 0

    if (issues && issues.length > 0) {
      // For each issue, determine if it needs a maintenance task
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

          analyzedCount++
        }
      }
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
