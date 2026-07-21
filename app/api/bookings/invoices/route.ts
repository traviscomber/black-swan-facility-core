import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reservationId = searchParams.get("reservationId")
  const invoiceId = searchParams.get("invoiceId")

  const supabase = await createClient()

  try {
    if (invoiceId) {
      const { data, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single()

      if (error) throw error
      return NextResponse.json(data)
    }

    if (reservationId) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return NextResponse.json(data)
    }

    const { data, error } = await supabase.from("invoices").select("*").order("invoice_date", { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error fetching invoices:", error)
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()

    const { data: invoiceNumber, error: numberError } = await supabase.rpc("next_invoice_number")
    if (numberError) throw numberError
    if (typeof invoiceNumber !== "string" || !invoiceNumber) {
      throw new Error("Invoice number generation returned an invalid value")
    }

    const invoiceData = {
      ...body,
      invoice_number: invoiceNumber,
    }

    const { data, error } = await supabase.from("invoices").insert([invoiceData]).select().single()
    if (error) throw error

    console.log("[v0] Invoice created:", data.id)
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating invoice:", error)

    const message = error instanceof Error ? error.message : "Failed to create invoice"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
