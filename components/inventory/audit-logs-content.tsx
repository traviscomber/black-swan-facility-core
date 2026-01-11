"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Search, Filter, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"

interface AuditLog {
  id: string
  asset_id: string
  asset_code: string
  asset_name: string
  action: string
  old_value: string | null
  new_value: string | null
  field_changed: string
  changed_by: string | null
  changed_at: string
}

export function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [fieldFilter, setFieldFilter] = useState("all")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        console.log("[v0] Fetching audit logs...")
        const { data, error } = await supabase
          .from("asset_logs")
          .select("*")
          .order("changed_at", { ascending: false })
          .limit(500)

        if (error) throw error

        console.log(`[v0] Fetched ${data?.length || 0} audit logs`)
        setLogs(data || [])
        setFilteredLogs(data || [])
      } catch (error) {
        console.error("[v0] Error fetching audit logs:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  useEffect(() => {
    let filtered = logs

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.asset_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.asset_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.changed_by?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Filter by action
    if (actionFilter !== "all") {
      filtered = filtered.filter((log) => log.action === actionFilter)
    }

    // Filter by field
    if (fieldFilter !== "all") {
      filtered = filtered.filter((log) => log.field_changed === fieldFilter)
    }

    setFilteredLogs(filtered)
  }, [logs, searchTerm, actionFilter, fieldFilter])

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-500/10 text-green-400"
      case "update":
        return "bg-blue-500/10 text-blue-400"
      case "delete":
        return "bg-red-500/10 text-red-400"
      default:
        return "bg-gray-500/10 text-gray-400"
    }
  }

  const actions = [...new Set(logs.map((log) => log.action))]
  const fields = [...new Set(logs.map((log) => log.field_changed))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">Track all changes to inventory assets</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-secondary/50 border-secondary">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {actions.map((action) => (
                <SelectItem key={action} value={action}>
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={fieldFilter} onValueChange={setFieldFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fields</SelectItem>
              {fields.map((field) => (
                <SelectItem key={field} value={field}>
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("")
              setActionFilter("all")
              setFieldFilter("all")
            }}
          >
            <Filter className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </Card>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading audit logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No audit logs found</div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {logs.length} logs
          </div>

          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="p-4 hover:bg-secondary/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${getActionBadgeColor(
                          log.action,
                        )}`}
                      >
                        {log.action.toUpperCase()}
                      </span>
                      <span className="font-mono text-sm font-bold">{log.asset_code}</span>
                      <span className="text-sm">{log.asset_name}</span>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <strong>{log.field_changed}</strong> changed
                      {log.old_value && (
                        <>
                          {" "}
                          from <span className="font-mono text-red-400">{log.old_value}</span>
                        </>
                      )}
                      {log.new_value && (
                        <>
                          {" "}
                          to <span className="font-mono text-green-400">{log.new_value}</span>
                        </>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      By {log.changed_by || "System"} • {format(new Date(log.changed_at), "PPP p", { locale: es })}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
