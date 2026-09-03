import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_mean",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_probability_max",
  "precipitation_sum",
].join(",")

type FarmSettings = {
  latitude: number | null
  longitude: number | null
  temperature_unit: "celsius" | "fahrenheit" | string | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("orchard_farm_settings")
    .select("latitude,longitude,temperature_unit")
    .eq("farm_key", "black_swan_orchard")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const settings = data as FarmSettings | null
  if (!settings?.latitude || !settings.longitude) {
    return NextResponse.json({ error: "Farm coordinates are not configured" }, { status: 409 })
  }

  const unit = settings.temperature_unit === "fahrenheit" ? "fahrenheit" : "celsius"
  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(settings.latitude))
  url.searchParams.set("longitude", String(settings.longitude))
  url.searchParams.set("daily", DAILY_FIELDS)
  url.searchParams.set("timezone", "America/Santiago")
  url.searchParams.set("forecast_days", "7")
  url.searchParams.set("temperature_unit", unit)

  try {
    const response = await fetch(url, { next: { revalidate: 1800 } })
    if (!response.ok) {
      return NextResponse.json({ error: `Weather provider returned ${response.status}` }, { status: 502 })
    }
    const payload = await response.json()
    return NextResponse.json({
      source: "Open-Meteo",
      timezone: payload.timezone ?? "America/Santiago",
      unit: unit === "fahrenheit" ? "°F" : "°C",
      daily: payload.daily ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Weather provider unavailable" },
      { status: 502 },
    )
  }
}
