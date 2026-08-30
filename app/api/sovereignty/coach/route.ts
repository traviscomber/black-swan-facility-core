import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { callOpenAIDirect, type DirectChatMessage } from "@/lib/openai/direct-response"

export const maxDuration = 30

const requestSchema = z.object({
  locale: z.enum(["en", "es", "de"]).default("en"),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(8_000),
  })).min(1).max(24),
})

const languageInstruction = {
  en: "Respond in English.",
  es: "Responde en español natural y profesional.",
  de: "Antworte in natürlichem, professionellem Deutsch.",
} as const

export async function POST(req: Request) {
  try {
    const parsed = requestSchema.safeParse(await req.json())
    if (!parsed.success) return Response.json({ error: "INVALID_CHAT_PAYLOAD" }, { status: 400 })

    const supabase = await createClient()
    const [metricsResult, dependenciesResult, timelineResult] = await Promise.all([
      supabase.from("sovereignty_metrics").select("category, metric_name, unit, current_value, target_value, self_sufficiency_percentage, last_updated, notes").order("category", { ascending: true }),
      supabase.from("sovereignty_dependencies").select("category, dependency_name, status, risk_level, criticality, mitigation_strategy").eq("status", "active").order("risk_level", { ascending: false }),
      supabase.from("sovereignty_timeline").select("event_date, event_type, title, description, impact_area, before_percentage, after_percentage").order("event_date", { ascending: false }).limit(20),
    ])

    const dataError = metricsResult.error ?? dependenciesResult.error ?? timelineResult.error
    if (dataError) {
      console.error("[sovereignty-coach] context query failed", dataError)
      return Response.json({ error: "SOVEREIGNTY_CONTEXT_UNAVAILABLE" }, { status: 500 })
    }

    const metrics = metricsResult.data ?? []
    const dependencies = dependenciesResult.data ?? []
    const categoryAverages = metrics.reduce<Record<string, { total: number; count: number; average: number }>>((acc, metric) => {
      const category = metric.category || "Uncategorized"
      const current = acc[category] ?? { total: 0, count: 0, average: 0 }
      current.total += Number(metric.self_sufficiency_percentage ?? 0)
      current.count += 1
      current.average = current.count ? current.total / current.count : 0
      acc[category] = current
      return acc
    }, {})

    const overallAverage = metrics.length ? metrics.reduce((sum, metric) => sum + Number(metric.self_sufficiency_percentage ?? 0), 0) / metrics.length : 0
    const context = {
      generatedAt: new Date().toISOString(),
      sourceTables: ["sovereignty_metrics", "sovereignty_dependencies", "sovereignty_timeline"],
      metrics,
      summary: {
        overallAverage,
        categoryAverages,
        activeDependencies: dependencies.length,
        highRiskDependencies: dependencies.filter((item) => item.risk_level === "high").length,
        criticalDependencies: dependencies.filter((item) => item.criticality === "critical").length,
      },
      dependencies,
      recentTimeline: timelineResult.data ?? [],
    }

    const result = await callOpenAIDirect({
      system: `You are the internal Sovereignty Coach for Blackswan Facility Core.
Use only the authorized application context supplied by the server for factual claims about current metrics, dependencies, dates, progress, or targets.
Do not invent measurements, progress, savings, percentages, deadlines, or completed work.
Clearly distinguish current records from plans, targets, assumptions, and recommendations.
Prioritize practical actions by impact, operational risk, dependency reduction, and effort.
If data is missing or stale, state that directly instead of filling gaps.
Keep the answer concise, specific, and operational.
${languageInstruction[parsed.data.locale]}`,
      messages: parsed.data.messages as DirectChatMessage[],
      context,
    })

    return Response.json({ message: { role: "assistant", content: result.text }, meta: { model: result.model, responseId: result.responseId } })
  } catch (error) {
    console.error("[sovereignty-coach] direct OpenAI call failed", error)
    return Response.json({ error: "SOVEREIGNTY_COACH_UNAVAILABLE" }, { status: 500 })
  }
}
