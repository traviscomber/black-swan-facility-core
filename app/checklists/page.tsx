import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import type { Checklist } from "@/lib/types"
import Link from "next/link"
import { Plus, ChevronRight } from "lucide-react"

export default async function ChecklistsPage() {
  const supabase = await createClient()

  const { data: checklists } = await supabase.from("checklists").select("*, employees(name)").order("title")

  return (
    <AppLayout>
      <PageHeader
        title="Checklists"
        description="Operational checklists and tasks"
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Checklist
          </Button>
        }
      />

      <div className="p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {checklists && checklists.length > 0 ? (
            checklists.map((checklist: Checklist & { employees?: { name: string } | null }) => (
              <Link key={checklist.id} href={`/checklists/${checklist.id}`}>
                <Card className="cursor-pointer transition-all hover:border-blue-300 hover:shadow-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{checklist.title}</CardTitle>
                        <CardDescription className="mt-1">{checklist.description || "No description"}</CardDescription>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {checklist.frequency && <Badge variant="outline">{checklist.frequency}</Badge>}
                      {checklist.employees && (
                        <span className="text-xs text-gray-600">Assigned to {checklist.employees.name}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-500">No checklists found</div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
