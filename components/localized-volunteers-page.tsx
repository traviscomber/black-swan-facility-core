"use client"

import { useMemo } from "react"
import { Calendar, Clock, Mail, Phone } from "lucide-react"
import { AddVolunteerDialog } from "@/components/add-volunteer-dialog"
import { DeleteVolunteerButton } from "@/components/delete-volunteer-button"
import { EditVolunteerDialog } from "@/components/edit-volunteer-dialog"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useLanguage } from "@/lib/hooks/use-language"
import type { Volunteer } from "@/lib/types"

const COPY = {
  en: { title: "Volunteers", description: "Manage facility volunteers and their activities", active: "Active", inactive: "Inactive", started: "Started", hours: "hours logged", empty: "No volunteers found" },
  es: { title: "Voluntarios", description: "Gestiona voluntarios del recinto y sus actividades", active: "Activo", inactive: "Inactivo", started: "Inicio", hours: "horas registradas", empty: "No se encontraron voluntarios" },
  de: { title: "Freiwillige", description: "Freiwillige und ihre Tätigkeiten verwalten", active: "Aktiv", inactive: "Inaktiv", started: "Beginn", hours: "erfasste Stunden", empty: "Keine Freiwilligen gefunden" },
} as const

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const

export function LocalizedVolunteersPage({ volunteers }: { volunteers: Volunteer[] }) {
  const { language } = useLanguage()
  const copy = COPY[language]
  const date = useMemo(() => new Intl.DateTimeFormat(LOCALES[language], { dateStyle: "medium" }), [language])
  const number = useMemo(() => new Intl.NumberFormat(LOCALES[language]), [language])

  return (
    <>
      <PageHeader title={copy.title} description={copy.description} actions={<AddVolunteerDialog />} />
      <div className="p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {volunteers.length > 0 ? volunteers.map((volunteer) => (
            <Card key={volunteer.id}>
              {volunteer.photo_url && (
                <div className="h-32 w-full overflow-hidden bg-slate-200">
                  <img src={volunteer.photo_url || "/placeholder.svg"} alt={volunteer.name} className="h-full w-full object-cover" />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{volunteer.name}</h3>
                    {volunteer.volunteer_role && <p className="mt-1 text-sm text-gray-300">{volunteer.volunteer_role}</p>}
                  </div>
                  <Badge variant="outline" className={volunteer.is_active ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}>
                    {volunteer.is_active ? copy.active : copy.inactive}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {volunteer.email && <div className="flex items-center gap-2 text-sm text-gray-300"><Mail className="h-4 w-4" /><a href={`mailto:${volunteer.email}`} className="truncate hover:text-blue-400">{volunteer.email}</a></div>}
                {volunteer.phone && <div className="flex items-center gap-2 text-sm text-gray-300"><Phone className="h-4 w-4" /><a href={`tel:${volunteer.phone}`} className="hover:text-blue-400">{volunteer.phone}</a></div>}
                {volunteer.start_date && <div className="flex items-center gap-2 text-sm text-gray-300"><Calendar className="h-4 w-4" /><span>{copy.started}: {date.format(new Date(volunteer.start_date))}</span></div>}
                {volunteer.hours_logged > 0 && <div className="flex items-center gap-2 text-sm text-gray-300"><Clock className="h-4 w-4" /><span>{number.format(volunteer.hours_logged)} {copy.hours}</span></div>}
                <div className="flex items-center gap-2 border-t border-gray-700 pt-2">
                  <EditVolunteerDialog volunteer={volunteer} />
                  <DeleteVolunteerButton volunteerId={volunteer.id} volunteerName={volunteer.name} />
                </div>
              </CardContent>
            </Card>
          )) : <div className="col-span-full text-center text-gray-500">{copy.empty}</div>}
        </div>
      </div>
    </>
  )
}
