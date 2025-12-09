"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, DollarSign, Users, MapPin } from "lucide-react"

interface Room {
  id: string
  room_number: string
  room_type: string
  capacity: number
  rate_per_night: number
  status: string
  location: string
  amenities: string[]
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadRooms()
  }, [])

  async function loadRooms() {
    const { data } = await supabase.from("rooms").select("*").order("room_number")
    setRooms(data || [])
    setLoading(false)
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "available":
        return "bg-green-500"
      case "occupied":
        return "bg-blue-500"
      case "maintenance":
        return "bg-yellow-500"
      case "unavailable":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">Room Management</h1>
          <p className="text-sm text-muted-foreground">Manage room inventory and pricing</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Room
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading rooms...</div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rooms.map((room) => (
              <Card key={room.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{room.room_number}</CardTitle>
                    <Badge className={getStatusColor(room.status)}>{room.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{room.room_type}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Up to {room.capacity} guests</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">${room.rate_per_night}</span>
                    <span className="text-muted-foreground">/ night</span>
                  </div>

                  {room.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{room.location}</span>
                    </div>
                  )}

                  {room.amenities && room.amenities.length > 0 && (
                    <div className="border-t pt-3">
                      <div className="flex flex-wrap gap-1">
                        {room.amenities.slice(0, 3).map((amenity, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {amenity}
                          </Badge>
                        ))}
                        {room.amenities.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{room.amenities.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
