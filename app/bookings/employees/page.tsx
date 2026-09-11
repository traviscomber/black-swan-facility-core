import { BookingEmployeesDirectory } from "@/components/booking-employees-directory"
import { createClient } from "@/lib/supabase/server"
import type { Employee } from "@/lib/types"

export default async function BookingEmployeesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, role, phone, email, is_active, photo_url, created_at")
    .order("is_active", { ascending: false })
    .order("name")

  return <BookingEmployeesDirectory employees={(data ?? []) as Employee[]} loadFailed={Boolean(error)} />
}
