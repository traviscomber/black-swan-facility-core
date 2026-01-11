"use client"

import { Suspense } from "react"
import { AuditLogsContent } from "@/components/inventory/audit-logs-content"

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading audit logs...</div>}>
      <AuditLogsContent />
    </Suspense>
  )
}
