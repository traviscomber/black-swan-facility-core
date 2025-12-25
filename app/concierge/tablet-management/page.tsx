"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Smartphone, MapPin, Clock } from "lucide-react"
import { format } from "date-fns"

interface TabletDevice {
  id: string
  device_id: string
  device_name: string
  location_id: string
  assigned_at: string
  last_active_at: string
  is_active: boolean
  location?: { name: string }
}

export default function TabletManagementPage() {
  const [tablets, setTablets] = useState<TabletDevice[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTablet, setSelectedTablet] = useState<TabletDevice | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [newLocationId, setNewLocationId] = useState("")
  const [updating, setUpdating] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: tabletsData, error: tabletsError } = await supabase
        .from("tablet_devices")
        .select(`
          *,
          location:locations(name)
        `)
        .order("last_active_at", { ascending: false })

      if (tabletsError) throw tabletsError

      const { data: locationsData, error: locationsError } = await supabase
        .from("locations")
        .select("*")
        .eq("is_active", true)

      if (locationsError) throw locationsError

      setTablets(tabletsData || [])
      setLocations(locationsData || [])
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateTablet() {
    if (!selectedTablet || !newLocationId) return

    setUpdating(true)
    try {
      const { error } = await supabase
        .from("tablet_devices")
        .update({
          location_id: newLocationId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTablet.id)

      if (error) throw error

      setEditDialogOpen(false)
      setSelectedTablet(null)
      setNewLocationId("")
      loadData()
    } catch (error) {
      console.error("Error updating tablet:", error)
      alert("Failed to update tablet")
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeactivateTablet(tabletId: string) {
    if (!confirm("Are you sure you want to deactivate this tablet?")) return

    try {
      const { error } = await supabase
        .from("tablet_devices")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", tabletId)

      if (error) throw error
      loadData()
    } catch (error) {
      console.error("Error deactivating tablet:", error)
      alert("Failed to deactivate tablet")
    }
  }

  const activeTablets = tablets.filter((t) => t.is_active)
  const inactiveTablets = tablets.filter((t) => !t.is_active)

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageHeader
          title="Tablet Device Management"
          description="Manage hospitality request tablets across all locations"
          icon={Smartphone}
        />

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{activeTablets.length}</div>
                <p className="text-sm text-muted-foreground">Active Tablets</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-500">{inactiveTablets.length}</div>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">{locations.length}</div>
                <p className="text-sm text-muted-foreground">Locations</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Tablets */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading tablets...</div>
        ) : (
          <>
            {activeTablets.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Active Tablets</h3>
                {activeTablets.map((tablet) => (
                  <Card key={tablet.id} className="border-border/50 hover:border-border/80 transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold">{tablet.device_name}</h4>
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{tablet.location?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>Last active: {format(new Date(tablet.last_active_at), "MMM d, h:mm a")}</span>
                            </div>
                            <div className="text-xs text-muted-foreground/70">ID: {tablet.device_id}</div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTablet(tablet)
                            setNewLocationId(tablet.location_id)
                            setEditDialogOpen(true)
                          }}
                        >
                          Reassign
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Inactive Tablets */}
            {inactiveTablets.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-muted-foreground">Inactive Tablets</h3>
                {inactiveTablets.map((tablet) => (
                  <Card key={tablet.id} className="border-border/50 opacity-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5 text-muted-foreground" />
                            <h4 className="font-semibold text-muted-foreground">{tablet.device_name}</h4>
                            <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">Inactive</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground/70">{tablet.location?.name}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty State */}
            {activeTablets.length === 0 && inactiveTablets.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No tablets registered yet. They'll appear here when guests first use them.</p>
              </div>
            )}
          </>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reassign Tablet to Location</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Assignment</label>
                <div className="p-3 bg-secondary/30 rounded border border-border">{selectedTablet?.device_name}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to Location</label>
                <Select value={newLocationId} onValueChange={setNewLocationId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updating}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTablet} disabled={updating} className="bg-primary">
                {updating ? "Updating..." : "Reassign Tablet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
