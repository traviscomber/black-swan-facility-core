"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { GuestHouseQr } from "@/components/guest-house-qr"

type Location = { id: string; name: string; is_active: boolean }
type Language = "es" | "en" | "de"

function localeFromPath(pathname: string): Language {
  const locale = pathname.split("/")[1]
  return locale === "en" || locale === "de" ? locale : "es"
}

export function GuestHouseQrAuto() {
  const pathname = usePathname()
  const language = localeFromPath(pathname)
  const [location, setLocation] = useState<Location | null>(null)
  const [deviceId, setDeviceId] = useState("")

  useEffect(() => {
    const assignedLocationId = localStorage.getItem("tablet_assigned_location_id")
    const storedDeviceId = localStorage.getItem("tablet_device_id")
    if (!assignedLocationId || !storedDeviceId) return
    setDeviceId(storedDeviceId)

    async function load() {
      const response = await fetch(`/api/guest-requests?location_id=${encodeURIComponent(assignedLocationId)}`, { cache: "no-store" })
      if (!response.ok) return
      const payload = await response.json()
      const locations = (payload.locations ?? []) as Location[]
      setLocation(locations.find((item) => item.id === assignedLocationId) ?? null)
    }
    void load()
  }, [])

  if (!location || !deviceId) return null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8 md:px-6 md:pb-12">
      <GuestHouseQr locationId={location.id} locationName={location.name} deviceId={deviceId} language={language} />
    </div>
  )
}
