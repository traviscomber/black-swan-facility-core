import { notFound } from "next/navigation"
import { BookingReservationObjectView, type BookingReservationObjectData } from "@/components/booking-reservation-object-view"
import { createClient } from "@/lib/supabase/server"

export default async function ReservationObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const reservationResult = await supabase
    .from("reservations")
    .select("id,room_id,guest_id,guest_name,guest_email,guest_phone,check_in,check_out,status,arrival_status,payment_status,num_guests,source,booking_type,total_amount,special_requests,estimated_arrival_time,estimated_departure_time,early_check_in_requested,late_check_out_requested")
    .eq("id", id)
    .maybeSingle()

  if (reservationResult.error || !reservationResult.data) notFound()
  const reservation = reservationResult.data as BookingReservationObjectData["reservation"]

  const [roomResult, guestResult, paymentsResult, invoicesResult, housekeepingResult, maintenanceResult, requestsResult, exceptionsResult, documentsResult, eventsResult] = await Promise.all([
    reservation.room_id ? supabase.from("rooms").select("id,room_number,status,operational_status,location").eq("id", reservation.room_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    reservation.guest_id ? supabase.from("guests").select("id,name,email,phone,vip_status,preferred_language,preferred_contact_channel,allergies,mobility_requirements,housekeeping_preferences").eq("id", reservation.guest_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("payments").select("id,amount,payment_method,payment_status,paid_at,created_at").eq("reservation_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("invoices").select("id,invoice_number,status,payment_status,total_amount,balance_due,invoice_date").eq("reservation_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("housekeeping_tasks").select("id,task_type,status,priority,service_date,requires_inspection,inspection_status").eq("reservation_id", id).order("service_date", { ascending: false, nullsFirst: false }).limit(10),
    supabase.from("maintenance_tasks").select("id,title,status,prioridad,fecha_objetivo,bloqueado,blocks_room").eq("reservation_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("hospitality_requests").select("id,request_type,category,description,priority,status,due_at").eq("reservation_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("reservation_operational_exceptions").select("source_id,domain,title,status,priority,exception_state,blocks_check_in,blocks_check_out,detail").eq("reservation_id", id).in("exception_state", ["open", "overdue"]).limit(10),
    supabase.from("operational_documents").select("id,document_number,document_type,status,title,issued_at").eq("reservation_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("booking_events").select("id,event_type,category,title,description,previous_state,new_state,occurred_at").eq("reservation_id", id).order("occurred_at", { ascending: false }).limit(20),
  ])

  const payments = (paymentsResult.data ?? []) as BookingReservationObjectData["payments"]
  const data: BookingReservationObjectData = {
    reservation,
    room: (roomResult.data ?? null) as BookingReservationObjectData["room"],
    guest: (guestResult.data ?? null) as BookingReservationObjectData["guest"],
    payments,
    invoices: (invoicesResult.data ?? []) as BookingReservationObjectData["invoices"],
    housekeeping: (housekeepingResult.data ?? []) as BookingReservationObjectData["housekeeping"],
    maintenance: (maintenanceResult.data ?? []) as BookingReservationObjectData["maintenance"],
    requests: (requestsResult.data ?? []) as BookingReservationObjectData["requests"],
    exceptions: (exceptionsResult.data ?? []) as BookingReservationObjectData["exceptions"],
    documents: (documentsResult.data ?? []) as BookingReservationObjectData["documents"],
    events: (eventsResult.data ?? []) as BookingReservationObjectData["events"],
    queryError: Boolean(roomResult.error || guestResult.error || paymentsResult.error || invoicesResult.error || housekeepingResult.error || maintenanceResult.error || requestsResult.error || exceptionsResult.error || documentsResult.error || eventsResult.error),
    paidAmount: payments.filter((item) => ["paid", "completed", "succeeded"].includes(item.payment_status?.toLowerCase() || "")).reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }

  return <BookingReservationObjectView data={data} />
}
