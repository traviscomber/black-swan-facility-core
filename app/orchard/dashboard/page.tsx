import { AppLayout } from "@/components/app-layout"
import { OrchardConfigurableDashboard } from "@/components/orchard/orchard-configurable-dashboard"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"

export default function OrchardDashboardPage(){
  return <AppLayout><OrchardNavigation/><OrchardConfigurableDashboard/></AppLayout>
}
