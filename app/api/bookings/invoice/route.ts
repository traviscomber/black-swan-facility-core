import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reservationId = searchParams.get("reservationId")

  if (!reservationId) {
    return NextResponse.json({ error: "Reservation ID required" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("*, rooms(*), beds(*)")
    .eq("id", reservationId)
    .single()

  if (error || !reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
  }

  const checkInDate = new Date(reservation.check_in)
  const checkOutDate = new Date(reservation.check_out)
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
  const pricePerNight = reservation.total_amount / nights || 0

  const invoice = {
    invoiceNumber: `INV-${reservation.id.substring(0, 8).toUpperCase()}`,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: reservation.check_in,
    guest: {
      name: reservation.guest_name,
      email: reservation.guest_email,
      phone: reservation.guest_phone,
    },
    reservation: {
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
      nights,
      guests: reservation.num_guests,
      room: reservation.rooms?.room_number || reservation.beds?.bed_number || "N/A",
    },
    lineItems: [
      {
        description: `Accommodation (${nights} night${nights > 1 ? "s" : ""})`,
        quantity: nights,
        unitPrice: pricePerNight,
        total: reservation.total_amount,
      },
    ],
    subtotal: reservation.total_amount,
    tax: 0,
    total: reservation.total_amount,
    paymentStatus: reservation.payment_status || "pending",
    specialRequests: reservation.special_requests,
  }

  return NextResponse.json(invoice)
}
