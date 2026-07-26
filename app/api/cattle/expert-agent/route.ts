import { convertToModelMessages, type InferUITools, streamText, tool, type UIMessage, validateUIMessages } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 30

const cattleTools = {
  getBusinessPlanSummary: tool({
    description: "Obtiene un resumen del plan económico ganadero registrado. Los valores son proyecciones, no resultados contables confirmados.",
    inputSchema: z.object({
      businessUnit: z.enum(["Crianza", "Engorda", "Todas"]).default("Todas"),
    }),
    async execute({ businessUnit }) {
      const supabase = await createClient()
      let query = supabase
        .from("cattle_business_plan")
        .select("month, year, business_unit, inventory_count, purchase_amount, sales_amount, operational_cost, profit_loss")
        .order("year", { ascending: true })
        .order("month", { ascending: true })

      if (businessUnit !== "Todas") query = query.eq("business_unit", businessUnit)

      const { data, error } = await query
      if (error) return { error: error.message }

      const rows = data ?? []
      const totalSales = rows.reduce((sum, row) => sum + Number(row.sales_amount ?? 0), 0)
      const totalPurchases = rows.reduce((sum, row) => sum + Number(row.purchase_amount ?? 0), 0)
      const totalOperationalCost = rows.reduce((sum, row) => sum + Number(row.operational_cost ?? 0), 0)
      const projectedResult = rows.reduce((sum, row) => sum + Number(row.profit_loss ?? 0), 0)
      const units = [...new Set(rows.map((row) => row.business_unit).filter(Boolean))]

      return {
        source: "cattle_business_plan",
        dataType: "proyección registrada",
        businessUnit,
        units,
        records: rows.length,
        period: rows.length ? { from: Math.min(...rows.map((row) => row.year)), to: Math.max(...rows.map((row) => row.year)) } : null,
        totalsClp: { sales: totalSales, purchases: totalPurchases, operationalCost: totalOperationalCost, projectedResult },
      }
    },
  }),

  getHerdHealthContext: tool({
    description: "Obtiene el contexto registrado del plantel y sus controles biométricos. No genera diagnósticos veterinarios.",
    inputSchema: z.object({}),
    async execute() {
      const supabase = await createClient()
      const [animalsResult, recordsResult, alertsResult, treatmentsResult] = await Promise.all([
        supabase.from("cattle_animals").select("id, animal_id, name, breed, gender, status"),
        supabase
          .from("cattle_biometric_records")
          .select("animal_id, test_date, bhb, total_protein, calcium, magnesium, clinical_signs, lab_notes")
          .order("test_date", { ascending: false }),
        supabase.from("cattle_health_alerts").select("*").order("created_at", { ascending: false }),
        supabase.from("cattle_treatment_plans").select("*").order("created_at", { ascending: false }),
      ])

      const error = animalsResult.error ?? recordsResult.error ?? alertsResult.error ?? treatmentsResult.error
      if (error) return { error: error.message }

      const animals = animalsResult.data ?? []
      const records = recordsResult.data ?? []
      const latestDate = records[0]?.test_date ?? null
      const latestRecords = latestDate ? records.filter((record) => record.test_date === latestDate) : []
      const observations = latestRecords
        .filter((record) => Boolean(record.clinical_signs || record.lab_notes))
        .map((record) => ({
          animalId: record.animal_id,
          testDate: record.test_date,
          clinicalSigns: record.clinical_signs,
          laboratoryNotes: record.lab_notes,
          values: {
            bhb: record.bhb,
            totalProtein: record.total_protein,
            calcium: record.calcium,
            magnesium: record.magnesium,
          },
        }))

      return {
        source: ["cattle_animals", "cattle_biometric_records", "cattle_health_alerts", "cattle_treatment_plans"],
        animalsRegistered: animals.length,
        activeAnimals: animals.filter((animal) => animal.status === "active").length,
        latestTestDate: latestDate,
        latestTestRecords: latestRecords.length,
        recordedObservations: observations,
        openAlerts: (alertsResult.data ?? []).length,
        treatmentPlans: (treatmentsResult.data ?? []).length,
        veterinaryNotice: "Las observaciones son registros existentes y deben ser interpretadas por un profesional veterinario.",
      }
    },
  }),

  getPricesAndCosts: tool({
    description: "Consulta precios y costos ganaderos registrados para apoyar análisis, sin asumir que están vigentes o validados.",
    inputSchema: z.object({
      businessUnit: z.enum(["Crianza", "Engorda", "Todas"]).default("Todas"),
    }),
    async execute({ businessUnit }) {
      const supabase = await createClient()
      const category = businessUnit === "Crianza" ? "Breeding" : businessUnit === "Engorda" ? "Fattening" : null

      let pricingQuery = supabase
        .from("cattle_pricing")
        .select("animal_type, price_pesos, unit, category, description, quantity_standard, updated_at")
        .eq("is_active", true)
        .order("animal_type")
      let costQuery = supabase
        .from("cattle_operational_costs")
        .select("cost_type, amount_pesos, unit, description, business_unit, is_fixed, updated_at")
        .order("cost_type")

      if (category) pricingQuery = pricingQuery.eq("category", category)
      if (businessUnit !== "Todas") costQuery = costQuery.eq("business_unit", businessUnit)

      const [pricingResult, costResult] = await Promise.all([pricingQuery, costQuery])
      const error = pricingResult.error ?? costResult.error
      if (error) return { error: error.message }

      return {
        source: ["cattle_pricing", "cattle_operational_costs"],
        businessUnit,
        prices: pricingResult.data ?? [],
        costs: costResult.data ?? [],
        validationNotice: "Los precios y costos son registros internos. Verificar fecha, unidad y vigencia antes de tomar decisiones.",
      }
    },
  }),
}

export type CattleExpertMessage = UIMessage<never, never, InferUITools<typeof cattleTools>>

export async function POST(req: Request) {
  const body = await req.json()
  const messages = await validateUIMessages<CattleExpertMessage>({ messages: body.messages, tools: cattleTools })

  const result = streamText({
    model: "openai/gpt-4o-mini",
    system: `Eres el asistente interno de apoyo para la operación ganadera de Fundo Corcovado, Valdivia.

Reglas obligatorias:
- Responde en español claro y operativo.
- Usa las herramientas antes de afirmar cifras, fechas, inventarios, precios, costos o resultados.
- No inventes datos ni repitas metas históricas como hechos actuales.
- Diferencia siempre entre datos operativos, registros clínicos y proyecciones económicas.
- Expresa montos en pesos chilenos (CLP) cuando la fuente sea price_pesos, amount_pesos o el plan económico.
- No diagnostiques enfermedades ni prescribas tratamientos. Resume los registros y recomienda validación veterinaria cuando corresponda.
- Señala explícitamente datos incompletos, antiguos, inconsistentes o que requieren validación.
- Mantén las recomendaciones proporcionales a una operación pequeña y evita procesos empresariales innecesarios.`,
    messages: convertToModelMessages(messages),
    tools: cattleTools,
  })

  return result.toUIMessageStreamResponse()
}
