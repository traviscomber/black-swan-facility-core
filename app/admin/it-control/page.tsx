import { AppLayout } from "@/components/app-layout"
import { ItControlCenter, type ItControlSnapshot } from "@/components/it-control-center"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function ItControlCenterPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_it_control_center_snapshot")
  const snapshot = !error && data && typeof data === "object" ? data as ItControlSnapshot : null

  return (
    <AppLayout>
      <ItControlCenter snapshot={snapshot} errorMessage={error?.message ?? null} />
    </AppLayout>
  )
}
