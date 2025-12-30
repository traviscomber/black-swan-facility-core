import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const body = await request.json()
  const invoiceId = params.id

  try {
    const { data, error } = await supabase
      .from("invoices")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .select()
      .single()

    if (error) throw error

    console.log("[v0] Invoice updated:", invoiceId)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error updating invoice:", error)
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const invoiceId = params.id

  try {
    const { error } = await supabase.from("invoices").delete().eq("id", invoiceId)

    if (error) throw error

    console.log("[v0] Invoice deleted:", invoiceId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting invoice:", error)
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 })
  }
}
