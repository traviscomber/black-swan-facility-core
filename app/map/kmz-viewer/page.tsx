"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { KmzUploadDialog } from "@/components/kmz-upload-dialog"
import dynamic from "next/dynamic"
import "leaflet/dist/leaflet.css"
import { Upload, Trash2, Eye, EyeOff, Download, Calendar } from "lucide-react"

// Dynamically import Leaflet to avoid SSR issues
const DynamicMap = dynamic(() => import("@/components/kmz-map-viewer"), {
  ssr: false,
  loading: () => <div className="h-full bg-gray-100 flex items-center justify-center">Loading map...</div>,
})

interface KmzFile {
  id: string
  name: string
  file_url: string
  description?: string
  created_at?: string
  file_size?: number
  is_active: boolean
}

export default function KmzViewerPage() {
  const [kmzFiles, setKmzFiles] = useState<KmzFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchKmzFiles()
  }, [])

  const fetchKmzFiles = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("kmz_files")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error fetching KMZ files:", error)
        toast({
          title: "Error loading KMZ files",
          description: "The KMZ files table may not exist. Please run the migration script.",
          variant: "destructive",
        })
        return
      }

      setKmzFiles(data || [])
      // Auto-show first KMZ file
      if (data && data.length > 0) {
        setVisibleLayers(new Set([data[0].id]))
      }
    } catch (error) {
      console.error("[v0] Fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteKmz = async (kmzId: string) => {
    if (!confirm("Are you sure you want to delete this KMZ overlay?")) {
      return
    }

    try {
      const { error } = await supabase.from("kmz_files").update({ is_active: false }).eq("id", kmzId)

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

  const toggleLayerVisibility = (kmzId: string) => {
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">KMZ Viewer</h1>
          <p className="text-gray-600">Upload and manage KMZ files for facility mapping and GIS overlays</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map Panel */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Map View</CardTitle>
                <CardDescription>
                  {visibleLayers.size === 0
                    ? "Select overlays to view on map"
                    : `Displaying ${visibleLayers.size} overlay(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden border border-gray-200 h-96 md:h-[500px] bg-gray-100">
                  <DynamicMap visibleLayers={visibleLayers} kmzFiles={kmzFiles} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KMZ Management Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Manage Overlays
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => setUploadDialogOpen(true)} className="w-full bg-primary hover:bg-primary/90">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload KMZ
                </Button>

                <div>
                  <Input
                    placeholder="Search overlays..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading overlays...</div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">No overlays uploaded yet</div>
                  ) : (
                    filteredFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-gray-900 truncate">{file.name}</h4>
                            {file.description && (
                              <p className="text-xs text-gray-600 truncate mt-1">{file.description}</p>
                            )}
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

                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                          {file.created_at && (
                            <>
                              <Calendar className="h-3 w-3" />
                              {new Date(file.created_at).toLocaleDateString()}
                            </>
                          )}
                          {file.file_size && (
                            <>
                              <span>•</span>
                              <span>{(file.file_size / 1024 / 1024).toFixed(2)} MB</span>
                            </>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" asChild>
                            <a href={file.file_url} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </a>
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
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <KmzUploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} onUploadSuccess={fetchKmzFiles} />
    </main>
  )
}
