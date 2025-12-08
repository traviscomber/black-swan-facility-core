// Infrastructure Search Agent
// Implements state machine pattern with LLM only for ambiguity resolution
// Following Xuanwo's AGENTS.md principles

import { createClient } from "@/lib/supabase/client"
import { generateObject } from "ai"
import { z } from "zod"

export enum SearchAgentState {
  IDLE = "idle",
  PARSING = "parsing",
  VALIDATING = "validating",
  QUERYING = "querying",
  FORMATTING = "formatting",
  COMPLETED = "completed",
  ERROR = "error",
}

const SearchQuerySchema = z.object({
  categories: z.array(z.enum(["internet", "water", "electricity"])).optional(),
  statuses: z.array(z.enum(["active", "planned", "maintenance", "inactive"])).optional(),
  priorities: z.array(z.enum(["low", "normal", "high", "critical"])).optional(),
  locations: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
})

type SearchQuery = z.infer<typeof SearchQuerySchema>

export interface SearchAgentContext {
  state: SearchAgentState
  naturalLanguageQuery: string
  parsedQuery?: SearchQuery
  results?: any[]
  error?: string
  logs: Array<{
    timestamp: string
    state: SearchAgentState
    message: string
    data?: any
  }>
}

export class InfrastructureSearchAgent {
  private context: SearchAgentContext

  constructor(naturalLanguageQuery: string) {
    this.context = {
      state: SearchAgentState.IDLE,
      naturalLanguageQuery,
      logs: [],
    }
  }

  async execute(): Promise<SearchAgentContext> {
    try {
      await this.transitionTo(SearchAgentState.PARSING)
      await this.parseQuery()

      await this.transitionTo(SearchAgentState.VALIDATING)
      await this.validateQuery()

      await this.transitionTo(SearchAgentState.QUERYING)
      await this.executeQuery()

      await this.transitionTo(SearchAgentState.FORMATTING)
      await this.formatResults()

      await this.transitionTo(SearchAgentState.COMPLETED)
      return this.context
    } catch (error: any) {
      await this.transitionTo(SearchAgentState.ERROR)
      this.context.error = error.message
      this.log("Error occurred", { error: error.message })
      return this.context
    }
  }

  private async parseQuery(): Promise<void> {
    this.log("Starting natural language parsing with LLM")

    try {
      const { object } = await generateObject({
        model: "openai/gpt-4o-mini",
        schema: SearchQuerySchema,
        prompt: `You are a query parser for an infrastructure management system. 
        Parse the following natural language query into structured search parameters.
        
        Available categories: internet, water, electricity
        Available statuses: active, planned, maintenance, inactive
        Available priorities: low, normal, high, critical
        
        Natural language query: "${this.context.naturalLanguageQuery}"
        
        Extract:
        - categories: Which infrastructure types to search (internet/water/electricity)
        - statuses: Infrastructure status filters
        - priorities: Priority levels to filter by
        - locations: Location names mentioned (e.g., "Clubhouse", "North Access")
        - keywords: Any specific equipment or feature keywords
        - dateRange: Any date-related filters for inspections
        
        Return empty arrays if no specific filters mentioned.`,
      })

      this.context.parsedQuery = object
      this.log("Query parsed successfully", { parsedQuery: object })
    } catch (error: any) {
      this.log("LLM parsing failed", { error: error.message })
      throw new Error(`Failed to parse query: ${error.message}`)
    }
  }

  private async validateQuery(): Promise<void> {
    this.log("Validating parsed query")

    if (!this.context.parsedQuery) {
      throw new Error("No parsed query to validate")
    }

    try {
      // Schema validation already done by zod, but we can add business rules
      const parsed = this.context.parsedQuery

      // Check if query is too broad (would return everything)
      const hasFilters =
        (parsed.categories && parsed.categories.length > 0) ||
        (parsed.statuses && parsed.statuses.length > 0) ||
        (parsed.priorities && parsed.priorities.length > 0) ||
        (parsed.locations && parsed.locations.length > 0) ||
        (parsed.keywords && parsed.keywords.length > 0)

      if (!hasFilters) {
        this.log("Query validated - no filters specified, will return all")
      } else {
        this.log("Query validated successfully", { filterCount: this.countFilters(parsed) })
      }
    } catch (error: any) {
      throw new Error(`Validation failed: ${error.message}`)
    }
  }

