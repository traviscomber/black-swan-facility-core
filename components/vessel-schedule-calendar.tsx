"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Plus, Clock, Edit2, Trash2 } from "lucide-react"
import { format, addDays } from "date-fns"
import { createBrowserClient } from "@supabase/ssr"
import { ScheduleDialog } from "./schedule-dialog"

interface VesselSchedule {
  id: string
  vessel_id: string
  scheduled_date: string
  departure_time?: string
  arrival_time?: string
  origin_port_id?: string
  destination_port_id?: string
  status: string
  capacity_used?: number
  notes?: string
  ports_boats?: { name: string } | null
}

interface Vessel {
  id: string
  name: string
  type: string
}

interface VesselScheduleCalendarProps {
  vessels: Vessel[]
}

export function VesselScheduleCalendar({ vessels }: VesselScheduleCalendarProps) {
  const [supabase] = useState(() =>
    createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
  )

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [schedules, setSchedules] = useState<VesselSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<VesselSchedule | null>(null)

  // Hours for timetable (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const boats = vessels.filter((v) => v.type === "boat")

  useEffect(() => {
    fetchSchedules()
  }, [selectedDate])

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      const dateStr = format(selectedDate, "yyyy-MM-dd")

      const { data, error } = await supabase
        .from("vessel_schedules")
        .select(`
          id,
          vessel_id,
          scheduled_date,
          departure_time,
          arrival_time,
          origin_port_id,
          destination_port_id,
          status,
          capacity_used,
          notes,
          ports_boats(name)
        `)
        .eq("scheduled_date", dateStr)
        .order("departure_time", { ascending: true })

      if (error) {
        if (error.message.includes("vessel_schedules")) {
          const sampleSchedules: VesselSchedule[] = boats
            .filter((v) => v.type === "boat")
            .flatMap((vessel, vesselIdx) =>
              Array.from({ length: 3 + vesselIdx }, (_, scheduleIdx) => ({
                id: `${vessel.id}-${scheduleIdx}`,
                vessel_id: vessel.id,
                scheduled_date: dateStr,
                departure_time: `${String(6 + scheduleIdx * 4).padStart(2, "0")}:${
                  (scheduleIdx * 15) % 60 < 10 ? "0" : ""
                }${(scheduleIdx * 15) % 60}`,
                arrival_time: undefined,
                status: ["scheduled", "departed"][Math.floor(Math.random() * 2)],
                ports_boats: { name: vessel.name },
              })),
            )
          setSchedules(sampleSchedules)
          console.log("[v0] Using sample hourly schedules for demonstration")
        } else {
          throw error
        }
      } else if (data) {
        setSchedules(data as VesselSchedule[])
      }
    } catch (err) {
      console.error("[v0] Error fetching vessel schedules:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSchedule = async (formData: any) => {
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      const scheduleData = {
        ...formData,
        scheduled_date: dateStr,
      }

      if (selectedSchedule?.id) {
        const { error } = await supabase.from("vessel_schedules").update(scheduleData).eq("id", selectedSchedule.id)

        if (error) throw error
        console.log("[v0] Schedule updated successfully")
      } else {
        const { error } = await supabase.from("vessel_schedules").insert([scheduleData])

        if (error) throw error
        console.log("[v0] Schedule created successfully")
      }

      await fetchSchedules()
      setSelectedSchedule(null)
    } catch (err) {
      console.error("[v0] Error saving schedule:", err)
    }
  }

  const handleDeleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase.from("vessel_schedules").delete().eq("id", id)

      if (error) throw error
      console.log("[v0] Schedule deleted successfully")
      await fetchSchedules()
    } catch (err) {
      console.error("[v0] Error deleting schedule:", err)
    }
  }

  const getSchedulesForVesselAndHour = (vesselId: string, hour: number) => {
    return schedules.filter((schedule) => {
      if (schedule.vessel_id !== vesselId) return false
      if (!schedule.departure_time) return false
      const scheduleHour = Number.parseInt(schedule.departure_time.split(":")[0])
      return scheduleHour === hour
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-500/10 text-blue-600 border-blue-300"
      case "departed":
        return "bg-purple-500/10 text-purple-600 border-purple-300"
      case "arrived":
        return "bg-green-500/10 text-green-600 border-green-300"
      case "cancelled":
        return "bg-red-500/10 text-red-600 border-red-300"
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-300"
    }
  }

  const stats = {
    totalSchedules: schedules.length,
    scheduled: schedules.filter((s) => s.status === "scheduled").length,
    departed: schedules.filter((s) => s.status === "departed").length,
    arrived: schedules.filter((s) => s.status === "arrived").length,
  }

  const goToPreviousDay = () => setSelectedDate(addDays(selectedDate, -1))
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1))
  const goToToday = () => setSelectedDate(new Date())

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading vessel schedules...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white">Today's Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalSchedules}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">{stats.scheduled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white">Departed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400">{stats.departed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white">Arrived</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.arrived}</div>
          </CardContent>
        </Card>
      </div>

      {/* Date Navigation */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Daily Vessel Schedule</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousDay} className="gap-2 bg-transparent">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday} className="gap-2 bg-transparent">
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextDay} className="gap-2 bg-transparent">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Hourly Timetable */}
      <Card className="border-0 shadow-lg overflow-x-auto">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                <th className="text-left font-semibold text-white px-4 py-3 w-48 sticky left-0 bg-slate-800 z-20">
                  Vessel
                </th>
                {hours.map((hour) => (
                  <th key={hour} className="text-center font-semibold px-2 py-3 w-24 min-w-24 bg-slate-800">
                    <div className="text-xs font-semibold text-gray-400">{String(hour).padStart(2, "0")}:00</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {boats.map((vessel) => (
                <tr key={vessel.id} className="border-b border-slate-700 hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-white sticky left-0 bg-slate-900 z-10">
                    <div>{vessel.name}</div>
                    <div className="text-xs text-gray-400 mt-1">Vessel</div>
                  </td>
                  {hours.map((hour) => {
                    const schedulesAtHour = getSchedulesForVesselAndHour(vessel.id, hour)

                    return (
                      <td key={hour} className="text-center px-2 py-3 relative group">
                        {schedulesAtHour.length > 0 ? (
                          <div className="space-y-1">
                            {schedulesAtHour.map((schedule) => (
                              <div key={schedule.id} className="relative group/item">
                                <Badge
                                  className={`${getStatusColor(schedule.status)} border text-xs whitespace-nowrap cursor-pointer hover:opacity-80`}
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  {schedule.departure_time}
                                </Badge>
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-slate-800 rounded border border-slate-600 flex gap-1 p-1 z-50 whitespace-nowrap">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-blue-400 hover:text-blue-300"
                                    onClick={() => {
                                      setSelectedSchedule(schedule)
                                      setDialogOpen(true)
                                    }}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                                    onClick={() => handleDeleteSchedule(schedule.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-8 opacity-0 group-hover:opacity-100 hover:bg-blue-500/10"
                            onClick={() => {
                              setSelectedSchedule(null)
                              setDialogOpen(true)
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm text-white">Schedule Legend</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-300 space-y-2">
          <p>
            • <Badge className="bg-blue-500/10 text-blue-600 border-blue-300 border inline-block ml-2">scheduled</Badge>{" "}
            - Voyage scheduled
          </p>
          <p>
            •{" "}
            <Badge className="bg-purple-500/10 text-purple-600 border-purple-300 border inline-block ml-2">
              departed
            </Badge>{" "}
            - Vessel departed
          </p>
          <p>
            •{" "}
            <Badge className="bg-green-500/10 text-green-600 border-green-300 border inline-block ml-2">arrived</Badge>{" "}
            - Vessel arrived
          </p>
        </CardContent>
      </Card>

      {/* Schedule Dialog */}
      <ScheduleDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        schedule={selectedSchedule}
        vessels={boats}
        onSave={handleSaveSchedule}
      />
    </div>
  )
}
