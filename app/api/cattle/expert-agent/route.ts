import { convertToModelMessages, type InferUITools, streamText, tool, type UIMessage, validateUIMessages } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 30

// Tools for cattle management expert
const cattleTools = {
  getProfitabilityAnalysis: tool({
    description: "Analyze profitability for Crianza (Breeding) or Engorda (Fattening) business units",
    inputSchema: z.object({
      businessUnit: z.enum(["Crianza", "Engorda", "Both"]).describe("Which business unit to analyze"),
    }),
    async *execute({ businessUnit }) {
      yield { state: "loading" as const }

      // Get cattle business plan data
      const supabase = await createClient()
      let query = supabase
        .from("cattle_business_plan")
        .select("*")
        .order("year", { ascending: true })
        .order("month", { ascending: true })

      if (businessUnit !== "Both") {
        query = query.eq("business_unit", businessUnit)
      }

      const { data } = await query

      if (!data) {
        yield {
          state: "ready" as const,
          analysis: "No data available",
        }
        return
      }

      // Calculate profitability metrics
      const totalRevenue = data.reduce((sum, row) => sum + (row.sales_amount || 0), 0)
      const totalCosts = data.reduce((sum, row) => sum + (row.operational_cost || 0), 0)
      const totalProfit = totalRevenue - totalCosts
      const marginPercentage = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

      yield {
        state: "ready" as const,
        analysis: {
          businessUnit,
          totalRevenue: `$${totalRevenue.toLocaleString()}`,
          totalCosts: `$${totalCosts.toLocaleString()}`,
          totalProfit: `$${totalProfit.toLocaleString()}`,
          marginPercentage: `${marginPercentage.toFixed(2)}%`,
          monthsAnalyzed: data.length,
        },
      }
    },
  }),

  getBreakEvenAnalysis: tool({
    description: "Calculate break-even timeline for the cattle business",
    inputSchema: z.object({}),
    async *execute() {
      yield { state: "loading" as const }

      const supabase = await createClient()
      const { data } = await supabase
        .from("cattle_business_plan")
        .select("*")
        .order("year", { ascending: true })
        .order("month", { ascending: true })

      if (!data) {
        yield { state: "ready" as const, timeline: "No data available" }
        return
      }

      // Find break-even point (cumulative profit becomes positive)
      let cumulativeProfit = 0
      let breakEvenMonth = null
      let breakEvenYear = null

      for (const record of data) {
        const monthProfit = (record.sales_amount || 0) - (record.operational_cost || 0)
        cumulativeProfit += monthProfit

        if (cumulativeProfit >= 0 && !breakEvenMonth) {
          breakEvenMonth = record.month
          breakEvenYear = record.year
          break
        }
      }

      yield {
        state: "ready" as const,
        timeline: {
          breakEvenMonth,
          breakEvenYear,
          message: breakEvenMonth
            ? `Break-even achieved in ${breakEvenMonth} ${breakEvenYear}`
            : "Break-even not reached in current projections",
          currentCumulativeProfit: `$${cumulativeProfit.toLocaleString()}`,
        },
      }
    },
  }),

  getCostOptimizationTips: tool({
    description: "Get recommendations for optimizing operational costs in cattle farming",
    inputSchema: z.object({
      businessUnit: z.enum(["Crianza", "Engorda"]).describe("Business unit to optimize"),
    }),
    async *execute({ businessUnit }) {
      yield { state: "loading" as const }

      const supabase = await createClient()

      // Get operational costs
      const { data: costs } = await supabase
        .from("cattle_operational_costs")
        .select("*")
        .eq("business_unit", businessUnit === "Crianza" ? "Crianza" : null)

      // Get pricing data for context
      const { data: pricing } = await supabase
        .from("cattle_pricing")
        .select("*")
        .eq("category", businessUnit === "Crianza" ? "Breeding" : "Fattening")

      yield {
        state: "ready" as const,
        recommendations: {
          unit: businessUnit,
          tips: [
            businessUnit === "Crianza"
              ? "Optimize pasture rotation to maximize grazing efficiency and reduce supplemental feeding costs"
              : "Implement precision feeding programs to reduce feed waste and improve feed conversion rates",
            "Monitor animal health regularly to prevent costly disease outbreaks",
            "Consider genetic improvement through selective breeding to enhance meat quality and growth rates",
            businessUnit === "Crianza"
              ? "Establish breeding records to identify best-performing animals and reduce poor-performing ones"
              : "Optimize fattening duration to balance market timing with weight gain economics",
            "Reduce operational costs through bulk purchasing of feed and veterinary supplies",
          ],
          currentCosts: costs?.length || 0,
          availablePricing: pricing?.length || 0,
        },
      }
    },
  }),

  getAnimalHealthAdvisor: tool({
    description: "Get health management advice for cattle operations",
    inputSchema: z.object({
      concern: z.string().describe("Health concern or question about animals"),
    }),
    async *execute({ concern }) {
      yield { state: "loading" as const }

      // Provide AI-powered health advice based on concern
      yield {
        state: "ready" as const,
        advice: {
          concern,
          recommendations: [
            "Implement regular health monitoring and record-keeping system",
            "Vaccinate animals according to recommended schedules",
            "Maintain proper nutrition and water quality",
            "Implement biosecurity measures to prevent disease spread",
            "Consult with veterinarian for specific health issues",
            "Monitor for signs of stress or environmental issues",
          ],
          mortalityRate: "0.95% (based on your plan)",
          actionItems: "Review your health management protocols quarterly and adjust based on performance metrics",
        },
      }
    },
  }),

  getBreedingStrategy: tool({
    description: "Get breeding recommendations for your cattle operation",
    inputSchema: z.object({
      timeframe: z.enum(["short-term", "medium-term", "long-term"]).describe("Planning timeframe"),
    }),
    async *execute({ timeframe }) {
      yield { state: "loading" as const }

      const supabase = await createClient()
      const { data: pricing } = await supabase.from("cattle_pricing").select("*").eq("category", "Breeding")

      yield {
        state: "ready" as const,
        strategy: {
          timeframe,
          recommendations: {
            "short-term":
              "Focus on maximizing current breeding efficiency and conception rates. Ensure proper nutrition for pregnant animals.",
            "medium-term":
              "Begin selective breeding for desired traits (growth, meat quality). Gradually improve genetics.",
            "long-term":
              "Establish closed herd breeding program. Build bloodlines for superior traits and market value.",
          }[timeframe],
          currentBreedingCapacity: "500 animals (Año 4 milestone)",
          breedTypes: pricing?.map((p) => p.animal_type) || [],
          nextSteps: [
            "Assess current genetic quality of breeding stock",
            "Define breeding goals aligned with market demands",
            "Implement AI (Artificial Insemination) if viable",
            "Maintain detailed breeding records",
            "Plan for genetic testing/evaluation",
          ],
        },
      }
    },
  }),
}

export type CattleExpertMessage = UIMessage<never, any, InferUITools<typeof cattleTools>>

export async function POST(req: Request) {
  const body = await req.json()

  const messages = await validateUIMessages<CattleExpertMessage>({
    messages: body.messages,
    tools: cattleTools,
  })

  const result = streamText({
    model: "openai/gpt-4o-mini",
    system: `You are an expert Cattle Management advisor for Black Swan Facility. You have access to real-time data about the cattle business plan including:
    
    - 8-year business projections (2024-2031)
    - Two business units: Crianza (Breeding) and Engorda (Fattening)
    - Current pricing and operational costs
    - Key milestones: 500 animals in Año 4 Marzo, $140M profit target by Año 8 Diciembre
    
    Use the available tools to provide data-driven advice on:
    1. Profitability analysis and cost optimization
    2. Break-even timelines and financial projections
    3. Animal health and breeding strategies
    4. Operational improvements and risk management
    
    Always provide specific, actionable recommendations based on actual business data. Be professional but conversational.`,
    messages: convertToModelMessages(messages),
    tools: cattleTools,
  })

  return result.toUIMessageStreamResponse()
}
