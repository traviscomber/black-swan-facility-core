"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Plus,
  Sun,
  Zap,
  TrendingUp,
  Activity,
  Trash2,
  Pencil,
  Gauge,
  Battery,
  Cpu,
  BatteryCharging,
  Monitor,
  Edit2,
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface SolarPanel {
  id: string
  name: string
  location: string
  building: string // added building association
  capacity_kw: number
  status: "active" | "maintenance" | "inactive"
  installation_date: string
  last_maintenance: string
  victron_device_id?: string
  current_output_kw?: number
}

interface VictronDevice {
  id: string
  device_name: string
  device_type: "charge_controller" | "inverter" | "battery" | "monitor" | "other"
  model: string
  serial_number?: string
  location: string
  status: "online" | "offline" | "warning" | "error"
  firmware_version?: string
  vrm_device_id?: string
  last_seen?: string
  specifications?: {
    voltage?: string
    current?: string
    capacity?: string
    power?: string
  }
}

interface BuildingConsumption {
  id: string
  building_name: string
  location: string
  current_usage_kw: number
  daily_usage_kwh: number
  monthly_usage_kwh: number
  solar_offset_percent: number
  last_updated: string
}

export default function EnergyManagementPage() {
  const [solarPanels, setSolarPanels] = useState<SolarPanel[]>([
    // Prairie House 1 - 24 panels (6 per roof section)
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `ph1-north-${i + 1}`,
      name: `Panel ${i + 1}`,
      location: "Roof - North",
      building: "Prairie House 1",
      capacity_kw: 0.4,
      status: "active" as const,
      installation_date: "2024-01-15",
      last_maintenance: new Date().toISOString(),
      victron_device_id: "PH1-MPPT-001",
      current_output_kw: 0.32,
    })),
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `ph1-south-${i + 1}`,
      name: `Panel ${i + 13}`,
      location: "Roof - South",
      building: "Prairie House 1",
      capacity_kw: 0.4,
      status: "active" as const,
      installation_date: "2024-01-15",
      last_maintenance: new Date().toISOString(),
      victron_device_id: "PH1-MPPT-001",
      current_output_kw: 0.32,
    })),

    // Prairie House 2 - 24 panels (6 per roof section, with Victron equipment)
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `ph2-north-${i + 1}`,
      name: `Panel ${i + 1}`,
      location: "Roof - North",
      building: "Prairie House 2",
      capacity_kw: 0.4,
      status: "active" as const,
      installation_date: "2024-01-15",
      last_maintenance: new Date().toISOString(),
      victron_device_id: "PH2-MPPT-001",
      current_output_kw: 0.32,
    })),
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `ph2-south-${i + 1}`,
      name: `Panel ${i + 13}`,
      location: "Roof - South",
      building: "Prairie House 2",
      capacity_kw: 0.4,
      status: "active" as const,
      installation_date: "2024-01-15",
      last_maintenance: new Date().toISOString(),
      victron_device_id: "PH2-MPPT-001",
      current_output_kw: 0.32,
    })),

    // Prairie House 3 - 24 panels (6 per roof section)
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `ph3-north-${i + 1}`,
      name: `Panel ${i + 1}`,
      location: "Roof - North",
      building: "Prairie House 3",
      capacity_kw: 0.4,
      status: "active" as const,
      installation_date: "2024-01-15",
      last_maintenance: new Date().toISOString(),
      victron_device_id: "PH3-MPPT-001",
      current_output_kw: 0.32,
    })),
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `ph3-south-${i + 1}`,
      name: `Panel ${i + 13}`,
      location: "Roof - South",
      building: "Prairie House 3",
      capacity_kw: 0.4,
      status: "active" as const,
      installation_date: "2024-01-15",
      last_maintenance: new Date().toISOString(),
      victron_device_id: "PH3-MPPT-001",
      current_output_kw: 0.32,
    })),
  ])
  const [buildings, setBuildings] = useState<BuildingConsumption[]>([])
  const [victronDevices, setVictronDevices] = useState<VictronDevice[]>([])
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [showAddBuilding, setShowAddBuilding] = useState(false)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [editingPanel, setEditingPanel] = useState<SolarPanel | null>(null)
  const [editingBuilding, setEditingBuilding] = useState<BuildingConsumption | null>(null)
  const [editingDevice, setEditingDevice] = useState<VictronDevice | null>(null)

  const [selectedBuilding, setSelectedBuilding] = useState<string>("all")
  const filteredPanels =
    selectedBuilding === "all" ? solarPanels : solarPanels.filter((p) => p.building === selectedBuilding)
  const buildingsList = ["Prairie House 1", "Prairie House 2", "Prairie House 3"]

  const [formData, setFormData] = useState({
    name: "",
    location: "",
    building: "", // added building field
    capacity_kw: "",
    status: "active",
    installation_date: "",
    victron_device_id: "",
  })

  const [buildingFormData, setBuildingFormData] = useState({
    building_name: "",
    location: "",
  })

  const [deviceFormData, setDeviceFormData] = useState({
    device_name: "",
    device_type: "charge_controller",
    model: "",
    serial_number: "",
    location: "",
    status: "online",
    firmware_version: "",
    vrm_device_id: "",
    voltage: "",
    current: "",
    capacity: "",
    power: "",
  })

  const supabase = createBrowserClient()

  useEffect(() => {
    loadSolarPanels()
    loadBuildings()
    loadVictronDevices()
  }, [])

  const loadSolarPanels = async () => {
    const { data } = await supabase.from("solar_panels").select("*").order("name")
    if (data) setSolarPanels(data)
  }

  const loadBuildings = async () => {
    const { data } = await supabase.from("building_consumption").select("*").order("building_name")
    if (data) setBuildings(data)
  }

  const loadVictronDevices = async () => {
    const { data } = await supabase.from("victron_devices").select("*").order("device_name")
    if (data) setVictronDevices(data)
  }

  const handleAddPanel = async () => {
    const { error } = await supabase.from("solar_panels").insert([
      {
        name: formData.name,
        location: formData.location,
        building: formData.building, // added building field
        capacity_kw: Number.parseFloat(formData.capacity_kw),
        status: formData.status,
        installation_date: formData.installation_date,
        victron_device_id: formData.victron_device_id || null,
        last_maintenance: new Date().toISOString(),
      },
    ])

    if (!error) {
      loadSolarPanels()
      setShowAddPanel(false)
      resetForm()
    }
  }

  const handleUpdatePanel = async () => {
    if (!editingPanel) return

    const { error } = await supabase
      .from("solar_panels")
      .update({
        name: formData.name,
        location: formData.location,
        building: formData.building, // added building field
        capacity_kw: Number.parseFloat(formData.capacity_kw),
        status: formData.status,
        victron_device_id: formData.victron_device_id || null,
      })
      .eq("id", editingPanel.id)

    if (!error) {
      loadSolarPanels()
      setEditingPanel(null)
      resetForm()
    }
  }

  const handleDeletePanel = async (id: string) => {
    await supabase.from("solar_panels").delete().eq("id", id)
    loadSolarPanels()
  }

  const handleAddBuilding = async () => {
    const { error } = await supabase.from("building_consumption").insert([
      {
        building_name: buildingFormData.building_name,
        location: buildingFormData.location,
        current_usage_kw: 0,
        daily_usage_kwh: 0,
        monthly_usage_kwh: 0,
        solar_offset_percent: 0,
        last_updated: new Date().toISOString(),
      },
    ])

    if (!error) {
      loadBuildings()
      setShowAddBuilding(false)
      resetBuildingForm()
    }
  }

  const handleDeleteBuilding = async (id: string) => {
    await supabase.from("building_consumption").delete().eq("id", id)
    loadBuildings()
  }

  const resetForm = () => {
    setFormData({
      name: "",
      location: "",
      building: "", // added building field
      capacity_kw: "",
      status: "active",
      installation_date: "",
      victron_device_id: "",
    })
  }

  const resetBuildingForm = () => {
    setBuildingFormData({
      building_name: "",
      location: "",
    })
  }

  const handleAddDevice = async () => {
    const {
      device_name,
      device_type,
      model,
      serial_number,
      location,
      status,
      firmware_version,
      vrm_device_id,
      voltage,
      current,
      capacity,
      power,
    } = deviceFormData

    const specifications: any = {}
    if (voltage) specifications.voltage = voltage
    if (current) specifications.current = current
    if (capacity) specifications.capacity = capacity
    if (power) specifications.power = power

    const { error } = await supabase.from("victron_devices").insert({
      device_name,
      device_type,
      model,
      serial_number: serial_number || null,
      location,
      status,
      firmware_version: firmware_version || null,
      vrm_device_id: vrm_device_id || null,
      last_seen: new Date().toISOString(),
      specifications: Object.keys(specifications).length > 0 ? specifications : null,
    })

    if (!error) {
      loadVictronDevices()
      setShowAddDevice(false)
      setDeviceFormData({
        device_name: "",
        device_type: "charge_controller",
        model: "",
        serial_number: "",
        location: "",
        status: "online",
        firmware_version: "",
        vrm_device_id: "",
        voltage: "",
        current: "",
        capacity: "",
        power: "",
      })
    }
  }

  const handleUpdateDevice = async () => {
    if (!editingDevice) return

    const {
      device_name,
      device_type,
      model,
      serial_number,
      location,
      status,
      firmware_version,
      vrm_device_id,
      voltage,
      current,
      capacity,
      power,
    } = deviceFormData

    const specifications: any = {}
    if (voltage) specifications.voltage = voltage
    if (current) specifications.current = current
    if (capacity) specifications.capacity = capacity
    if (power) specifications.power = power

    const { error } = await supabase
      .from("victron_devices")
      .update({
        device_name,
        device_type,
        model,
        serial_number: serial_number || null,
        location,
        status,
        firmware_version: firmware_version || null,
        vrm_device_id: vrm_device_id || null,
        specifications: Object.keys(specifications).length > 0 ? specifications : null,
      })
      .eq("id", editingDevice.id)

    if (!error) {
      loadVictronDevices()
      setEditingDevice(null)
    }
  }

  const handleDeleteDevice = async (id: string) => {
    if (confirm("Are you sure you want to delete this device?")) {
      await supabase.from("victron_devices").delete().eq("id", id)
      loadVictronDevices()
    }
  }

  const openEditDevice = (device: VictronDevice) => {
    setEditingDevice(device)
    setDeviceFormData({
      device_name: device.device_name,
      device_type: device.device_type,
      model: device.model,
      serial_number: device.serial_number || "",
      location: device.location,
      status: device.status,
      firmware_version: device.firmware_version || "",
      vrm_device_id: device.vrm_device_id || "",
      voltage: device.specifications?.voltage || "",
      current: device.specifications?.current || "",
      capacity: device.specifications?.capacity || "",
      power: device.specifications?.power || "",
    })
  }

  const totalCapacity = filteredPanels.reduce((sum, panel) => sum + panel.capacity_kw, 0)
  const activeCapacity = filteredPanels
    .filter((p) => p.status === "active")
    .reduce((sum, panel) => sum + panel.capacity_kw, 0)
  const totalConsumption = buildings.reduce((sum, b) => sum + b.current_usage_kw, 0)
  const avgSolarOffset =
    buildings.length > 0 ? buildings.reduce((sum, b) => sum + b.solar_offset_percent, 0) / buildings.length : 0

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground flex items-center gap-2">
              <Zap className="h-8 w-8 sm:h-10 sm:w-10 text-yellow-500" />
              Off Grid Energy Management
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Track solar panels, batteries, and Victron equipment for off-grid power systems
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Sun className="h-4 w-4" />
                Total Solar Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{totalCapacity.toFixed(1)} kW</p>
              <p className="text-xs text-muted-foreground mt-1">{activeCapacity.toFixed(1)} kW active</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Current Consumption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{totalConsumption.toFixed(1)} kW</p>
              <p className="text-xs text-muted-foreground mt-1">{buildings.length} buildings monitored</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Solar Offset
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{avgSolarOffset.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground mt-1">Average across buildings</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Battery className="h-4 w-4" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-green-500">Operational</p>
              <p className="text-xs text-muted-foreground mt-1">All systems online</p>
            </CardContent>
          </Card>
        </div>

        {/* Solar Panels Section */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                <Sun className="h-6 w-6 text-yellow-500" />
                Solar Panels ({filteredPanels.length})
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Total Capacity: {totalCapacity.toFixed(1)} kW
              </p>
            </div>
            <Button
              onClick={() => setShowAddPanel(true)}
              className="w-full sm:w-auto gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Add Panel
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedBuilding === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedBuilding("all")}
              className={selectedBuilding === "all" ? "bg-yellow-600 text-white" : "border-border hover:bg-secondary"}
            >
              All Buildings ({solarPanels.length})
            </Button>
            {buildingsList.map((building) => {
              const count = solarPanels.filter((p) => p.building === building).length
              return (
                <Button
                  key={building}
                  variant={selectedBuilding === building ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedBuilding(building)}
                  className={
                    selectedBuilding === building ? "bg-yellow-600 text-white" : "border-border hover:bg-secondary"
                  }
                >
                  {building} ({count})
                </Button>
              )
            })}
          </div>

          <Accordion type="multiple" className="space-y-2">
            {buildingsList.map((building) => {
              const buildingPanels = filteredPanels.filter((p) =>
                p.building === building || selectedBuilding === "all" ? true : p.building === building,
              )
              const buildingCapacity = buildingPanels.reduce((sum, p) => sum + p.capacity_kw, 0)
              const buildingOutput = buildingPanels.reduce((sum, p) => sum + (p.current_output_kw || 0), 0)

              if (selectedBuilding !== "all" && selectedBuilding !== building) return null

              return (
                <AccordionItem key={building} value={building} className="border-border bg-card rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 text-left">
                      <Sun className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{building}</p>
                        <p className="text-xs text-muted-foreground">
                          {buildingPanels.length} panels • {buildingCapacity.toFixed(1)} kW •{" "}
                          {buildingOutput.toFixed(2)} kW output
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t border-border">
                      {buildingPanels.length > 0 ? (
                        buildingPanels.map((panel) => (
                          <Card key={panel.id} className="bg-background border-border">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <Sun className="h-5 w-5 text-yellow-500" />
                                  <div>
                                    <CardTitle className="text-base text-foreground">{panel.name}</CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">
                                      {panel.location}
                                    </CardDescription>
                                  </div>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    panel.status === "active"
                                      ? "bg-green-500/20 text-green-400"
                                      : panel.status === "maintenance"
                                        ? "bg-yellow-500/20 text-yellow-400"
                                        : "bg-red-500/20 text-red-400"
                                  }`}
                                >
                                  {panel.status}
                                </span>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Capacity:</span>
                                <span className="font-semibold text-foreground">{panel.capacity_kw} kW</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>Output:</span>
                                <span className="font-semibold text-green-400">{panel.current_output_kw} kW</span>
                              </div>
                              {panel.victron_device_id && (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Victron ID:</span>
                                  <span className="font-mono text-xs text-foreground">{panel.victron_device_id}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-muted-foreground">
                                <span>Installed:</span>
                                <span className="text-foreground">
                                  {new Date(panel.installation_date).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex gap-2 pt-2 border-t border-border">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 gap-1 text-foreground border-border hover:bg-secondary bg-transparent"
                                  onClick={() => {
                                    setEditingPanel(panel)
                                    setFormData({
                                      name: panel.name,
                                      location: panel.location,
                                      building: panel.building,
                                      capacity_kw: panel.capacity_kw.toString(),
                                      status: panel.status,
                                      installation_date: panel.installation_date,
                                      victron_device_id: panel.victron_device_id || "",
                                    })
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-red-400 border-red-400/30 hover:bg-red-500/10 bg-transparent"
                                  onClick={() => handleDeletePanel(panel.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <Card className="col-span-full bg-background border-border border-dashed">
                          <CardContent className="flex flex-col items-center justify-center py-8">
                            <Sun className="h-10 w-10 text-muted mb-2" />
                            <p className="text-muted-foreground text-sm text-center">No panels in this building</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>

          {filteredPanels.length === 0 && (
            <Card className="col-span-full bg-card border-border border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Sun className="h-12 w-12 text-muted mb-4" />
                <p className="text-muted-foreground text-center">No panels found for the selected building.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Building Consumption Section */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Gauge className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              Building Consumption
            </h2>
            <Dialog open={showAddBuilding} onOpenChange={setShowAddBuilding}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Building
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card text-foreground">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Add Building Monitor</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Register a building for electricity consumption tracking
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="building_name" className="text-foreground">
                      Building Name
                    </Label>
                    <Input
                      id="building_name"
                      value={buildingFormData.building_name}
                      onChange={(e) => setBuildingFormData({ ...buildingFormData, building_name: e.target.value })}
                      placeholder="e.g., Main House"
                      className="bg-background text-foreground border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="building_location" className="text-foreground">
                      Location
                    </Label>
                    <Input
                      id="building_location"
                      value={buildingFormData.location}
                      onChange={(e) => setBuildingFormData({ ...buildingFormData, location: e.target.value })}
                      placeholder="Area or zone"
                      className="bg-background text-foreground border-border"
                    />
                  </div>
                  <Button onClick={handleAddBuilding} className="w-full">
                    Add Building Monitor
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {buildings.map((building) => (
              <Card key={building.id} className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base text-foreground">{building.building_name}</CardTitle>
                      <CardDescription className="text-muted-foreground">{building.location}</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDeleteBuilding(building.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Current Usage</p>
                      <p className="text-lg font-bold text-foreground">{building.current_usage_kw.toFixed(2)} kW</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Daily Total</p>
                      <p className="text-lg font-bold text-foreground">{building.daily_usage_kwh.toFixed(1)} kWh</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Monthly Total</p>
                      <p className="text-lg font-bold text-foreground">{building.monthly_usage_kwh.toFixed(0)} kWh</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Solar Offset</p>
                      <p className="text-lg font-bold text-green-400">{building.solar_offset_percent}%</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(building.last_updated).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}

            {buildings.length === 0 && (
              <Card className="col-span-full bg-card border-border border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Gauge className="h-12 w-12 text-muted mb-4" />
                  <p className="text-muted-foreground text-center">
                    No buildings monitored yet. Add buildings to track electricity consumption.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Victron Devices Section */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Cpu className="h-6 w-6 text-blue-500" />
              Victron Equipment
            </h2>
            <Button
              onClick={() => setShowAddDevice(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Device
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {victronDevices.map((device) => (
              <Card key={device.id} className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base text-foreground flex items-center gap-2">
                        {device.device_type === "charge_controller" && <Battery className="h-4 w-4 text-yellow-500" />}
                        {device.device_type === "inverter" && <Zap className="h-4 w-4 text-orange-500" />}
                        {device.device_type === "battery" && <BatteryCharging className="h-4 w-4 text-green-500" />}
                        {device.device_type === "monitor" && <Monitor className="h-4 w-4 text-blue-500" />}
                        {device.device_type === "other" && <Cpu className="h-4 w-4 text-gray-500" />}
                        {device.device_name}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground text-xs">{device.model}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-blue-400 hover:bg-blue-500/10"
                        onClick={() => openEditDevice(device)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDeleteDevice(device.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Badge
                      variant={
                        device.status === "online"
                          ? "default"
                          : device.status === "warning"
                            ? "secondary"
                            : "destructive"
                      }
                      className={
                        device.status === "online"
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : device.status === "warning"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                      }
                    >
                      {device.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Location:</span>
                      <span className="text-foreground">{device.location}</span>
                    </div>
                    {device.serial_number && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Serial:</span>
                        <span className="font-mono text-foreground text-[10px]">{device.serial_number}</span>
                      </div>
                    )}
                    {device.vrm_device_id && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>VRM ID:</span>
                        <span className="font-mono text-foreground text-[10px]">{device.vrm_device_id}</span>
                      </div>
                    )}
                    {device.firmware_version && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Firmware:</span>
                        <span className="text-foreground">{device.firmware_version}</span>
                      </div>
                    )}
                  </div>
                  {device.specifications && Object.keys(device.specifications).length > 0 && (
                    <div className="pt-2 border-t border-border space-y-1">
                      <p className="text-xs font-semibold text-foreground">Specifications:</p>
                      {device.specifications.voltage && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Voltage:</span>
                          <span className="text-foreground">{device.specifications.voltage}</span>
                        </div>
                      )}
                      {device.specifications.current && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Current:</span>
                          <span className="text-foreground">{device.specifications.current}</span>
                        </div>
                      )}
                      {device.specifications.capacity && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Capacity:</span>
                          <span className="text-foreground">{device.specifications.capacity}</span>
                        </div>
                      )}
                      {device.specifications.power && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Power:</span>
                          <span className="text-foreground">{device.specifications.power}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {device.last_seen && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Last seen: {new Date(device.last_seen).toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {victronDevices.length === 0 && (
              <Card className="col-span-full bg-card border-border border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Cpu className="h-12 w-12 text-muted mb-4" />
                  <p className="text-muted-foreground text-center">
                    No Victron devices registered yet. Add your equipment to track and monitor.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Victron Integration Info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Victron Integration
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Open source monitoring via VRM API, MQTT, and Node-RED
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>This system integrates with Victron Energy hardware using open source protocols:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong className="text-foreground">VRM JSON API:</strong> Query real-time and historical data from the
                VRM Portal
              </li>
              <li>
                <strong className="text-foreground">MQTT:</strong> Real-time device communication via dbus-mqtt
              </li>
              <li>
                <strong className="text-foreground">Node-RED:</strong> Low-code automation for data flows and controls
              </li>
              <li>
                <strong className="text-foreground">Grafana:</strong> Visualization dashboards with InfluxDB backend
              </li>
            </ul>
            <p className="pt-2 text-xs">
              Configure Victron Device IDs in solar panel settings to enable automatic data synchronization.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Edit Panel Dialog */}
      <Dialog open={!!editingPanel} onOpenChange={() => setEditingPanel(null)}>
        <DialogContent className="bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Solar Panel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-foreground">
                Panel Name
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location" className="text-foreground">
                Location
              </Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="bg-background text-foreground border-border"
              />
            </div>
            {/* Add building selection */}
            <div className="space-y-2">
              <Label htmlFor="edit-building" className="text-foreground">
                Building
              </Label>
              <Select
                value={formData.building}
                onValueChange={(value) => setFormData({ ...formData, building: value })}
              >
                <SelectTrigger className="bg-background text-foreground border-border">
                  <SelectValue placeholder="Select Building" />
                </SelectTrigger>
                <SelectContent>
                  {buildingsList.map((building) => (
                    <SelectItem key={building} value={building}>
                      {building}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-capacity" className="text-foreground">
                Capacity (kW)
              </Label>
              <Input
                id="edit-capacity"
                type="number"
                step="0.1"
                value={formData.capacity_kw}
                onChange={(e) => setFormData({ ...formData, capacity_kw: e.target.value })}
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-victron" className="text-foreground">
                Victron Device ID
              </Label>
              <Input
                id="edit-victron"
                value={formData.victron_device_id}
                onChange={(e) => setFormData({ ...formData, victron_device_id: e.target.value })}
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status" className="text-foreground">
                Status
              </Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger className="bg-background text-foreground border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdatePanel} className="w-full">
              Update Panel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Device Dialog */}
      <Dialog open={showAddDevice} onOpenChange={setShowAddDevice}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Victron Device</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Register a new Victron Energy device for monitoring
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="device_name" className="text-foreground">
                  Device Name *
                </Label>
                <Input
                  id="device_name"
                  value={deviceFormData.device_name}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, device_name: e.target.value })}
                  placeholder="e.g., Prairie House 2 - MPPT"
                  className="bg-background text-foreground border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="device_type" className="text-foreground">
                  Device Type *
                </Label>
                <select
                  id="device_type"
                  value={deviceFormData.device_type}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, device_type: e.target.value as any })}
                  className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2"
                >
                  <option value="charge_controller">Charge Controller</option>
                  <option value="inverter">Inverter/Charger</option>
                  <option value="battery">Battery</option>
                  <option value="monitor">Monitor/GX Device</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model" className="text-foreground">
                  Model *
                </Label>
                <Input
                  id="model"
                  value={deviceFormData.model}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, model: e.target.value })}
                  placeholder="e.g., SmartSolar MPPT 250|100"
                  className="bg-background text-foreground border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-foreground">
                  Location *
                </Label>
                <Input
                  id="location"
                  value={deviceFormData.location}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, location: e.target.value })}
                  placeholder="e.g., Prairie House 2"
                  className="bg-background text-foreground border-border"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serial_number" className="text-foreground">
                  Serial Number
                </Label>
                <Input
                  id="serial_number"
                  value={deviceFormData.serial_number}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, serial_number: e.target.value })}
                  placeholder="Optional"
                  className="bg-background text-foreground border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vrm_device_id" className="text-foreground">
                  VRM Device ID
                </Label>
                <Input
                  id="vrm_device_id"
                  value={deviceFormData.vrm_device_id}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, vrm_device_id: e.target.value })}
                  placeholder="From VRM Portal"
                  className="bg-background text-foreground border-border"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firmware_version" className="text-foreground">
                  Firmware Version
                </Label>
                <Input
                  id="firmware_version"
                  value={deviceFormData.firmware_version}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, firmware_version: e.target.value })}
                  placeholder="e.g., v3.14"
                  className="bg-background text-foreground border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-foreground">
                  Status
                </Label>
                <select
                  id="status"
                  value={deviceFormData.status}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, status: e.target.value as any })}
                  className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2"
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground mb-3">Specifications (Optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="voltage" className="text-foreground">
                    Voltage
                  </Label>
                  <Input
                    id="voltage"
                    value={deviceFormData.voltage}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, voltage: e.target.value })}
                    placeholder="e.g., 48V"
                    className="bg-background text-foreground border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="current" className="text-foreground">
                    Current
                  </Label>
                  <Input
                    id="current"
                    value={deviceFormData.current}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, current: e.target.value })}
                    placeholder="e.g., 100A"
                    className="bg-background text-foreground border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity" className="text-foreground">
                    Capacity
                  </Label>
                  <Input
                    id="capacity"
                    value={deviceFormData.capacity}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, capacity: e.target.value })}
                    placeholder="e.g., 5kWh per unit"
                    className="bg-background text-foreground border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="power" className="text-foreground">
                    Power
                  </Label>
                  <Input
                    id="power"
                    value={deviceFormData.power}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, power: e.target.value })}
                    placeholder="e.g., 5000W"
                    className="bg-background text-foreground border-border"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDevice(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={handleAddDevice} className="bg-blue-600 hover:bg-blue-700">
              Add Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Device Dialog */}
      <Dialog open={!!editingDevice} onOpenChange={() => setEditingDevice(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Victron Device</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update device information and specifications
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_device_name" className="text-foreground">
                  Device Name *
                </Label>
                <Input
                  id="edit_device_name"
                  value={deviceFormData.device_name}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, device_name: e.target.value })}
                  className="bg-background text-foreground border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_device_type" className="text-foreground">
                  Device Type *
                </Label>
                <select
                  id="edit_device_type"
                  value={deviceFormData.device_type}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, device_type: e.target.value as any })}
                  className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2"
                >
                  <option value="charge_controller">Charge Controller</option>
                  <option value="inverter">Inverter/Charger</option>
                  <option value="battery">Battery</option>
                  <option value="monitor">Monitor/GX Device</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_model" className="text-foreground">
                  Model *
                </Label>
                <Input
                  id="edit_model"
                  value={deviceFormData.model}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, model: e.target.value })}
                  className="bg-background text-foreground border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_location" className="text-foreground">
                  Location *
                </Label>
                <Input
                  id="edit_location"
                  value={deviceFormData.location}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, location: e.target.value })}
                  className="bg-background text-foreground border-border"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_serial_number" className="text-foreground">
                  Serial Number
                </Label>
                <Input
                  id="edit_serial_number"
                  value={deviceFormData.serial_number}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, serial_number: e.target.value })}
                  className="bg-background text-foreground border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_vrm_device_id" className="text-foreground">
                  VRM Device ID
                </Label>
                <Input
                  id="edit_vrm_device_id"
                  value={deviceFormData.vrm_device_id}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, vrm_device_id: e.target.value })}
                  className="bg-background text-foreground border-border"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_firmware_version" className="text-foreground">
                  Firmware Version
                </Label>
                <Input
                  id="edit_firmware_version"
                  value={deviceFormData.firmware_version}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, firmware_version: e.target.value })}
                  className="bg-background text-foreground border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_status" className="text-foreground">
                  Status
                </Label>
                <select
                  id="edit_status"
                  value={deviceFormData.status}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, status: e.target.value as any })}
                  className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2"
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground mb-3">Specifications (Optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_voltage" className="text-foreground">
                    Voltage
                  </Label>
                  <Input
                    id="edit_voltage"
                    value={deviceFormData.voltage}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, voltage: e.target.value })}
                    className="bg-background text-foreground border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_current" className="text-foreground">
                    Current
                  </Label>
                  <Input
                    id="edit_current"
                    value={deviceFormData.current}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, current: e.target.value })}
                    className="bg-background text-foreground border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_capacity" className="text-foreground">
                    Capacity
                  </Label>
                  <Input
                    id="edit_capacity"
                    value={deviceFormData.capacity}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, capacity: e.target.value })}
                    className="bg-background text-foreground border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_power" className="text-foreground">
                    Power
                  </Label>
                  <Input
                    id="edit_power"
                    value={deviceFormData.power}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, power: e.target.value })}
                    className="bg-background text-foreground border-border"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDevice(null)} className="border-border">
              Cancel
            </Button>
            <Button onClick={handleUpdateDevice} className="bg-blue-600 hover:bg-blue-700">
              Update Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
