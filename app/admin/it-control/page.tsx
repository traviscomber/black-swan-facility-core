import { AppLayout } from "@/components/app-layout"
import { ItControlCenter, type ItControlSnapshot } from "@/components/it-control-center"
import { ItDataHealth, type ItDataHealthSnapshot } from "@/components/it-data-health"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function ItControlCenterPage() {
  const supabase = await createClient()
  const [controlResult, dataHealthResult] = await Promise.all([
    supabase.rpc("get_it_control_center_snapshot"),
    supabase.rpc("get_it_data_health_snapshot"),
  ])
  const snapshot = !controlResult.error && controlResult.data && typeof controlResult.data === "object" ? controlResult.data as ItControlSnapshot : null
  const dataHealth = !dataHealthResult.error && dataHealthResult.data && typeof dataHealthResult.data === "object" ? dataHealthResult.data as ItDataHealthSnapshot : null

  return (
    <AppLayout>
      <ItControlCenter snapshot={snapshot} errorMessage={controlResult.error?.message ?? null} />
      <ItDataHealth snapshot={dataHealth} />
    </AppLayout>
  )
}
