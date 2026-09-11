import { notFound } from "next/navigation"
import { BookingReservationStayCockpit } from "@/components/booking-reservation-stay-cockpit"
import { createClient } from "@/lib/supabase/server"

export default async function ReservationObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("id,room_id,guest_id,guest_name,guest_email,guest_phone,check_in,check_out,status,arrival_status,payment_status,num_guests,source,booking_type,total_amount,special_requests,estimated_arrival_time,estimated_departure_time,early_check_in_requested,late_check_out_requested")
    .eq("id", id)
    .maybeSingle()

  if (error || !reservation) notFound()
  return <BookingReservationStayCockpit reservation={reservation} />
}
