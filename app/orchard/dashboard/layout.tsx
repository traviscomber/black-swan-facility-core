import type { ReactNode } from "react"
import { DashboardNewNoteShortcut } from "@/components/orchard/dashboard-new-note-shortcut"

export default function OrchardDashboardLayout({children}:{children:ReactNode}){
 return <>
  <div className="mx-auto flex w-full max-w-[1500px] justify-end px-4 pt-3 sm:px-6 lg:px-8"><DashboardNewNoteShortcut/></div>
  {children}
 </>
}
