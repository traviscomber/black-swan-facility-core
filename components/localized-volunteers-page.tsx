"use client"

import { useMemo } from "react"
import { Calendar, Clock, Mail, Phone } from "lucide-react"
import { AddVolunteerDialog } from "@/components/add-volunteer-dialog"
import { DeleteVolunteerButton } from "@/components/delete-volunteer-button"
import { EditVolunteerDialog } from "@/components/edit-volunteer-dialog"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/hooks/use-language"
import type { Volunteer } from "@/lib/types"

const COPY = {
  en: { title: "Volunteers", description: "Facility volunteers, operational availability and recorded participation.", active: "Active", inactive: "Inactive", started: "Started", hours: "hours logged", empty: "No volunteers found" },
  es: { title: "Voluntarios", description: "Voluntarios del recinto, disponibilidad operativa y participación registrada.", active: "Activo", inactive: "Inactivo", started: "Inicio", hours: "horas registradas", empty: "No se encontraron voluntarios" },
  de: { title: "Freiwillige", description: "Freiwillige des Betriebs, operative Verfügbarkeit und erfasste Mitarbeit.", active: "Aktiv", inactive: "Inaktiv", started: "Beginn", hours: "erfasste Stunden", empty: "Keine Freiwilligen gefunden" },
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
      <div className="p-4 md:p-6">
        {volunteers.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {volunteers.map((volunteer) => (
              <article key={volunteer.id} className={`overflow-hidden border bg-card/30 ${volunteer.is_active ? "border-border" : "border-border/60 opacity-70"}`}>
                {volunteer.photo_url && <img src={volunteer.photo_url} alt={volunteer.name} className="h-36 w-full border-b object-cover" />}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-foreground">{volunteer.name}</h3>
                      {volunteer.volunteer_role && <p className="mt-1 text-sm text-muted-foreground">{volunteer.volunteer_role}</p>}
                    </div>
                    <Badge variant="outline" className={volunteer.is_active ? "border-primary/30 text-primary" : "border-muted-foreground/30 text-muted-foreground"}>{volunteer.is_active ? copy.active : copy.inactive}</Badge>
                  </div>

                  <div className="mt-4 min-h-20 space-y-2 text-sm text-muted-foreground">
                    {volunteer.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><a href={`mailto:${volunteer.email}`} className="truncate hover:text-foreground hover:underline">{volunteer.email}</a></div>}
                    {volunteer.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /><a href={`tel:${volunteer.phone}`} className="hover:text-foreground hover:underline">{volunteer.phone}</a></div>}
                    {volunteer.start_date && <div className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0" /><span>{copy.started}: {date.format(new Date(volunteer.start_date))}</span></div>}
                    {volunteer.hours_logged > 0 && <div className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" /><span>{number.format(volunteer.hours_logged)} {copy.hours}</span></div>}
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t pt-3">
                    <EditVolunteerDialog volunteer={volunteer} />
                    <DeleteVolunteerButton volunteerId={volunteer.id} volunteerName={volunteer.name} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="border-y py-12 text-center text-sm text-muted-foreground">{copy.empty}</div>}
      </div>
    </>
  )
}
