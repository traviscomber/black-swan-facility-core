"use client"

import { Suspense } from "react"
import { AuditLogsContent } from "@/components/inventory/audit-logs-content"
import { useLanguage } from "@/lib/hooks/use-language"

const loadingCopy = {
  en: "Loading audit logs…",
  es: "Cargando registros de auditoría…",
  de: "Audit-Protokolle werden geladen…",
} as const

export default function AuditLogsPage() {
  const { language } = useLanguage()

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{loadingCopy[language]}</div>}>
      <AuditLogsContent />
    </Suspense>
  )
}
