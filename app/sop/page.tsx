import { SopLibraryView, type SopProcedureSummary } from "@/components/sop-views"
import { createClient } from "@/lib/supabase/server"

export default async function SopLibraryPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sop_procedures")
    .select("id, code, title, domain, owner_role, status, risk_level, next_review_date, updated_at, sop_versions(id, version_number, status, estimated_minutes)")
    .order("domain")
    .order("code")

  return <SopLibraryView procedures={(data ?? []) as SopProcedureSummary[]} loadFailed={Boolean(error)} />
}
