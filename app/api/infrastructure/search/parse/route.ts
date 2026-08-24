import { z } from "zod"
import { callOpenAIDirect } from "@/lib/openai/direct-response"

const requestSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
})

const searchQuerySchema = z.object({
  categories: z.array(z.enum(["internet", "water", "electricity"])).default([]),
  statuses: z.array(z.enum(["active", "planned", "maintenance", "inactive"])).default([]),
  priorities: z.array(z.enum(["low", "normal", "high", "critical"])).default([]),
  locations: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  dateRange: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
})

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start < 0 || end < start) throw new Error("OpenAI did not return a JSON object")
  return JSON.parse(trimmed.slice(start, end + 1))
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ error: "Invalid search query" }, { status: 400 })

    const result = await callOpenAIDirect({
      system: `You parse natural-language infrastructure searches for Blackswan Facility Core.
Return ONLY one valid JSON object. No markdown and no explanation.
Allowed categories: internet, water, electricity.
Allowed statuses: active, planned, maintenance, inactive.
Allowed priorities: low, normal, high, critical.
Extract location names, useful search keywords, and optional ISO date range when explicitly present.
Use empty arrays when a filter is not mentioned. Never invent filters that are not supported by the user's wording.`,
      messages: [{ role: "user", content: parsed.data.query }],
      context: {
        schema: {
          categories: "array",
          statuses: "array",
          priorities: "array",
          locations: "array of strings",
          keywords: "array of strings",
          dateRange: "optional {start?: string, end?: string}",
        },
      },
    })

    const structured = searchQuerySchema.safeParse(parseJsonObject(result.text))
    if (!structured.success) {
      console.error("[infrastructure-search] invalid OpenAI parse", structured.error.flatten())
      return Response.json({ error: "Unable to parse search filters" }, { status: 502 })
    }

    return Response.json({ query: structured.data })
  } catch (error) {
    console.error("[infrastructure-search] direct OpenAI parse failed", error)
    return Response.json({ error: "Unable to parse search query" }, { status: 500 })
  }
}
