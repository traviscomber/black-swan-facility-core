import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export interface HeatmapRow {
  day: string
  location_id: string
  location_name: string
  total_beds: number
  occupied_beds: number
  blocked_beds: number
  available_beds: number
  occupancy_pct: number
  revenue: number
  avg_rate: number
}

export interface HeatmapResponse {
  rows: HeatmapRow[]
  meta: {
    start_date: string
    end_date: string
    location_id: string | null
    total_days: number
  }
}

const MAX_DAYS = 90

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const start = searchParams.get("start")
  const end = searchParams.get("end")
  const locationId = searchParams.get("location_id") || null

  if (!start || !end) {
    return NextResponse.json({ error: "start and end query params are required (YYYY-MM-DD)" }, { status: 400 })
  }

  const startDate = new Date(start)
  const endDate = new Date(end)

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 })
  }

  if (endDate <= startDate) {
    return NextResponse.json({ error: "end must be after start" }, { status: 400 })
  }

  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > MAX_DAYS) {
    return NextResponse.json({ error: `Date range cannot exceed ${MAX_DAYS} days` }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_occupancy_heatmap", {
    p_start_date: start,
    p_end_date: end,
    p_location_id: locationId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows: HeatmapRow[] = (data ?? []).map((row: any) => ({
    day: typeof row.day === "string" ? row.day : new Date(row.day).toISOString().substring(0, 10),
    location_id: row.location_id,
    location_name: row.location_name,
    total_beds: Number(row.total_beds),
    occupied_beds: Number(row.occupied_beds),
    blocked_beds: Number(row.blocked_beds),
    available_beds: Number(row.available_beds),
    occupancy_pct: Number(row.occupancy_pct),
    revenue: Number(row.revenue),
    avg_rate: Number(row.avg_rate),
  }))

  const response: HeatmapResponse = {
    rows,
    meta: {
      start_date: start,
      end_date: end,
      location_id: locationId,
      total_days: diffDays,
    },
  }

  return NextResponse.json(response)
}
