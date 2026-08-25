import type React from "react"
import { AppLayout } from "@/components/app-layout"

export default function OsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppLayout>{children}</AppLayout>
}
