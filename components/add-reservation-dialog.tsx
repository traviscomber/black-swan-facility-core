"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"

interface AddReservationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  preselectedBed?: string
  preselectedDate?: Date
}

export function AddReservationDialog({
  open,
  onOpenChange,
  onSuccess,
  preselectedBed,
  preselectedDate,
}: AddReservationDialogProps) {
  const [beds, setBeds] = useState<any[]>([])
  const [guests, setGuests] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    bed_id: preselectedBed || "",
    guest_id: "",
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    check_in: preselectedDate ? format(preselectedDate, "yyyy-MM-dd") : "",
    check_out: "",
    num_guests: 1,
    total_amount: 0,
    status: "confirmed",
    special_requests: "",
  })

  const supabase = createBrowserClient()

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  async function loadData() {
    const [bedsResult, guestsResult, locationsResult] = await Promise.all([
      supabase
        .from("beds")
        .select(`
          *,
          room:rooms(room_number, room_type, rate_per_night, location)
        `)
        .eq("is_available", true)
        .order("room_id"),
      supabase.from("guests").select("*").order("name"),
      supabase.from("locations").select("*").eq("is_active", true).order("name"),
    ])

    console.log("[v0] Loaded available beds:", bedsResult.data?.length)

    setBeds(bedsResult.data || [])
    setGuests(guestsResult.data || [])
    setLocations(locationsResult.data || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from("reservations").insert([
        {
          bed_id: formData.bed_id,
          guest_name: formData.guest_name,
          guest_email: formData.guest_email,
          guest_phone: formData.guest_phone,
          check_in: formData.check_in,
          check_out: formData.check_out,
          num_guests: formData.num_guests,
          total_amount: formData.total_amount,
          status: formData.status,
          special_requests: formData.special_requests,
        },
      ])

      if (error) throw error

      onSuccess()
      onOpenChange(false)
      resetForm()
    } catch (error) {
      console.error("Error creating reservation:", error)
      alert("Error al crear la reserva")
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      bed_id: "",
      guest_id: "",
      guest_name: "",
      guest_email: "",
      guest_phone: "",
      check_in: "",
      check_out: "",
      num_guests: 1,
      total_amount: 0,
      status: "confirmed",
      special_requests: "",
    })
  }

  function handleGuestSelect(guestId: string) {
    const guest = guests.find((g) => g.id === guestId)
    if (guest) {
      setFormData({
        ...formData,
        guest_id: guestId,
        guest_name: guest.name,
        guest_email: guest.email || "",
        guest_phone: guest.phone || "",
      })
    }
  }

  const filteredBeds =
    selectedLocationFilter === "all" ? beds : beds.filter((bed) => bed.room?.location === selectedLocationFilter)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva Reserva de Cama</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="location_filter">Filtrar por Locación</Label>
              <Select value={selectedLocationFilter} onValueChange={setSelectedLocationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las locaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Locaciones</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.name}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bed_id">Cama</Label>
              <Select value={formData.bed_id} onValueChange={(value) => setFormData({ ...formData, bed_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cama" />
                </SelectTrigger>
                <SelectContent>
                  {filteredBeds.map((bed) => (
                    <SelectItem key={bed.id} value={bed.id}>
                      {bed.room?.room_number} - {bed.bed_number} ({bed.bed_type})
                      {bed.room?.location && ` • ${bed.room.location}`} - ${bed.room?.rate_per_night || 0}/noche
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="guest_id">Huésped Existente (Opcional)</Label>
              <Select value={formData.guest_id} onValueChange={handleGuestSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar huésped" />
                </SelectTrigger>
                <SelectContent>
                  {guests.map((guest) => (
                    <SelectItem key={guest.id} value={guest.id}>
                      {guest.name} - {guest.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_name">Nombre del Huésped *</Label>
              <Input
                id="guest_name"
                value={formData.guest_name}
                onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_email">Email</Label>
              <Input
                id="guest_email"
                type="email"
                value={formData.guest_email}
                onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_phone">Teléfono</Label>
              <Input
                id="guest_phone"
                value={formData.guest_phone}
                onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="num_guests">Número de Personas</Label>
              <Input
                id="num_guests"
                type="number"
                min="1"
                value={formData.num_guests}
                onChange={(e) => setFormData({ ...formData, num_guests: Number.parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_in">Check-in *</Label>
              <Input
                id="check_in"
                type="date"
                value={formData.check_in}
                onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_out">Check-out *</Label>
              <Input
                id="check_out"
                type="date"
                value={formData.check_out}
                onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_amount">Monto Total</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: Number.parseFloat(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="checked_in">Check-in</SelectItem>
                  <SelectItem value="checked_out">Check-out</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special_requests">Solicitudes Especiales</Label>
            <Textarea
              id="special_requests"
              value={formData.special_requests || ""}
              onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear Reserva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