  private async executeQuery(): Promise<void> {
    this.log("Executing deterministic database query")

    const supabase = createClient()
    const parsed = this.context.parsedQuery!

    try {
      let query = supabase.from("infrastructure_plans").select(
        `
          *,
          infrastructure_photos(count),
          infrastructure_documents(count)
        `,
      )

      // Apply filters deterministically
      if (parsed.categories && parsed.categories.length > 0) {
        query = query.in("category", parsed.categories)
        this.log("Applied category filter", { categories: parsed.categories })
      }

      if (parsed.statuses && parsed.statuses.length > 0) {
        query = query.in("status", parsed.statuses)
        this.log("Applied status filter", { statuses: parsed.statuses })
      }

      if (parsed.priorities && parsed.priorities.length > 0) {
        query = query.in("priority", parsed.priorities)
        this.log("Applied priority filter", { priorities: parsed.priorities })
      }

      // Location filter (need to join with locations table)
      if (parsed.locations && parsed.locations.length > 0) {
        // First get location IDs
        const { data: locationData } = await supabase.from("locations").select("id").in("name", parsed.locations)

        if (locationData && locationData.length > 0) {
          const locationIds = locationData.map((l) => l.id)
          query = query.in("location_id", locationIds)
          this.log("Applied location filter", { locations: parsed.locations, locationIds })
        }
      }

      // Keyword search in name, description, notes
      if (parsed.keywords && parsed.keywords.length > 0) {
        // Use OR condition for keywords
        const keywordConditions = parsed.keywords
          .map((keyword) => `name.ilike.%${keyword}%,description.ilike.%${keyword}%,notes.ilike.%${keyword}%`)
          .join(",")

        query = query.or(keywordConditions)
        this.log("Applied keyword filter", { keywords: parsed.keywords })
      }

      // Date range filter for inspections
      if (parsed.dateRange) {
        if (parsed.dateRange.start) {
          query = query.gte("next_inspection", parsed.dateRange.start)
          this.log("Applied date filter (start)", { start: parsed.dateRange.start })
        }
        if (parsed.dateRange.end) {
          query = query.lte("next_inspection", parsed.dateRange.end)
          this.log("Applied date filter (end)", { end: parsed.dateRange.end })
        }
      }

      // Execute query
      const { data, error } = await query

      if (error) {
        throw new Error(`Database query failed: ${error.message}`)
      }

      this.context.results = data || []
      this.log("Query executed successfully", { resultCount: data?.length || 0 })
    } catch (error: any) {
      throw new Error(`Query execution failed: ${error.message}`)
    }
  }

  private async formatResults(): Promise<void> {
    this.log("Formatting results")

    if (!this.context.results) {
      this.context.results = []
      return
    }

    // Add location names to results
    const supabase = createClient()
    const locationIds = [...new Set(this.context.results.map((r) => r.location_id).filter(Boolean))]

    if (locationIds.length > 0) {
      const { data: locations } = await supabase.from("locations").select("id, name").in("id", locationIds)

      const locationMap = new Map(locations?.map((l) => [l.id, l.name]) || [])

      this.context.results = this.context.results.map((result) => ({
        ...result,
        location_name: result.location_id ? locationMap.get(result.location_id) : null,
      }))
    }

    this.log("Results formatted", { count: this.context.results.length })
  }

  private async transitionTo(newState: SearchAgentState): Promise<void> {
    const oldState = this.context.state
    this.context.state = newState
    this.log(`State transition: ${oldState} → ${newState}`)
  }

  private log(message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      state: this.context.state,
      message,
      data,
    }
    this.context.logs.push(logEntry)
    console.log(`[v0] [InfrastructureSearchAgent] [${this.context.state}] ${message}`, data || "")
  }

  private countFilters(query: SearchQuery): number {
    let count = 0
    if (query.categories && query.categories.length > 0) count++
    if (query.statuses && query.statuses.length > 0) count++
    if (query.priorities && query.priorities.length > 0) count++
    if (query.locations && query.locations.length > 0) count++
    if (query.keywords && query.keywords.length > 0) count++
    if (query.dateRange) count++
    return count
  }

  // Public getter for state
  getState(): SearchAgentState {
    return this.context.state
  }

  // Public getter for results
  getResults(): any[] {
    return this.context.results || []
  }

  // Public getter for logs (observability)
  getLogs(): SearchAgentContext["logs"] {
    return this.context.logs
  }
}
