"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Search } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import { auditCopy, auditLocale } from "@/lib/translations/audit"

type AuditRow = { id: string; source: "history" | "audit"; reservation_id: string | null; action: string; notes: string | null; actor: string | null; created_at: string; guest_name: string | null; check_in: string | null; check_out: string | null }

export default function BookingsAuditPage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = auditCopy[language]
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [source, setSource] = useState("all")

  async function loadAudit() {
    setLoading(true)
    const [historyResult, auditResult] = await Promise.all([
      supabase.from("reservation_history").select("id,reservation_id,status_change,notes,created_at,employees(name),reservations(guest_name,check_in,check_out)").order("created_at", { ascending: false }).limit(250),
      supabase.from("audit_actions").select("id,reservation_id,actor,action_type,payload,success,error_message,ts,reservations(guest_name,check_in,check_out)").not("reservation_id", "is", null).order("ts", { ascending: false }).limit(250),
    ])
    const historyRows: AuditRow[] = (historyResult.data ?? []).map((item: any) => ({ id: item.id, source: "history", reservation_id: item.reservation_id, action: item.status_change, notes: item.notes, actor: item.employees?.name ?? null, created_at: item.created_at, guest_name: item.reservations?.guest_name ?? null, check_in: item.reservations?.check_in ?? null, check_out: item.reservations?.check_out ?? null }))
    const auditRows: AuditRow[] = (auditResult.data ?? []).map((item: any) => ({ id: item.id, source: "audit", reservation_id: item.reservation_id, action: item.action_type, notes: item.success === false ? item.error_message : item.payload ? JSON.stringify(item.payload) : null, actor: item.actor, created_at: item.ts, guest_name: item.reservations?.guest_name ?? null, check_in: item.reservations?.check_in ?? null, check_out: item.reservations?.check_out ?? null }))
    setRows([...historyRows, ...auditRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    setLoading(false)
  }

  useEffect(() => {
    void loadAudit()
    const channel = supabase.channel("bookings-audit").on("postgres_changes", { event: "*", schema: "public", table: "reservation_history" }, () => void loadAudit()).on("postgres_changes", { event: "*", schema: "public", table: "audit_actions" }, () => void loadAudit()).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

  const filteredRows = useMemo(() => rows.filter((row) => {
    const text = `${row.guest_name ?? ""} ${row.action} ${row.actor ?? ""} ${row.notes ?? ""} ${row.reservation_id ?? ""}`.toLowerCase()
    return (source === "all" || row.source === source) && text.includes(query.toLowerCase())
  }), [query, rows, source])

  return <div className="min-h-screen bg-[#111213] text-foreground">
    <header className="flex min-h-[58px] flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
      <div><h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1><p className="text-xs text-muted-foreground">{copy.subtitle}</p></div>
      <Button variant="outline" className="h-8 rounded-[4px] border-white/10 bg-[#111314] px-3 text-xs" onClick={() => void loadAudit()} disabled={loading}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />{copy.refresh}</Button>
    </header>

    <div className="flex min-h-[40px] flex-col gap-2 border-b border-white/10 bg-[#151718] px-4 py-1.5 md:flex-row md:items-center md:px-5">
      <div className="relative w-full md:max-w-md"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} className="h-8 rounded-[4px] border-white/10 bg-[#111314] pl-8 text-xs" /></div>
      <Select value={source} onValueChange={setSource}><SelectTrigger className="h-8 rounded-[4px] border-white/10 bg-[#111314] text-xs md:w-48"><SelectValue placeholder={copy.source} /></SelectTrigger><SelectContent><SelectItem value="all">{copy.allSources}</SelectItem><SelectItem value="history">{copy.history}</SelectItem><SelectItem value="audit">{copy.audit}</SelectItem></SelectContent></Select>
      <span className="ml-auto text-xs text-muted-foreground">{filteredRows.length} {copy.events.toLowerCase()}</span>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px] text-xs">
        <thead className="bg-[#17191a] text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-2.5">Time</th><th className="px-4 py-2.5">{copy.source}</th><th className="px-4 py-2.5">Guest</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">{copy.actor}</th><th className="px-4 py-2.5">{copy.reservation}</th><th className="px-4 py-2.5">Detail</th></tr></thead>
        <tbody className="divide-y divide-white/[0.06]">
          {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{copy.loading}</td></tr> : filteredRows.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{copy.noEvents}</td></tr> : filteredRows.map((row) => <tr key={`${row.source}-${row.id}`} className="bg-[#111213] align-top hover:bg-white/[0.025]"><td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{new Date(row.created_at).toLocaleString(auditLocale[language])}</td><td className="px-4 py-2.5"><Badge variant={row.source === "history" ? "secondary" : "outline"} className="h-5 rounded-[3px] px-1.5 text-[10px]">{row.source === "history" ? copy.history : copy.audit}</Badge></td><td className="px-4 py-2.5 font-medium">{row.guest_name ?? copy.noGuest}</td><td className="px-4 py-2.5">{row.action}</td><td className="px-4 py-2.5 text-muted-foreground">{row.actor ?? copy.noActor}</td><td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{row.reservation_id ? row.reservation_id.slice(0, 8) : "—"}</td><td className="max-w-xl px-4 py-2.5 text-muted-foreground"><span className="line-clamp-2 break-words">{row.notes || "—"}</span></td></tr>)}
        </tbody>
      </table>
    </div>
  </div>
}
