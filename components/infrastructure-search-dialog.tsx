"use client"

import { useState } from "react"
import { Search, Loader2, MapPin, AlertCircle, Zap } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { InfrastructureSearchAgent, SearchAgentState } from "@/lib/ai/infrastructure-search-agent"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface InfrastructureSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectInfrastructure: (infrastructure: any) => void
}

export function InfrastructureSearchDialog({
  open,
  onOpenChange,
  onSelectInfrastructure,
}: InfrastructureSearchDialogProps) {
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [state, setState] = useState<SearchAgentState>(SearchAgentState.IDLE)
  const [error, setError] = useState<string>()
  const [logs, setLogs] = useState<any[]>([])
  const [showLogs, setShowLogs] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setQuery("")
      setResults([])
      setError(undefined)
      setState(SearchAgentState.IDLE)
      setLogs([])
      setShowLogs(false)
    }
    onOpenChange(newOpen)
  }

  const handleSearch = async () => {
    if (!query.trim()) return

    setSearching(true)
    setError(undefined)
    setResults([])

    try {
      console.log("[v0] Starting infrastructure search:", query)

      const agent = new InfrastructureSearchAgent(query)
      const context = await agent.execute()

      // Update UI with agent state
      setState(context.state)
      setLogs(context.logs)

      if (context.state === SearchAgentState.COMPLETED) {
        setResults(context.results || [])
        console.log("[v0] Search completed successfully:", context.results?.length, "results")
      } else if (context.state === SearchAgentState.ERROR) {
        setError(context.error || "Search failed")
        console.error("[v0] Search failed:", context.error)
      }
    } catch (err: any) {
      setError(err.message)
      setState(SearchAgentState.ERROR)
      console.error("[v0] Search error:", err)
    } finally {
      setSearching(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "internet":
        return <Zap className="h-4 w-4" />
      case "water":
        return <div className="h-4 w-4 text-cyan-500">💧</div>
      case "electricity":
        return <div className="h-4 w-4 text-yellow-500">⚡</div>
      default:
        return <MapPin className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default"
      case "planned":
        return "secondary"
      case "maintenance":
        return "destructive"
      case "inactive":
        return "outline"
      default:
        return "secondary"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "destructive"
      case "high":
        return "destructive"
      case "normal":
        return "default"
      case "low":
        return "secondary"
      default:
        return "outline"
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Search Infrastructure</span>
            <kbd className="text-xs font-mono px-2 py-1 bg-muted rounded border">
              <span className="text-xs">⌘</span>K
            </kbd>
          </DialogTitle>
          <DialogDescription>
            Use natural language to search infrastructure (e.g., "Show all offline internet devices near Clubhouse")
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder='Try: "critical water systems" or "internet near Clubhouse" or "maintenance due next month"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* State Indicator */}
          {state !== SearchAgentState.IDLE && state !== SearchAgentState.COMPLETED && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                <span className="font-medium">{state.toUpperCase()}</span> - Processing your search...
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Found {results.length} result(s)</p>
                <Button variant="ghost" size="sm" onClick={() => setShowLogs(!showLogs)}>
                  {showLogs ? "Hide Logs" : "Show Logs"}
                </Button>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {results.map((infrastructure) => (
                    <button
                      key={infrastructure.id}
                      onClick={() => {
                        onSelectInfrastructure(infrastructure)
                        onOpenChange(false)
                      }}
                      className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-1">{getCategoryIcon(infrastructure.category)}</div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium">{infrastructure.name}</h4>
                            {infrastructure.description && (
                              <p className="text-sm text-muted-foreground truncate">{infrastructure.description}</p>
                            )}
                            {infrastructure.location_name && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3 inline mr-1" />
                                {infrastructure.location_name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge variant={getStatusColor(infrastructure.status)} className="text-xs">
                            {infrastructure.status}
                          </Badge>
                          <Badge variant={getPriorityColor(infrastructure.priority)} className="text-xs">
                            {infrastructure.priority}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Observability Logs */}
          {showLogs && logs.length > 0 && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Agent Execution Logs</h4>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1 text-xs font-mono">
                  {logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-muted-foreground">[{log.state}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty State */}
          {!searching && results.length === 0 && !error && state === SearchAgentState.IDLE && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Enter a natural language query to search infrastructure</p>
              <div className="mt-4 space-y-1 text-xs">
                <p className="font-medium">Example queries:</p>
                <p>"Show all critical internet infrastructure"</p>
                <p>"Water systems needing maintenance"</p>
                <p>"Electricity infrastructure near Clubhouse"</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
