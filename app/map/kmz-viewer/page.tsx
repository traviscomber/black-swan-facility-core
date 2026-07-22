"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KmzUploadDialog } from "@/components/kmz-upload-dialog"
import dynamic from "next/dynamic"
import { Upload, Trash2, Eye, EyeOff, ChevronRight, ChevronLeft, X, Edit2 } from "lucide-react"
import { KmzEditDialog } from "@/components/kmz-edit-dialog"

const DynamicMap = dynamic(() => import("@/components/kmz-map-viewer"), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-gray-100 flex items-center justify-center text-gray-500">Loading map...</div>
  ),
})

interface KmzFile {
  id: string
  name: string
  file_url: string
  color?: string
  description?: string
  created_at?: string
  file_size?: number
  is_visible: boolean
}

interface KmzFilesByDate {
  [key: string]: KmzFile[]
}

const KMZ_PALETTE = ["#2196F3","#E53935","#43A047","#FB8C00","#8E24AA","#00ACC1","#FFB300","#6D4C41"]

export default function KmzViewerPage() {
  const [kmzFiles, setKmzFiles] = useState<KmzFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [editingKmz, setEditingKmz] = useState<KmzFile | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [kmzStats, setKmzStats] = useState<Record<string, { features: number; types: string[]; folders: string[] }>>({})
  const [kmzFeatures, setKmzFeatures] = useState<Record<string, Array<{ name: string; folder: string; type: string; description: string }>>>({})
  const [selectedKmzId, setSelectedKmzId] = useState<string | null>(null)
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false)
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { toast } = useToast()
  const supabase = createClient()
  const mapContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchKmzFiles()
  }, [])

  const fetchKmzFiles = async () => {
    try {
      console.log("[v0] Fetching KMZ overlays from gis_overlays table...")
      setLoading(true)
      const { data, error } = await supabase.from("gis_overlays").select("*").order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error fetching KMZ files:", error)
        if (error.message?.includes("Could not find the table")) {
          toast({
            title: "Setup Required",
            description:
              "The KMZ overlay table needs to be created. Run the migration script: scripts/011_create_gis_overlays_table.sql",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error loading KMZ files",
            description: error.message || "Failed to load overlays",
            variant: "destructive",
          })
        }
        setKmzFiles([])
        return
      }

      console.log("[v0] Fetched KMZ files:", data?.length || 0)
      setKmzFiles(data || [])
      if (data && data.length > 0) {
        const visibleIds = data.filter((f) => f.is_visible).map((f) => f.id)
        setVisibleLayers(new Set(visibleIds))
        console.log("[v0] Auto-showing visible overlays:", visibleIds.length)
      }
    } catch (error) {
      console.error("[v0] Fetch error:", error)
      setKmzFiles([])
    } finally {
      setLoading(false)
    }
  }

  const groupKmzByDate = (files: KmzFile[]): KmzFilesByDate => {
    const grouped: KmzFilesByDate = {}

    files.forEach((file) => {
      const date = file.created_at ? new Date(file.created_at).toLocaleDateString() : "Unknown Date"
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(file)
    })

    return grouped
  }

  const handleDeleteKmz = async (kmzId: string) => {
    if (!confirm("Are you sure you want to delete this KMZ overlay?")) {
      return
    }

    try {
      const { error } = await supabase.from("gis_overlays").delete().eq("id", kmzId)

      if (error) throw error

      setKmzFiles(kmzFiles.filter((f) => f.id !== kmzId))
      setVisibleLayers((prev) => {
        const next = new Set(prev)
        next.delete(kmzId)
        return next
      })

      toast({
        title: "KMZ overlay deleted",
        description: "The overlay has been removed.",
      })
    } catch (error) {
      console.error("[v0] Delete error:", error)
      toast({
        title: "Delete failed",
        description: "Failed to delete the overlay.",
        variant: "destructive",
      })
    }
  }

  const toggleLayerVisibility = async (kmzId: string) => {
    const isCurrentlyVisible = visibleLayers.has(kmzId)

    try {
      const { error } = await supabase.from("gis_overlays").update({ is_visible: !isCurrentlyVisible }).eq("id", kmzId)

      if (error) {
        console.error("[v0] Error updating visibility:", error)
      } else {
        console.log("[v0] Updated visibility for", kmzId, "to", !isCurrentlyVisible)
      }
    } catch (error) {
      console.error("[v0] Visibility update error:", error)
    }

    setVisibleLayers((prev) => {
      const next = new Set(prev)
      if (next.has(kmzId)) {
        next.delete(kmzId)
      } else {
        next.add(kmzId)
      }
      return next
    })
  }

  const filteredFiles = kmzFiles.filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
  const groupedFiles = groupKmzByDate(filteredFiles)
  const dateGroups = Object.keys(groupedFiles).sort().reverse()

  return (
    <main className="map-page relative w-full bg-gray-100 overflow-hidden" style={{ height: "100dvh" }}>
      <div ref={mapContainerRef} className="w-full h-full">
        <DynamicMap
          visibleLayers={visibleLayers}
          kmzFiles={kmzFiles}
          onStats={(id, stats) => setKmzStats(prev => ({ ...prev, [id]: stats }))}
          onFeatures={(id, features) => setKmzFeatures(prev => ({ ...prev, [id]: features }))}
        />
      </div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-2 border border-gray-200 hover:bg-gray-50"
      >
        {sidebarOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>

      <div
        className={`
          ${sidebarOpen ? "fixed md:absolute" : "absolute"} top-0 right-0 bottom-0
          w-[85vw] max-w-md md:max-w-96 md:w-96
          bg-white border-l border-gray-200 shadow-xl md:shadow-none
          transform transition-transform duration-300 ease-in-out z-[999]
          ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
        `}
      >
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4 flex flex-col">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">KMZ Overlays</h2>
            <Button
              onClick={() => setUploadDialogOpen(true)}
              size="sm"
              className="bg-primary hover:bg-primary/90 shadow-lg whitespace-nowrap"
            >
              <Upload className="mr-1 h-4 w-4" />
              Upload
            </Button>
            <button onClick={() => setSidebarOpen(false)} className="p-2 md:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <Input
            placeholder="Search KMZ files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-sm"
          />

          {/* KMZ Files by Date */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500 text-sm">Loading overlays...</div>
            ) : kmzFiles.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-gray-500 text-sm">No overlays uploaded yet</p>
                <details className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-gray-600 hover:text-gray-900 p-2 rounded hover:bg-gray-100">
                    Need help?
                  </summary>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left mt-2">
                    <p className="text-xs text-blue-800 mb-2">Run this SQL migration in your Supabase console:</p>
                    <code className="text-xs bg-white p-2 rounded block overflow-x-auto border border-blue-100 font-mono">
                      scripts/011_create_gis_overlays_table.sql
                    </code>
                  </div>
                </details>
              </div>
            ) : (
              dateGroups.map((date) => (
                <div key={date} className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-700 px-2 py-1 bg-gray-50 rounded">{date}</h3>

                  {/* Files in this date */}
                  <div className="space-y-2">
                    {groupedFiles[date].map((file) => {
                      const globalIndex = kmzFiles.findIndex((f) => f.id === file.id)
                      const dotColor = KMZ_PALETTE[globalIndex % KMZ_PALETTE.length]
                      return (
                      <div
                        key={file.id}
                        className={`p-3 bg-gray-50 rounded-lg border transition-colors space-y-2 cursor-pointer ${selectedKmzId === file.id ? "border-primary/60 bg-primary/5" : "border-gray-200 hover:border-primary/30"}`}
                        onClick={() => {
                          if (kmzFeatures[file.id]) {
                            setSelectedKmzId(file.id)
                            setBottomPanelOpen(true)
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span
                              className="flex-shrink-0 h-3 w-3 rounded-full"
                              style={{ backgroundColor: dotColor }}
                              title={`Color de capa`}
                            />
                            <div className="min-w-0">
                              <h4 className="font-medium text-sm text-gray-900 truncate">{file.name}</h4>
                              {kmzStats[file.id] && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="text-[10px] bg-gray-200 text-gray-600 rounded px-1.5 py-0.5">
                                    {kmzStats[file.id].features} elementos
                                  </span>
                                  {kmzStats[file.id].types.map(t => (
                                    <span key={t} className="text-[10px] bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">{t}</span>
                                  ))}
                                  {kmzStats[file.id].folders.slice(0,2).map(f => (
                                    <span key={f} className="text-[10px] bg-amber-50 text-amber-700 rounded px-1.5 py-0.5 truncate max-w-[100px]" title={f}>{f}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleLayerVisibility(file.id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                            title={visibleLayers.has(file.id) ? "Hide" : "Show"}
                          >
                            {visibleLayers.has(file.id) ? (
                              <Eye className="h-4 w-4 text-primary" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </div>

                        {file.file_size && (
                          <div className="text-xs text-gray-500">{(file.file_size / 1024 / 1024).toFixed(2)} MB</div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => {
                              if (file.file_url) {
                                window.open(file.file_url, "_blank")
                              }
                            }}
                          >
                            Download
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs hover:bg-blue-50"
                            onClick={() => {
                              setEditingKmz(file)
                              setEditDialogOpen(true)
                            }}
                            title="Editar"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteKmz(file.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom features panel */}
      {bottomPanelOpen && selectedKmzId && kmzFeatures[selectedKmzId] && (() => {
        const file = kmzFiles.find(f => f.id === selectedKmzId)
        const features = kmzFeatures[selectedKmzId]
        const globalIndex = kmzFiles.findIndex(f => f.id === selectedKmzId)
        const dotColor = KMZ_PALETTE[globalIndex % KMZ_PALETTE.length]
        const folders = [...new Set(features.map(f => f.folder).filter(Boolean))]

        return (
          <div className="absolute bottom-0 left-0 right-0 md:right-96 z-[998] bg-white border-t border-gray-200 shadow-2xl"
            style={{ maxHeight: "38vh" }}
          >
            {/* Panel header */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
              <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
              <span className="font-semibold text-sm text-gray-900 truncate flex-1">{file?.name}</span>
              <span className="text-xs text-gray-500">{features.length} elementos</span>
              {/* Folder filter tabs */}
              {folders.length > 0 && (
                <div className="flex gap-1 ml-2">
                  {folders.map(folder => (
                    <span key={folder} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">{folder}</span>
                  ))}
                </div>
              )}
              <button
                onClick={() => setBottomPanelOpen(false)}
                className="ml-2 p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto" style={{ maxHeight: "calc(38vh - 44px)" }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left font-semibold text-gray-600 px-3 py-2 w-1/4">Nombre</th>
                    <th className="text-left font-semibold text-gray-600 px-3 py-2 w-1/6">Sub-capa</th>
                    <th className="text-left font-semibold text-gray-600 px-3 py-2 w-20">Tipo</th>
                    <th className="text-left font-semibold text-gray-600 px-3 py-2">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {features.map((feat, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 font-medium text-gray-900 truncate max-w-[180px]" title={feat.name}>{feat.name || "—"}</td>
                      <td className="px-3 py-2 text-amber-700">
                        {feat.folder ? (
                          <span className="bg-amber-50 rounded px-1.5 py-0.5">{feat.folder}</span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 ${
                          feat.type === "Punto" ? "bg-blue-50 text-blue-700" :
                          feat.type === "Línea" ? "bg-green-50 text-green-700" :
                          "bg-purple-50 text-purple-700"
                        }`}>{feat.type}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={feat.description}>{feat.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      <KmzUploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} onUploadSuccess={fetchKmzFiles} />
      
      <KmzEditDialog
        open={editDialogOpen}
        kmz={editingKmz}
        onOpenChange={setEditDialogOpen}
        onSave={fetchKmzFiles}
      />
    </main>
  )
}
