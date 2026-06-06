"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import type { AIAgent, AIAgentExecution, AIOperationLog } from "@/lib/types"
import { Play, Activity, Clock, CheckCircle, XCircle, Zap } from "lucide-react"
import { executeAgent } from "./actions"
import { useEffect, useState } from "react"

function getAgentIcon(type: string) {
  const iconMap: Record<string, any> = {
    maintenance: Clock,
    issue_resolution: Activity,
    documentation: CheckCircle,
    communication: Zap,
    execution: Play,
  }
  return iconMap[type] || Activity
}

function getAgentColor(type: string) {
  const colorMap: Record<string, string> = {
    maintenance: "bg-blue-50 text-blue-700 border-blue-200",
    issue_resolution: "bg-red-50 text-red-700 border-red-200",
    documentation: "bg-green-50 text-green-700 border-green-200",
    communication: "bg-yellow-50 text-yellow-700 border-yellow-200",
    execution: "bg-purple-50 text-purple-700 border-purple-200",
  }
  return colorMap[type] || "bg-gray-50 text-gray-700 border-gray-200"
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-green-50 text-green-700 border-green-200"
    case "paused":
      return "bg-yellow-50 text-yellow-700 border-yellow-200"
    case "disabled":
      return "bg-gray-50 text-gray-700 border-gray-200"
    case "running":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "completed":
      return "bg-green-50 text-green-700 border-green-200"
    case "failed":
      return "bg-red-50 text-red-700 border-red-200"
    default:
      return "bg-gray-50 text-gray-700 border-gray-200"
  }
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Never"
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AIOperationsPage() {
  const { t } = useLanguage()
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [executions, setExecutions] = useState<AIAgentExecution[]>([])
  const [logs, setLogs] = useState<AIOperationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [setupRequired, setSetupRequired] = useState(false)
  const [stats, setStats] = useState({
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    activeAgents: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()

    // Fetch AI agents
    const { data: agentsData, error: agentsError } = await supabase.from("ai_agents").select("*").order("created_at")

    // If tables don't exist, show setup screen
    if (agentsError && agentsError.code === "PGRST116") {
      setSetupRequired(true)
      setLoading(false)
      return
    }

    // Fetch recent executions
    const { data: executionsData } = await supabase
      .from("ai_agent_executions")
      .select("*, ai_agents(name)")
      .order("created_at", { ascending: false })
      .limit(10)

    // Fetch recent logs
    const { data: logsData } = await supabase
      .from("ai_operation_logs")
      .select("*, ai_agents(name)")
      .order("created_at", { ascending: false })
      .limit(20)

    setAgents(agentsData || [])
    setExecutions(executionsData || [])
    setLogs(logsData || [])

    // Calculate stats
    const totalExecutions = executionsData?.length || 0
    const successfulExecutions = executionsData?.filter((e) => e.status === "completed").length || 0
    const failedExecutions = executionsData?.filter((e) => e.status === "failed").length || 0
    const activeAgents = agentsData?.filter((a) => a.status === "active").length || 0

    setStats({ totalExecutions, successfulExecutions, failedExecutions, activeAgents })
    setLoading(false)
  }

  async function handleExecuteAgent(agentId: string) {
    await executeAgent(agentId)
    loadData() // Reload data after execution
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title={t('pages.ai_operations')} description={t('pages.ai_operations_desc')} />
        <div className="p-4 md:p-6">
          <div className="text-center text-sm text-gray-600">{t('common.loading')}</div>
        </div>
      </AppLayout>
    )
  }

  if (setupRequired) {
    return (
      <AppLayout>
        <PageHeader title={t('pages.ai_operations')} description={t('pages.ai_operations_desc')} />

        <div className="p-4 md:p-6">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900">
                <Activity className="h-5 w-5" />
                AI Operations Setup Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-yellow-800">
                The AI Operations system needs to be initialized. Run the SQL setup script to create the required
                database tables.
              </p>

              <div className="rounded-lg border border-yellow-300 bg-white p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Setup Instructions:</h3>
                <ol className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="font-semibold">1.</span>
                    <span>Navigate to the Scripts section in your v0 preview</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold">2.</span>
                    <span>
                      Run the script:{" "}
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">
                        005_create_ai_operations_schema.sql
                      </code>
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold">3.</span>
                    <span>Refresh this page after the script completes</span>
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">What will be created:</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>• AI Agents table (5 autonomous agents)</li>
                  <li>• Agent Executions tracking</li>
                  <li>• Agent Memory system</li>
                  <li>• Automation Rules engine</li>
                  <li>• Operation Logs</li>
                </ul>
              </div>

              <Button variant="outline" className="w-full bg-transparent" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    )
  }

  return (
      <AppLayout>
        <PageHeader title={t('pages.ai_operations')} description={t('pages.ai_operations_desc')} />

      <div className="p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          {/* Stats Overview */}
          <div className="grid gap-3 md:grid-cols-4 md:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeAgents}</div>
                <p className="mt-1 text-xs text-gray-600">Running operations</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalExecutions}</div>
                <p className="mt-1 text-xs text-gray-600">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Successful
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.successfulExecutions}</div>
                <p className="mt-1 text-xs text-gray-600">
                  {stats.totalExecutions > 0
                    ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                    : 0}
                  % success rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.failedExecutions}</div>
                <p className="mt-1 text-xs text-gray-600">Require attention</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Agents */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-black md:text-base">AI Agents</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {agents?.map((agent: AIAgent) => {
                const Icon = getAgentIcon(agent.type)
                return (
                  <Card key={agent.id} className="border-gray-100">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`rounded-lg p-2 ${getAgentColor(agent.type)}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">{agent.name}</CardTitle>
                            <Badge variant="outline" className={`mt-1 text-xs ${getStatusColor(agent.status)}`}>
                              {agent.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-4">
                      <p className="text-xs text-gray-600">{agent.description}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Last run:</span>
                        <span className="font-medium text-gray-700">{formatDate(agent.last_run)}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs bg-transparent"
                        onClick={() => handleExecuteAgent(agent.id)}
                      >
                        <Play className="mr-1 h-3 w-3" />
                        Run Now
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Recent Executions */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-black md:text-base">Recent Executions</h2>
            <Card className="border-gray-100">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Agent</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Duration</TableHead>
                      <TableHead className="text-xs">Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions && executions.length > 0 ? (
                      executions.map((exec: any) => (
                        <TableRow key={exec.id}>
                          <TableCell className="text-xs font-medium">{exec.ai_agents?.name || "Unknown"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${getStatusColor(exec.status)}`}>
                              {exec.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{exec.duration_ms ? `${exec.duration_ms}ms` : "-"}</TableCell>
                          <TableCell className="text-xs text-gray-600">{formatDate(exec.created_at)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-xs text-gray-500">
                          No executions yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Operation Logs */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-black md:text-base">Operation Logs</h2>
            <Card className="border-gray-100">
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Level</TableHead>
                        <TableHead className="text-xs">Agent</TableHead>
                        <TableHead className="text-xs">Message</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs && logs.length > 0 ? (
                        logs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  log.log_level === "error"
                                    ? "bg-red-50 text-red-700"
                                    : log.log_level === "warn"
                                      ? "bg-yellow-50 text-yellow-700"
                                      : "bg-gray-50 text-gray-700"
                                }`}
                              >
                                {log.log_level}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{log.ai_agents?.name || "-"}</TableCell>
                            <TableCell className="max-w-md text-xs">{log.message}</TableCell>
                            <TableCell className="text-xs text-gray-600">{formatDate(log.created_at)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-xs text-gray-500">
                            No logs yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
