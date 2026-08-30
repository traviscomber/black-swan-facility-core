import { AppLayout } from "@/components/app-layout"
import { LocalizedChecklistsPage } from "@/components/localized-checklists-page"
import { createClient } from "@/lib/supabase/server"
import type { Checklist } from "@/lib/types"

export default async function ChecklistsPage() {
  const supabase = await createClient()
  const { data: checklists } = await supabase.from("checklists").select("*, employees(name)").order("title")

  return (
    <AppLayout>
      <LocalizedChecklistsPage checklists={(checklists ?? []) as Array<Checklist & { employees?: { name: string } | null }>} />
    </AppLayout>
  )
}
