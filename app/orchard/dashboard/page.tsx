import { AppLayout } from "@/components/app-layout"
import { OrchardDashboardWorkspace } from "@/components/orchard/orchard-dashboard-workspace"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import "./dashboard-focus.css"

export default function OrchardDashboardPage(){
  return <AppLayout><OrchardNavigation/><OrchardDashboardWorkspace/></AppLayout>
}
