"use client"

import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { FarmMapSatelliteExperience } from "@/components/orchard/farm-map-satellite-experience"

export default function OrchardFarmMapSatellitePage(){
 return <AppLayout><OrchardNavigation/><FarmMapSatelliteExperience/></AppLayout>
}
