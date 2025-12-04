import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import type { AssetLog } from "@/lib/types"
import { notFound } from "next/navigation"
import { AlertTriangle, FileText, MapPin, Calendar } from "lucide-react"
import Link from "next/link"
import QRCode from "react-qr-code"

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: asset } = await supabase.from("assets").select("*").eq("id", id).single()

  if (!asset) {
    notFound()
  }

  const { data: logs } = await supabase
    .from("asset_logs")
    .select("*")
    .eq("asset_id", id)
    .order("created_at", { ascending: false })

  // Generate QR code URL
  const qrCodeUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.example.com"}/assets/${id}`

  return (
    <AppLayout>
      <PageHeader title={asset.name} description={`${asset.type} - ${asset.location || "No location"}`} />

      <div className="p-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Asset Header Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {asset.name}
                      {asset.is_critical && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          Critical
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-2">{asset.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Type</p>
                    <p className="mt-1 text-sm text-gray-900">{asset.type}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Location</p>
                    <p className="mt-1 text-sm text-gray-900">{asset.location || "Not specified"}</p>
                  </div>
                  {asset.latitude && asset.longitude && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-700">Coordinates</p>
                      <p className="mt-1 text-sm text-gray-900">
                        {asset.latitude}, {asset.longitude}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Maintenance logs and events</CardDescription>
              </CardHeader>
              <CardContent>
                {logs && logs.length > 0 ? (
                  <div className="space-y-4">
                    {logs.map((log: AssetLog) => (
                      <div key={log.id} className="flex gap-4 border-l-2 border-gray-200 pl-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {log.log_type && (
                              <Badge variant="outline" className="text-xs">
                                {log.log_type}
                              </Badge>
                            )}
                            <span className="text-xs text-gray-500">{formatDate(log.created_at)}</span>
                          </div>
                          <p className="mt-1 text-sm text-gray-900">{log.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No activity logs yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/issues/report?asset=${id}`}>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Report Issue
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Calendar className="mr-2 h-4 w-4" />
                  Add Log
                </Button>
                {asset.manual_url && (
                  <a href={asset.manual_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <FileText className="mr-2 h-4 w-4" />
                      View Manual
                    </Button>
                  </a>
                )}
                {asset.latitude && asset.longitude && (
                  <Link href={`/map?asset=${id}`}>
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <MapPin className="mr-2 h-4 w-4" />
                      View on Map
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* QR Code */}
            {asset.is_critical && (
              <Card>
                <CardHeader>
                  <CardTitle>QR Code</CardTitle>
                  <CardDescription>Scan to access asset details</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
                    <QRCode value={qrCodeUrl} size={160} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Photo Gallery */}
            {asset.photo_url && (
              <Card>
                <CardHeader>
                  <CardTitle>Photos</CardTitle>
                </CardHeader>
                <CardContent>
                  <img src={asset.photo_url || "/placeholder.svg"} alt={asset.name} className="w-full rounded-lg" />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
