import { convertToModelMessages, type InferUITools, streamText, tool, type UIMessage, validateUIMessages } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 30

// Sovereignty Coach Tools
const sovereigntyTools = {
  analyzeSovereigntyMetrics: tool({
    description: "Analyze current sovereignty metrics across all categories to identify strengths and weaknesses",
    inputSchema: z.object({
      category: z
        .enum(["Energy", "Food", "Water", "People", "Software", "Assets", "Overall"])
        .optional()
        .describe("Specific category to analyze or Overall"),
    }),
    async *execute({ category }) {
      yield { state: "loading" as const }

      const supabase = await createClient()
      let query = supabase.from("sovereignty_metrics").select("*").order("category", { ascending: true })

      if (category && category !== "Overall") {
        query = query.eq("category", category)
      }

      const { data: metrics } = await query

      if (!metrics || metrics.length === 0) {
        yield {
          state: "ready" as const,
          analysis: "No metrics available yet. Start by setting metrics for your facility.",
        }
        return
      }

      // Calculate category averages
      const categoryAverages = metrics.reduce(
        (acc, m) => {
          const cat = m.category
          if (!acc[cat]) acc[cat] = { values: [], count: 0 }
          acc[cat].values.push(m.self_sufficiency_percentage || 0)
          acc[cat].count++
          return acc
        },
        {} as Record<string, { values: number[]; count: number }>,
      )

      const summary = Object.entries(categoryAverages).map(([cat, data]) => {
        const avg = data.values.reduce((a, b) => a + b, 0) / data.count
        const trend = avg >= 60 ? "🟢 Strong" : avg >= 30 ? "🟡 Moderate" : "🔴 Weak"
        return `${cat}: ${trend} (${avg.toFixed(1)}%)`
      })

      yield {
        state: "ready" as const,
        analysis: {
          metricsAnalyzed: metrics.length,
          summary: summary.join(" | "),
          overallAverage: (
            metrics.reduce((sum, m) => sum + (m.self_sufficiency_percentage || 0), 0) / metrics.length
          ).toFixed(1),
          categoryBreakdown: categoryAverages,
        },
      }
    },
  }),

  identifyDependencies: tool({
    description: "Identify and assess critical dependencies that limit facility sovereignty",
    inputSchema: z.object({
      riskLevel: z.enum(["high", "medium", "low", "all"]).optional().describe("Filter by risk level"),
    }),
    async *execute({ riskLevel }) {
      yield { state: "loading" as const }

      const supabase = await createClient()
      let query = supabase
        .from("sovereignty_dependencies")
        .select("*")
        .eq("status", "active")
        .order("risk_level", { ascending: false })

      if (riskLevel && riskLevel !== "all") {
        query = query.eq("risk_level", riskLevel)
      }

      const { data: dependencies } = await query

      if (!dependencies || dependencies.length === 0) {
        yield {
          state: "ready" as const,
          dependencies: "No external dependencies tracked yet.",
        }
        return
      }

      const criticalCount = dependencies.filter((d) => d.criticality === "critical").length
      const highRiskCount = dependencies.filter((d) => d.risk_level === "high").length

      yield {
        state: "ready" as const,
        dependencies: {
          total: dependencies.length,
          critical: criticalCount,
          highRisk: highRiskCount,
          byCategory: dependencies.reduce(
            (acc, d) => {
              if (!acc[d.category]) acc[d.category] = []
              acc[d.category].push(d.dependency_name)
              return acc
            },
            {} as Record<string, string[]>,
          ),
          mitigationOpportunities: dependencies.slice(0, 3).map((d) => d.mitigation_strategy),
        },
      }
    },
  }),

  getImprovementRecommendations: tool({
    description: "Get AI-powered recommendations for improving facility sovereignty in a specific area",
    inputSchema: z.object({
      area: z.enum(["Energy", "Food", "Water", "People", "Software", "Assets"]).describe("Area to improve"),
      timeframe: z.enum(["immediate", "short-term", "medium-term", "long-term"]).describe("Timeframe for improvements"),
    }),
    async *execute({ area, timeframe }) {
      yield { state: "loading" as const }

      const supabase = await createClient()

      // Get current metrics for the area
      const { data: metrics } = await supabase
        .from("sovereignty_metrics")
        .select("*")
        .eq("category", area)
        .order("self_sufficiency_percentage", { ascending: true })

      // Get dependencies for the area
      const { data: dependencies } = await supabase
        .from("sovereignty_dependencies")
        .select("*")
        .eq("category", area)
        .eq("status", "active")

      const recommendations = {
        Energy: {
          immediate: [
            "Audit current energy consumption patterns and identify inefficiencies",
            "Install basic monitoring systems to track solar production and battery status",
            "Schedule maintenance on existing renewable systems",
          ],
          "short-term": [
            "Implement energy storage optimization protocols",
            "Begin preparation for backup power system upgrades",
            "Train team on energy management best practices",
          ],
          "medium-term": [
            "Expand renewable capacity (solar, wind)",
            "Implement smart grid management systems",
            "Achieve 70%+ self-sufficiency milestone",
          ],
          "long-term": [
            "Complete energy independence with microgrids",
            "Develop surplus energy for export",
            "Achieve 100% energy sovereignty",
          ],
        },
        Food: {
          immediate: [
            "Assess current agricultural capacity and soil health",
            "Start small-scale local food production (seeds, seedlings)",
            "Map food supply chain dependencies",
          ],
          "short-term": [
            "Establish vegetable gardens and basic farming systems",
            "Begin composting and soil improvement programs",
            "Train 3-5 team members in sustainable farming",
          ],
          "medium-term": [
            "Expand to 15-20% local food production",
            "Implement water-efficient irrigation systems",
            "Develop seed saving and breeding programs",
          ],
          "long-term": [
            "Achieve 30%+ local food production",
            "Build resilient food system with multiple crops",
            "Establish food distribution network within community",
          ],
        },
        Water: {
          immediate: [
            "Audit water consumption and identify waste",
            "Install rainwater collection systems",
            "Repair any leaks in water distribution",
          ],
          "short-term": [
            "Implement greywater recycling systems",
            "Install efficient fixtures and irrigation",
            "Monitor water quality regularly",
          ],
          "medium-term": [
            "Develop water treatment capabilities",
            "Achieve 40%+ water independence",
            "Implement aquifer monitoring and protection",
          ],
          "long-term": [
            "Complete water sovereignty with multiple sources",
            "Achieve 100% water recycling capability",
            "Support water independence for surrounding communities",
          ],
        },
        People: {
          immediate: [
            "Document current team skills and expertise",
            "Identify critical knowledge gaps",
            "Start skill-sharing and cross-training programs",
          ],
          "short-term": [
            "Recruit volunteers for key skill areas",
            "Begin formal training programs in priority areas",
            "Establish peer mentoring system",
          ],
          "medium-term": [
            "Achieve 60%+ of skilled roles trained in-house",
            "Develop leadership pipeline",
            "Build self-sufficient maintenance team",
          ],
          "long-term": [
            "Achieve 80%+ staff self-sufficiency",
            "Create career development paths for growth",
            "Build external training network for community",
          ],
        },
        Software: {
          immediate: [
            "Audit current software dependencies",
            "Identify critical infrastructure being cloud-hosted",
            "Plan self-hosting migration strategy",
          ],
          "short-term": [
            "Begin migrating to self-hosted alternatives",
            "Implement local data backups",
            "Build internal IT capabilities",
          ],
          "medium-term": [
            "Achieve 60%+ systems self-hosted",
            "Establish redundant infrastructure",
            "Develop disaster recovery procedures",
          ],
          "long-term": [
            "Achieve 100% software sovereignty",
            "Build decentralized system architecture",
            "Support other facilities' software independence",
          ],
        },
        Assets: {
          immediate: [
            "Complete inventory of all assets",
            "Assess repair and maintenance capability for each",
            "Document asset criticality",
          ],
          "short-term": [
            "Build in-house repair capabilities for common items",
            "Establish spare parts library",
            "Train maintenance teams on critical assets",
          ],
          "medium-term": [
            "Achieve 50%+ assets repairable in-house",
            "Develop advanced repair skills",
            "Build supplier relationships for unavailable parts",
          ],
          "long-term": [
            "Achieve 70%+ asset repair capability",
            "Design future assets for repairability",
            "Build asset manufacturing capabilities",
          ],
        },
      }

      const categoryRecs = recommendations[area as keyof typeof recommendations]
      const timeframeRecs = categoryRecs[timeframe as keyof typeof categoryRecs] || []

      yield {
        state: "ready" as const,
        recommendations: {
          area,
          timeframe,
          recommendations: timeframeRecs,
          currentMetrics: metrics?.slice(0, 2),
          activeDependencies: dependencies?.length || 0,
          estimatedImpact: `Implementing these recommendations could improve ${area} sovereignty by 15-25% within the ${timeframe} period.`,
        },
      }
    },
  }),

  generateActionPlan: tool({
    description: "Create a prioritized action plan for reaching sovereignty targets",
    inputSchema: z.object({
      targetPercentage: z.number().min(0).max(100).describe("Target sovereignty percentage"),
      timelineMonths: z.number().min(1).max(60).describe("Timeline in months"),
    }),
    async *execute({ targetPercentage, timelineMonths }) {
      yield { state: "loading" as const }

      const supabase = await createClient()

      const { data: metrics } = await supabase
        .from("sovereignty_metrics")
        .select("*")
        .order("self_sufficiency_percentage", { ascending: true })

      const currentAverage =
        metrics && metrics.length > 0
          ? metrics.reduce((sum, m) => sum + (m.self_sufficiency_percentage || 0), 0) / metrics.length
          : 0

      const gap = targetPercentage - currentAverage
      const monthlyProgress = gap / timelineMonths

      // Group metrics by priority (lowest first = highest priority)
      const sortedMetrics =
        metrics?.sort((a, b) => (a.self_sufficiency_percentage || 0) - (b.self_sufficiency_percentage || 0)) || []

      const phases = [
        {
          phase: "Phase 1: Foundation (Months 1-4)",
          focus: "Quick wins and critical dependencies",
          metrics: sortedMetrics.slice(0, 3).map((m) => m.metric_name),
          target: currentAverage + monthlyProgress * 4,
        },
        {
          phase: "Phase 2: Expansion (Months 5-8)",
          focus: "Mid-tier improvements and scaling",
          metrics: sortedMetrics.slice(3, 5).map((m) => m.metric_name),
          target: currentAverage + monthlyProgress * 8,
        },
        {
          phase: "Phase 3: Optimization (Months 9+)",
          focus: "Integration and long-term sustainability",
          metrics: sortedMetrics.slice(5).map((m) => m.metric_name),
          target: targetPercentage,
        },
      ]

      yield {
        state: "ready" as const,
        actionPlan: {
          currentSovereignty: currentAverage.toFixed(1),
          targetSovereignty: targetPercentage,
          timelineMonths,
          requiredMonthlyProgress: monthlyProgress.toFixed(2),
          phases,
          keySuccessFactors: [
            "Consistent team alignment and commitment",
            "Regular progress tracking and adjustments",
            "Resource allocation to highest-impact areas",
            "Knowledge sharing and skill development",
            "Community support and partnerships",
          ],
        },
      }
    },
  }),
}

