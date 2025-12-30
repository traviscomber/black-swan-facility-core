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

    // Get all invoices
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
  const body = await request.json()

  try {
    // Generate invoice number
    const { data: lastInvoice } = await supabase
      .from("invoices")
      .select("invoice_number")
      .order("created_at", { ascending: false })
      .limit(1)

    let nextNumber = 1001
    if (lastInvoice && lastInvoice.length > 0) {
      const lastNum = Number.parseInt(lastInvoice[0].invoice_number.split("-")[1] || "1000")
      nextNumber = lastNum + 1
    }
    const invoiceNumber = `INV-${nextNumber}`

    const invoiceData = {
      ...body,
      invoice_number: invoiceNumber,
    }

    const { data, error } = await supabase.from("invoices").insert([invoiceData]).select().single()

    if (error) throw error

    console.log("[v0] Invoice created:", data.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error creating invoice:", error)
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 })
  }
}
