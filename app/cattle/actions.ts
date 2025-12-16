"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Get profitability analysis for cattle business units
 */
export async function getProfitabilityAnalysis(businessUnit: "Crianza" | "Engorda" | "Both") {
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

  if (!data) return null

  const totalRevenue = data.reduce((sum, row) => sum + (row.sales_amount || 0), 0)
  const totalCosts = data.reduce((sum, row) => sum + (row.operational_cost || 0), 0)
  const totalProfit = totalRevenue - totalCosts
  const marginPercentage = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return {
    businessUnit,
    totalRevenue,
    totalCosts,
    totalProfit,
    marginPercentage,
    monthsAnalyzed: data.length,
    data,
  }
}

/**
 * Calculate break-even timeline
 */
export async function getBreakEvenAnalysis() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("cattle_business_plan")
    .select("*")
    .order("year", { ascending: true })
    .order("month", { ascending: true })

  if (!data) return null

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

  return {
    breakEvenMonth,
    breakEvenYear,
    currentCumulativeProfit: cumulativeProfit,
    data,
  }
}

/**
 * Get operational costs for cost optimization
 */
export async function getOperationalCostAnalysis(businessUnit: "Crianza" | "Engorda") {
  const supabase = await createClient()

  const { data: costs } = await supabase.from("cattle_operational_costs").select("*").eq("business_unit", businessUnit)

  const { data: pricing } = await supabase
    .from("cattle_pricing")
    .select("*")
    .eq("category", businessUnit === "Crianza" ? "Breeding" : "Fattening")

  return {
    costs,
    pricing,
    businessUnit,
  }
}

/**
 * Get animal health and breeding data
 */
export async function getAnimalHealthData() {
  const supabase = await createClient()

  const { data: costs } = await supabase.from("cattle_operational_costs").select("*").eq("cost_type", "Mortalidad tasa")

  const { data: plan } = await supabase.from("cattle_business_plan").select("*").order("year", { ascending: true })

  return {
    mortalityRate: costs?.[0]?.amount_pesos || 0.95,
    businessPlanData: plan,
  }
}

/**
 * Get breeding strategy recommendations based on timeframe
 */
export async function getBreedingStrategyData(timeframe: "short-term" | "medium-term" | "long-term") {
  const supabase = await createClient()

  const { data: pricing } = await supabase.from("cattle_pricing").select("*").eq("category", "Breeding")

  const { data: plan } = await supabase
    .from("cattle_business_plan")
    .select("*")
    .eq("business_unit", "Crianza")
    .order("year", { ascending: true })

  return {
    timeframe,
    breedTypes: pricing,
    businessPlanData: plan,
    milestones: {
      year4March: 500,
      year8December: 140000000,
    },
  }
}
