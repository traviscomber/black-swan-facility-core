"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, LogIn, LogOut, UtensilsCrossed } from "lucide-react"
import { format, addDays, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns"

interface DailySummary {
  date: Date
  checkIns: number
  checkOuts: number
  totalGuests: number
  mealsCount: number
  occupancyRate: number
}

interface DailySummaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DailySummaryModal({ open, onOpenChange }: DailySummaryModalProps) {
  const supabase = createClient()
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [tomorrowSummary, setTomorrowSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchSummaryData()
    }
  }, [open])

  const fetchSummaryData = async () => {
    try {
      setLoading(true)
      const today = new Date()
      const tomorrow = addDays(today, 1)

      // Fetch all reservations
      const { data: reservations, error } = await supabase
        .from("reservations")
        .select("check_in, check_out, num_guests, status")
        .eq("status", "confirmed")

      if (error) throw error

      // Calculate today's summary
      const todayStart = startOfDay(today)
      const todayEnd = endOfDay(today)

      let todayCheckIns = 0
      let todayCheckOuts = 0
      let todayGuests = 0

      reservations?.forEach((res) => {
        const checkInDate = parseISO(res.check_in)
        const checkOutDate = parseISO(res.check_out)

        if (isWithinInterval(today, { start: checkInDate, end: checkOutDate })) {
          todayGuests += res.num_guests || 0
        }

        if (format(checkInDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
          todayCheckIns++
        }

        if (format(checkOutDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
          todayCheckOuts++
        }
      })

      // Get total beds for occupancy
      const { data: beds } = await supabase.from("beds").select("id")
      const totalBeds = beds?.length || 1

      setSummary({
        date: today,
        checkIns: todayCheckIns,
        checkOuts: todayCheckOuts,
        totalGuests: todayGuests,
        mealsCount: todayGuests * 3, // 3 meals per guest
        occupancyRate: Math.round((todayGuests / totalBeds) * 100),
      })

      // Calculate tomorrow's summary
      const tomorrowStart = startOfDay(tomorrow)
      const tomorrowEnd = endOfDay(tomorrow)

      let tomorrowCheckIns = 0
      let tomorrowCheckOuts = 0
      let tomorrowGuests = 0

      reservations?.forEach((res) => {
        const checkInDate = parseISO(res.check_in)
        const checkOutDate = parseISO(res.check_out)

        if (isWithinInterval(tomorrow, { start: checkInDate, end: checkOutDate })) {
          tomorrowGuests += res.num_guests || 0
        }

        if (format(checkInDate, "yyyy-MM-dd") === format(tomorrow, "yyyy-MM-dd")) {
          tomorrowCheckIns++
        }

        if (format(checkOutDate, "yyyy-MM-dd") === format(tomorrow, "yyyy-MM-dd")) {
          tomorrowCheckOuts++
        }
      })

      setTomorrowSummary({
        date: tomorrow,
        checkIns: tomorrowCheckIns,
        checkOuts: tomorrowCheckOuts,
        totalGuests: tomorrowGuests,
        mealsCount: tomorrowGuests * 3,
        occupancyRate: Math.round((tomorrowGuests / totalBeds) * 100),
      })
    } catch (error) {
      console.error("Error fetching summary data:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Daily Operations Summary</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Today Summary */}
            {summary && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Today - {format(summary.date, "EEEE, MMM d")}</h3>
                  <Badge variant="default" className="bg-amber-500">
                    Today
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Check-Ins
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600">{summary.checkIns}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-red-900 flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        Check-Outs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">{summary.checkOuts}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-900 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Guests
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">{summary.totalGuests}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-orange-200 bg-orange-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-orange-900 flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4" />
                        Meals
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-600">{summary.mealsCount}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Occupancy Bar */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Occupancy Rate</span>
                    <span className="text-lg font-bold text-accent">{summary.occupancyRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${summary.occupancyRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* Tomorrow Summary */}
            {tomorrowSummary && (
              <div className="space-y-3 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Tomorrow - {format(tomorrowSummary.date, "EEEE, MMM d")}</h3>
                  <Badge variant="outline">Tomorrow</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Check-Ins
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600">{tomorrowSummary.checkIns}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-red-900 flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        Check-Outs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">{tomorrowSummary.checkOuts}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-900 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Guests
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">{tomorrowSummary.totalGuests}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-orange-200 bg-orange-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-orange-900 flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4" />
                        Meals
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-600">{tomorrowSummary.mealsCount}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Occupancy Bar */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Occupancy Rate</span>
                    <span className="text-lg font-bold text-accent">{tomorrowSummary.occupancyRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${tomorrowSummary.occupancyRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
