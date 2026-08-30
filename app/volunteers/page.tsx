import { AppLayout } from "@/components/app-layout"
import { LocalizedVolunteersPage } from "@/components/localized-volunteers-page"
import { createClient } from "@/lib/supabase/server"
import type { Volunteer } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function VolunteersPage() {
  const supabase = await createClient()
  const { data: volunteers } = await supabase.from("volunteers").select("*").order("name")

  return (
    <AppLayout>
      <LocalizedVolunteersPage volunteers={(volunteers ?? []) as Volunteer[]} />
    </AppLayout>
  )
}