export type SovereigntyCoachMessage = UIMessage<never, any, InferUITools<typeof sovereigntyTools>>

export async function POST(req: Request) {
  const body = await req.json()

  const messages = await validateUIMessages<SovereigntyCoachMessage>({
    messages: body.messages,
    tools: sovereigntyTools,
  })

  const result = streamText({
    model: "openai/gpt-4o-mini",
    system: `You are an expert Sovereignty Coach for Black Swan Facility Core. Your mission is to help the team achieve complete facility independence across all systems.

You have real-time access to:
- Current sovereignty metrics for Energy, Food, Water, People, Software, and Assets
- Active external dependencies and their risk levels
- Historical progress and timeline of improvements

Your role is to:
1. Analyze current sovereignty status across all categories
2. Identify critical dependencies limiting independence
3. Provide prioritized, actionable recommendations tailored to timeframes
4. Create realistic roadmaps to achieve sovereignty targets
5. Celebrate progress and maintain momentum

Always be encouraging and solution-focused. Help the team understand that sovereignty is built incrementally through consistent effort. Provide specific, measurable recommendations. Consider resource constraints and practical implementation challenges.

Key principles:
- Start with quick wins to build momentum
- Address critical dependencies first
- Build team capability and knowledge
- Plan for long-term sustainability
- Think systems-wide (improvements in one area often support others)`,
    messages: convertToModelMessages(messages),
    tools: sovereigntyTools,
  })

  return result.toUIMessageStreamResponse()
}
