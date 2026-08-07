"use client"

import type React from "react"
import { ReservationConfirmationModal } from "@/components/reservation-confirmation-modal"
import { AvailabilityCalendarPicker } from "@/components/availability-calendar-picker"
import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { addReservationCopy, fillReservationCopy } from "@/lib/translations/add-reservation"

interface Room {
  room_number: string
  room_type: string
  rate_per_night: number
  location: string
  location_id: string
  location_ref?: { id: string; name: string }
  capacity?: number
  max_guests?: number
}

interface Bed {
  id: string
  bed_number: string
  bed_type: string
  is_available: boolean
  room_id: string
  room?: Room
}

interface Guest {
  id: string
  name: string
  email?: string
  phone?: string
}

interface Location {
  id: string
  name: string
  is_active: boolean
}

interface ReservationConfirmationData {
  guestName: string
  bedInfo: string
  checkIn: string
  checkOut: string
  nights: number
  totalAmount: number
  locationName: string
}

interface AddReservationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  preselectedBed?: string
  preselectedDate?: Date
  preselectedCheckOut?: Date
  preselectedLocation?: string
}

export function AddReservationDialog({
  open,
  onOpenChange,
  onSuccess,
  preselectedBed,
  preselectedDate,
  preselectedCheckOut,
  preselectedLocation,
}: AddReservationDialogProps) {
  const { language } = useLanguage()
  const copy = addReservationCopy[language]
  const { loading: accessLoading, can, canAccessDepartment } = useEffectiveAccess()
  const canCreateReservation = can("booking.modify") && canAccessDepartment("booking")
  const [beds, setBeds] = useState<Bed[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationData, setConfirmationData] = useState<ReservationConfirmationData | null>(null)
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null)

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
    if (open && canCreateReservation) loadData()
  }, [open, canCreateReservation])

  async function loadData() {
    const [bedsResult, guestsResult, locationsResult] = await Promise.all([
      supabase
        .from("beds")
        .select(`
          *,
          room:rooms(
            room_number,
            room_type,
            rate_per_night,
            location,
            location_id,
            location_ref:locations!rooms_location_id_fkey(id, name)
          )
        `)
        .eq("is_available", true)
        .order("room_id"),
      supabase.from("guests").select("*").order("name"),
      supabase.from("locations").select("*").eq("is_active", true).order("name"),
    ])

    setBeds(bedsResult.data || [])
    setGuests(guestsResult.data || [])
    setLocations(locationsResult.data || [])

    if (preselectedLocation && locationsResult.data) {
      const matchingLocation = locationsResult.data.find((loc: Location) => loc.name === preselectedLocation)
      if (matchingLocation) setSelectedLocationFilter(preselectedLocation)
    }
  }

  useEffect(() => {
    if (preselectedBed && preselectedLocation && beds.length > 0) {
      const matchingBed = beds.find((bed) => {
        const bedLocationName = bed.room?.location_ref?.name || bed.room?.location
        return bed.id === preselectedBed && bedLocationName === preselectedLocation
      })
      if (matchingBed) setFormData((prev) => ({ ...prev, bed_id: preselectedBed }))
    }
  }, [beds, preselectedBed, preselectedLocation])

  useEffect(() => {
    if (preselectedDate) {
      const checkInDate = new Date(preselectedDate)
      const checkOutDate = preselectedCheckOut ?? new Date(checkInDate)
      if (!preselectedCheckOut) checkOutDate.setDate(checkOutDate.getDate() + 1)
      setFormData((prev) => ({
        ...prev,
        check_in: format(preselectedDate, "yyyy-MM-dd"),
        check_out: format(checkOutDate, "yyyy-MM-dd"),
      }))
    }
  }, [preselectedDate, preselectedCheckOut])

  useEffect(() => {
    if (formData.bed_id && formData.num_guests) {
      const selectedBed = beds.find((b) => b.id === formData.bed_id)
      if (selectedBed?.room) {
        const roomCapacity = selectedBed.room.capacity || selectedBed.room.max_guests || 2
        if (formData.num_guests > roomCapacity) {
          setCapacityWarning(fillReservationCopy(copy.capacityWarning, {
            guests: formData.num_guests,
            capacity: roomCapacity,
          }))
        } else setCapacityWarning(null)
      }
    }
  }, [beds, copy.capacityWarning, formData.bed_id, formData.num_guests])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canCreateReservation) {
      alert(copy.noPermissionScope)
      return
    }

    const checkIn = new Date(formData.check_in)
    const checkOut = new Date(formData.check_out)
    if (checkOut <= checkIn) {
      alert(copy.invalidDates)
      return
    }

    const selectedBed = beds.find((b) => b.id === formData.bed_id)
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    setConfirmationData({
      guestName: formData.guest_name,
      bedInfo: `${selectedBed?.room?.room_number} - ${selectedBed?.bed_number}`,
      checkIn: formData.check_in,
      checkOut: formData.check_out,
      nights,
      totalAmount: formData.total_amount,
      locationName: selectedLocationFilter === "all" ? copy.multiple : selectedLocationFilter,
    })
    setShowConfirmation(true)
  }

  async function confirmAndCreateReservation() {
    if (!canCreateReservation) {
      alert(copy.noPermissionScope)
      setShowConfirmation(false)
      return
    }
    setLoading(true)
    try {
      const response = await fetch("/api/bookings/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        alert(result.error || (response.status === 409 ? copy.conflict : copy.createFailed))
        setShowConfirmation(false)
        return
      }
      if (!result.success) {
        alert(result.error || copy.createFailed)
        setShowConfirmation(false)
        return
      }

      setShowConfirmation(false)
      onSuccess()
      onOpenChange(false)
      resetForm()
    } catch (error) {
      console.error("Error creating reservation:", error)
      alert(error instanceof Error ? error.message : copy.errorCreating)
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

  const filteredBeds = selectedLocationFilter === "all"
    ? beds
    : beds.filter((bed) => {
        const locationName = bed.room?.location_ref?.name || bed.room?.location
        return locationName === selectedLocationFilter
      })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{copy.title}</DialogTitle></DialogHeader>

          {!accessLoading && !canCreateReservation ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              {copy.noPermissionDepartment}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {capacityWarning && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">{capacityWarning}</p>
                  <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">{copy.capacityNote}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="location_filter">{copy.filterLocation}</Label>
                  <Select value={selectedLocationFilter} onValueChange={setSelectedLocationFilter}>
                    <SelectTrigger><SelectValue placeholder={copy.allLocations} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{copy.allLocations}</SelectItem>
                      {locations.map((loc) => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bed_id">{copy.bed}</Label>
                  <Select value={formData.bed_id} onValueChange={(value) => setFormData({ ...formData, bed_id: value })}>
                    <SelectTrigger><SelectValue placeholder={copy.selectBed} /></SelectTrigger>
                    <SelectContent>
                      {filteredBeds.map((bed) => (
                        <SelectItem key={bed.id} value={bed.id}>
                          {bed.room?.room_number} - {bed.bed_number} ({bed.bed_type})
                          {bed.room?.location_ref?.name && ` • ${bed.room.location_ref.name}`} - ${bed.room?.rate_per_night || 0}/{copy.perNight}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="guest_id">{copy.existingGuest}</Label>
                  <Select value={formData.guest_id} onValueChange={handleGuestSelect}>
                    <SelectTrigger><SelectValue placeholder={copy.selectGuest} /></SelectTrigger>
                    <SelectContent>
                      {guests.map((guest) => <SelectItem key={guest.id} value={guest.id}>{guest.name} - {guest.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest_name">{copy.guestName} *</Label>
                  <Input id="guest_name" value={formData.guest_name} onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest_email">{copy.email}</Label>
                  <Input id="guest_email" type="email" value={formData.guest_email} onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest_phone">{copy.phone}</Label>
                  <Input id="guest_phone" value={formData.guest_phone} onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="num_guests">{copy.numberGuests}</Label>
                  <Input id="num_guests" type="number" min="1" value={formData.num_guests} onChange={(e) => setFormData({ ...formData, num_guests: Number.parseInt(e.target.value) })} required />
                  <p className="text-xs text-muted-foreground">{copy.capacityHint}</p>
                </div>

                {formData.bed_id && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>{copy.selectDates} *</Label>
                    <AvailabilityCalendarPicker
                      bedId={formData.bed_id}
                      onDateRangeSelect={(checkIn, checkOut) => setFormData({ ...formData, check_in: checkIn, check_out: checkOut })}
                      currentCheckIn={formData.check_in}
                      currentCheckOut={formData.check_out}
                    />
                  </div>
                )}

                {!formData.bed_id && <div className="sm:col-span-2 text-sm italic text-muted-foreground">{copy.selectBedHint}</div>}

                <div className="space-y-2">
                  <Label htmlFor="total_amount">{copy.totalAmount}</Label>
                  <Input id="total_amount" type="number" step="0.01" value={formData.total_amount} onChange={(e) => setFormData({ ...formData, total_amount: Number.parseFloat(e.target.value) })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{copy.status}</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">{copy.confirmed}</SelectItem>
                      <SelectItem value="pending">{copy.pending}</SelectItem>
                      <SelectItem value="checked_in">{copy.checkedIn}</SelectItem>
                      <SelectItem value="checked_out">{copy.checkedOut}</SelectItem>
                      <SelectItem value="cancelled">{copy.cancelled}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="special_requests">{copy.specialRequests}</Label>
                <Textarea id="special_requests" value={formData.special_requests || ""} onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })} rows={3} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{copy.cancel}</Button>
                <Button type="submit" disabled={loading || accessLoading || !canCreateReservation}>
                  {loading ? copy.creating : copy.create}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ReservationConfirmationModal
        open={showConfirmation && canCreateReservation}
        onOpenChange={setShowConfirmation}
        onConfirm={confirmAndCreateReservation}
        reservationDetails={confirmationData}
        loading={loading}
      />
    </>
  )
}
