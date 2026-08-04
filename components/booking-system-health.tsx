"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

type HealthResult = { key: string; label: string; severity: "pass" | "warning" | "critical"; count: number }
type HealthSnapshot = {
  status: "healthy" | "warning" | "critical"
  total_checks: number
  passed_checks: number
  warning_checks: number
  critical_checks: number
  results: HealthResult[]
  executed_at: string
}
type HealthRun = HealthSnapshot & { id: string }

export function BookingSystemHealth() {
  const supabase = useMemo(() => createClient(), [])
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null)
  const [history, setHistory] = useState<HealthRun[]>([])
  const [running, setRunning] = useState(false)

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("booking_health_runs")
      .select("id,status,total_checks,passed_checks,warning_checks,critical_checks,results,executed_at")
      .order("executed_at", { ascending: false })
      .limit(8)
    if (error) return toast.error(error.message)
    setHistory((data ?? []) as HealthRun[])
  }, [supabase])

  const runChecks = useCallback(async (persist = true) => {
    setRunning(true)
    const { data, error } = await supabase.rpc("run_booking_health_checks", { p_persist: persist })
    setRunning(false)
    if (error) return toast.error(error.message)
    setSnapshot(data as HealthSnapshot)
    if (persist) {
      toast.success("Auditoría operacional completada")
      await loadHistory()
    }
  }, [loadHistory, supabase])

  useEffect(() => {
    void runChecks(false)
    void loadHistory()
  }, [loadHistory, runChecks])

  const statusLabel = snapshot?.status === "healthy" ? "Saludable" : snapshot?.status === "warning" ? "Con advertencias" : "Crítico"
  const statusIcon = snapshot?.status === "healthy" ? <CheckCircle2 className="h-4 w-4" /> : snapshot?.status === "warning" ? <AlertTriangle className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />

  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Salud del Booking OS</CardTitle>
          <Button size="sm" variant="outline" onClick={() => void runChecks(true)} disabled={running}>
            <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} /> Ejecutar auditoría
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {snapshot && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={snapshot.status === "critical" ? "destructive" : snapshot.status === "warning" ? "secondary" : "outline"} className="gap-1">{statusIcon}{statusLabel}</Badge>
              <span className="text-sm text-muted-foreground">{snapshot.passed_checks}/{snapshot.total_checks} controles aprobados</span>
              <span className="text-xs text-muted-foreground">Última revisión: {new Date(snapshot.executed_at).toLocaleString("es-CL")}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {snapshot.results.map((result) => (
                <div key={result.key} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{result.label}</p>
                    <Badge variant={result.severity === "critical" ? "destructive" : result.severity === "warning" ? "secondary" : "outline"}>{result.count}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{result.severity === "pass" ? "Sin inconsistencias" : result.severity === "warning" ? "Requiere revisión operativa" : "Requiere corrección prioritaria"}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Historial de auditorías</h3>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay ejecuciones persistidas.</p> : (
            <div className="space-y-2">
              {history.map((run) => (
                <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={run.status === "critical" ? "destructive" : run.status === "warning" ? "secondary" : "outline"}>{run.status}</Badge>
                    <span>{run.passed_checks}/{run.total_checks} aprobados</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(run.executed_at).toLocaleString("es-CL")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
