import { EmployeesDirectoryView } from "@/components/employees-directory-view"
import { createClient } from "@/lib/supabase/server"
import type { Employee } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("employees").select("id, name, role, phone, email, is_active, photo_url, created_at").order("is_active", { ascending: false }).order("name")
  return <EmployeesDirectoryView employees={(data ?? []) as Employee[]} loadFailed={Boolean(error)} />
}
