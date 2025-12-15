"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Calendar, Home, TrendingUp, Wrench, Sparkles, ArrowRight, Bed, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Dashboard() {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setSearchDialogOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <AppLayout>
      <div className="bg-gradient-to-br from-secondary via-background to-background border-b border-secondary">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-20 md:px-6">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-6">
              <img
                src="/blackswan-logo.png"
                alt="Blackswan Logo"
                className="h-32 w-32 object-contain flex-shrink-0 drop-shadow-lg"
              />
              <div>
                <h1 className="text-5xl md:text-6xl font-bold text-accent leading-tight">
                  Blackswan Facility Core System
                </h1>
                <p className="text-base text-muted-foreground mt-2">BFCS v1.0 - Luxury Property Management</p>
              </div>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Professional facility management and booking system for your luxury vacation rental. Manage reservations,
              track availability, and optimize occupancy rates.
            </p>
            <div className="flex gap-3 pt-4">
              <Link href="/bookings" className="inline-block relative z-10">
                <Button size="lg" className="gap-2">
                  <Calendar className="h-5 w-5" />
                  View Bookings
                </Button>
              </Link>
              <Link href="/property-management" className="inline-block relative z-10">
                <Button variant="outline" size="lg" className="gap-2 bg-transparent">
                  <Home className="h-5 w-5" />
                  Manage Property
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:py-12 md:px-6 space-y-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-12 bg-primary rounded-full"></div>
            <h2 className="text-2xl font-bold text-accent">Property Overview</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Rooms</CardTitle>
                  <Home className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-accent">3</div>
                <p className="text-xs text-muted-foreground mt-2">Dorm-style accommodations</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Available Beds</CardTitle>
                  <Bed className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-accent">6</div>
                <p className="text-xs text-muted-foreground mt-2">Single beds across all rooms</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Occupancy</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-accent">0%</div>
                <p className="text-xs text-muted-foreground mt-2">No active reservations</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-12 bg-primary rounded-full"></div>
            <h2 className="text-2xl font-bold text-accent">Essential Tasks</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-secondary hover:shadow-lg transition-shadow cursor-pointer group relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-accent">
                      <Calendar className="h-5 w-5 text-primary" />
                      Booking Calendar
                    </CardTitle>
                    <CardDescription>View and manage all reservations</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Check availability, create new bookings, and track guest check-ins across all rooms and beds.
                </p>
              </CardContent>
              <Link href="/bookings" className="absolute inset-0 z-0" />
            </Card>

            <Card className="border-secondary hover:shadow-lg transition-shadow cursor-pointer group relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-accent">
                      <Home className="h-5 w-5 text-primary" />
                      Property Management
                    </CardTitle>
                    <CardDescription>Configure rooms and amenities</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Edit room details, manage bed configurations, set rates, and update property availability settings.
                </p>
              </CardContent>
              <Link href="/property-management" className="absolute inset-0 z-0" />
            </Card>

            <Card className="border-secondary hover:shadow-lg transition-shadow cursor-pointer group relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-accent">
                      <Wrench className="h-5 w-5 text-primary" />
                      Maintenance
                    </CardTitle>
                    <CardDescription>Schedule and track maintenance</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Keep track of property maintenance schedules, repairs, and facility improvements.
                </p>
              </CardContent>
              <Link href="/maintenance" className="absolute inset-0 z-0" />
            </Card>

            <Card className="border-secondary hover:shadow-lg transition-shadow cursor-pointer group relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-accent">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Analytics
                    </CardTitle>
                    <CardDescription>View booking trends and insights</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Monitor occupancy rates, revenue trends, and booking patterns to optimize your rental strategy.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="bg-secondary/40 border border-secondary rounded-lg p-6 md:p-8 space-y-4">
          <h3 className="text-xl font-bold text-accent">Getting Started</h3>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold">
                  1
                </div>
                <span className="font-semibold text-accent">Set Up Your Property</span>
              </div>
              <p className="text-muted-foreground text-xs ml-8">Configure rooms, beds, and pricing for your facility</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold">
                  2
                </div>
                <span className="font-semibold text-accent">Create First Booking</span>
              </div>
              <p className="text-muted-foreground text-xs ml-8">
                Add a test reservation to familiarize yourself with the system
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold">
                  3
                </div>
                <span className="font-semibold text-accent">Start Accepting Guests</span>
              </div>
              <p className="text-muted-foreground text-xs ml-8">
                Open your calendar and begin managing real reservations
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setSearchDialogOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        aria-label="Quick search"
      >
        <Sparkles className="h-5 w-5" />
        <span className="font-medium hidden sm:inline">Help & Search</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/20 rounded border border-white/30 ml-2">
          <span>⌘</span>K
        </kbd>
      </button>
    </AppLayout>
  )
}
