"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, RefreshCw, Search, ShieldCheck } from "lucide-react"

type AuditRow = {
  id: string
  source: "history" | "audit"
  reservation_id: string | null
  action: string
  notes: string | null
  actor: string | null
  created_at: string
  guest_name: string | null
  check_in: string | null
  check_out: string | null
}

export default function BookingsAuditPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [source, setSource] = useState("all")

  async function loadAudit() {
    setLoading(true)

    const [historyResult, auditResult] = await Promise.all([
      supabase
        .from("reservation_history")
        .select("id,reservation_id,status_change,notes,created_at,employees(name),reservations(guest_name,check_in,check_out)")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("audit_actions")
        .select("id,reservation_id,actor,action_type,payload,success,error_message,ts,reservations(guest_name,check_in,check_out)")
        .not("reservation_id", "is", null)
        .order("ts", { ascending: false })
        .limit(250),
    ])

    const historyRows: AuditRow[] = (historyResult.data ?? []).map((item: any) => ({
      id: item.id,
      source: "history",
      reservation_id: item.reservation_id,
      action: item.status_change,
      notes: item.notes,
      actor: item.employees?.name ?? null,
      created_at: item.created_at,
      guest_name: item.reservations?.guest_name ?? null,
      check_in: item.reservations?.check_in ?? null,
      check_out: item.reservations?.check_out ?? null,
    }))

    const auditRows: AuditRow[] = (auditResult.data ?? []).map((item: any) => ({
      id: item.id,
      source: "audit",
      reservation_id: item.reservation_id,
      action: item.action_type,
      notes: item.success === false ? item.error_message : item.payload ? JSON.stringify(item.payload) : null,
      actor: item.actor,
      created_at: item.ts,
      guest_name: item.reservations?.guest_name ?? null,
      check_in: item.reservations?.check_in ?? null,
      check_out: item.reservations?.check_out ?? null,
    }))

    setRows([...historyRows, ...auditRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    setLoading(false)
  }

  useEffect(() => {
    loadAudit()

    const channel = supabase
      .channel("bookings-audit")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservation_history" }, loadAudit)
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_actions" }, loadAudit)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filteredRows = rows.filter((row) => {
    const text = `${row.guest_name ?? ""} ${row.action} ${row.actor ?? ""} ${row.notes ?? ""} ${row.reservation_id ?? ""}`.toLowerCase()
    return (source === "all" || row.source === source) && text.includes(query.toLowerCase())
  })

  const last24Hours = rows.filter((row) => Date.now() - new Date(row.created_at).getTime() <= 24 * 60 * 60 * 1000).length
  const reservationsTracked = new Set(rows.map((row) => row.reservation_id).filter(Boolean)).size

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auditoría de reservas</h1>
          <p className="text-sm text-muted-foreground">Trazabilidad consolidada de estados y acciones operativas.</p>
        </div>
        <Button variant="outline" onClick={loadAudit} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Eventos registrados</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{rows.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Últimas 24 horas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{last24Hours}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Reservas trazadas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{reservationsTracked}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar huésped, acción, actor o reserva" className="pl-9" />
            </div>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-full md:w-52"><SelectValue placeholder="Fuente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las fuentes</SelectItem>
                <SelectItem value="history">Historial de estados</SelectItem>
                <SelectItem value="audit">Acciones de auditoría</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Cargando auditoría…</div>
            ) : filteredRows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No se encontraron eventos.</div>
            ) : (
              filteredRows.map((row) => (
                <div key={`${row.source}-${row.id}`} className="flex gap-3 rounded-lg border p-4">
                  <div className="mt-0.5 rounded-full bg-muted p-2">
                    {row.source === "history" ? <Activity className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.guest_name ?? "Reserva sin huésped"}</span>
                      <Badge variant={row.source === "history" ? "secondary" : "outline"}>{row.action}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {row.actor ? `Actor: ${row.actor}` : "Actor no registrado"}
                      {row.reservation_id ? ` · Reserva ${row.reservation_id.slice(0, 8)}` : ""}
                    </p>
                    {row.notes && <p className="break-words text-sm">{row.notes}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("es-CL")}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
