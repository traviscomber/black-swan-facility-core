import { AppLayout } from "@/components/app-layout"
import { OrchardDashboardWorkspace } from "@/components/orchard/orchard-dashboard-workspace"
import { OrchardNextActionsStrip } from "@/components/orchard/orchard-next-actions-strip"
import "./dashboard-focus.css"

export default function OrchardDashboardPage(){
  return <AppLayout><OrchardNextActionsStrip/><OrchardDashboardWorkspace/></AppLayout>
}
