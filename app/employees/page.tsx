import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import type { Employee } from "@/lib/types"
import { Plus, Mail, Phone } from "lucide-react"

export default async function EmployeesPage() {
  const supabase = await createClient()

  const { data: employees } = await supabase.from("employees").select("*").order("name")

  return (
    <AppLayout>
      <PageHeader
        title="Employees"
        description="Manage facility staff"
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        }
      />

      <div className="p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {employees && employees.length > 0 ? (
            employees.map((employee: Employee) => (
              <Card key={employee.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-black">{employee.name}</h3>
                      {employee.role && <p className="mt-1 text-sm text-gray-600">{employee.role}</p>}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        employee.is_active
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      }
                    >
                      {employee.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {employee.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${employee.email}`} className="hover:text-blue-600">
                        {employee.email}
                      </a>
                    </div>
                  )}
                  {employee.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${employee.phone}`} className="hover:text-blue-600">
                        {employee.phone}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-500">No employees found</div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
