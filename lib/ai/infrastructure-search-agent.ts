// Infrastructure Search Agent
// Deterministic state machine; ambiguity parsing is delegated to a server route
// that calls the OpenAI Responses API directly.

import { createClient } from "@/lib/supabase/client"
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
  dateRange: z.object({ start: z.string().optional(), end: z.string().optional() }).optional(),
})

type SearchQuery = z.infer<typeof SearchQuerySchema>
type InfrastructureSearchResult = Record<string, unknown> & { location_id?: string | null }

export interface SearchAgentContext {
  state: SearchAgentState
  naturalLanguageQuery: string
  parsedQuery?: SearchQuery
  results?: InfrastructureSearchResult[]
  error?: string
  logs: Array<{
    timestamp: string
    state: SearchAgentState
    message: string
    data?: unknown
  }>
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
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
    } catch (error) {
      await this.transitionTo(SearchAgentState.ERROR)
      this.context.error = errorMessage(error)
      this.log("Error occurred", { error: errorMessage(error) })
      return this.context
    }
  }

  private async parseQuery(): Promise<void> {
    this.log("Parsing natural language through server OpenAI route")

    const response = await fetch("/api/infrastructure/search/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: this.context.naturalLanguageQuery }),
    })
    const payload = (await response.json().catch(() => ({}))) as { query?: unknown; error?: string }
    if (!response.ok) throw new Error(payload.error || `Search parser failed with HTTP ${response.status}`)

    const parsed = SearchQuerySchema.safeParse(payload.query)
    if (!parsed.success) throw new Error("Search parser returned invalid filters")

    this.context.parsedQuery = parsed.data
    this.log("Query parsed successfully", { parsedQuery: parsed.data })
  }

  private async validateQuery(): Promise<void> {
    this.log("Validating parsed query")
    if (!this.context.parsedQuery) throw new Error("No parsed query to validate")

    const parsed = this.context.parsedQuery
    const hasFilters =
      Boolean(parsed.categories?.length)
      || Boolean(parsed.statuses?.length)
      || Boolean(parsed.priorities?.length)
      || Boolean(parsed.locations?.length)
      || Boolean(parsed.keywords?.length)

    if (!hasFilters) this.log("Query validated - no filters specified, will return all")
    else this.log("Query validated successfully", { filterCount: this.countFilters(parsed) })
  }

  private async executeQuery(): Promise<void> {
    this.log("Executing deterministic database query")

    const supabase = createClient()
    const parsed = this.context.parsedQuery
    if (!parsed) throw new Error("No parsed query available")

    try {
      let query = supabase.from("infrastructure_plans").select(`
        *,
        infrastructure_photos(count),
        infrastructure_documents(count)
      `)

      if (parsed.categories?.length) {
        query = query.in("category", parsed.categories)
        this.log("Applied category filter", { categories: parsed.categories })
      }

      if (parsed.statuses?.length) {
        query = query.in("status", parsed.statuses)
        this.log("Applied status filter", { statuses: parsed.statuses })
      }

      if (parsed.priorities?.length) {
        query = query.in("priority", parsed.priorities)
        this.log("Applied priority filter", { priorities: parsed.priorities })
      }

      if (parsed.locations?.length) {
        const { data: locationData, error: locationError } = await supabase
          .from("locations")
          .select("id")
          .in("name", parsed.locations)

        if (locationError) throw locationError
        if (locationData?.length) {
          const locationIds = locationData.map((location) => location.id)
          query = query.in("location_id", locationIds)
          this.log("Applied location filter", { locations: parsed.locations, locationIds })
        }
      }

      if (parsed.keywords?.length) {
        const keywordConditions = parsed.keywords
          .map((keyword) => {
            const safeKeyword = keyword.replace(/[,%()]/g, " ").trim()
            return `name.ilike.%${safeKeyword}%,description.ilike.%${safeKeyword}%,notes.ilike.%${safeKeyword}%`
          })
          .filter(Boolean)
          .join(",")
        if (keywordConditions) query = query.or(keywordConditions)
        this.log("Applied keyword filter", { keywords: parsed.keywords })
      }

      if (parsed.dateRange?.start) {
        query = query.gte("next_inspection", parsed.dateRange.start)
        this.log("Applied date filter (start)", { start: parsed.dateRange.start })
      }
      if (parsed.dateRange?.end) {
        query = query.lte("next_inspection", parsed.dateRange.end)
        this.log("Applied date filter (end)", { end: parsed.dateRange.end })
      }

      const { data, error } = await query
      if (error) throw new Error(`Database query failed: ${error.message}`)

      this.context.results = (data ?? []) as InfrastructureSearchResult[]
      this.log("Query executed successfully", { resultCount: data?.length ?? 0 })
    } catch (error) {
      throw new Error(`Query execution failed: ${errorMessage(error)}`)
    }
  }

  private async formatResults(): Promise<void> {
    this.log("Formatting results")
    if (!this.context.results) {
      this.context.results = []
      return
    }

    const supabase = createClient()
    const locationIds = [...new Set(this.context.results.map((result) => result.location_id).filter((id): id is string => typeof id === "string" && id.length > 0))]

    if (locationIds.length > 0) {
      const { data: locations, error } = await supabase.from("locations").select("id, name").in("id", locationIds)
      if (error) throw new Error(`Failed to resolve locations: ${error.message}`)
      const locationMap = new Map((locations ?? []).map((location) => [location.id, location.name]))
      this.context.results = this.context.results.map((result) => ({
        ...result,
        location_name: result.location_id ? locationMap.get(result.location_id) ?? null : null,
      }))
    }

    this.log("Results formatted", { count: this.context.results.length })
  }

  private async transitionTo(newState: SearchAgentState): Promise<void> {
    const oldState = this.context.state
    this.context.state = newState
    this.log(`State transition: ${oldState} → ${newState}`)
  }

  private log(message: string, data?: unknown): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      state: this.context.state,
      message,
      data,
    }
    this.context.logs.push(logEntry)
    console.log(`[InfrastructureSearchAgent] [${this.context.state}] ${message}`, data ?? "")
  }

  private countFilters(query: SearchQuery): number {
    let count = 0
    if (query.categories?.length) count++
    if (query.statuses?.length) count++
    if (query.priorities?.length) count++
    if (query.locations?.length) count++
    if (query.keywords?.length) count++
    if (query.dateRange) count++
    return count
  }

  getState(): SearchAgentState {
    return this.context.state
  }

  getResults(): InfrastructureSearchResult[] {
    return this.context.results || []
  }

  getLogs(): SearchAgentContext["logs"] {
    return this.context.logs
  }
}
