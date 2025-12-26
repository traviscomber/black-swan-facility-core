import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import type { Volunteer } from "@/lib/types"
import { Mail, Phone, Calendar, Clock } from "lucide-react"
import { AddVolunteerDialog } from "@/components/add-volunteer-dialog"
import { EditVolunteerDialog } from "@/components/edit-volunteer-dialog"
import { DeleteVolunteerButton } from "@/components/delete-volunteer-button"

export const dynamic = "force-dynamic"

export default async function VolunteersPage() {
  const supabase = await createClient()

  const { data: volunteers } = await supabase.from("volunteers").select("*").order("name")

  return (
    <AppLayout>
      <PageHeader
        title="Volunteers"
        description="Manage facility volunteers and their activities"
        actions={<AddVolunteerDialog />}
      />

      <div className="p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {volunteers && volunteers.length > 0 ? (
            volunteers.map((volunteer: Volunteer) => (
              <Card key={volunteer.id}>
                {volunteer.photo_url && (
                  <div className="w-full h-32 bg-slate-200 overflow-hidden">
                    <img
                      src={volunteer.photo_url || "/placeholder.svg"}
                      alt={volunteer.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{volunteer.name}</h3>
                      {volunteer.volunteer_role && (
                        <p className="mt-1 text-sm text-gray-300">{volunteer.volunteer_role}</p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        volunteer.is_active
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      }
                    >
                      {volunteer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {volunteer.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${volunteer.email}`} className="hover:text-blue-400 truncate">
                        {volunteer.email}
                      </a>
                    </div>
                  )}
                  {volunteer.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${volunteer.phone}`} className="hover:text-blue-400">
                        {volunteer.phone}
                      </a>
                    </div>
                  )}
                  {volunteer.start_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Calendar className="h-4 w-4" />
                      <span>Started: {new Date(volunteer.start_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {volunteer.hours_logged > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Clock className="h-4 w-4" />
                      <span>{volunteer.hours_logged} hours logged</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                    <EditVolunteerDialog volunteer={volunteer} />
                    <DeleteVolunteerButton volunteerId={volunteer.id} volunteerName={volunteer.name} />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-500">No volunteers found</div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
