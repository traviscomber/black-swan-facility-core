import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import type { Employee } from "@/lib/types"
import { Mail, Phone } from "lucide-react"
import { AddEmployeeDialog } from "@/components/add-employee-dialog"
import { EditEmployeeDialog } from "@/components/edit-employee-dialog"
import { DeleteEmployeeButton } from "@/components/delete-employee-button"

export const dynamic = "force-dynamic"

export default async function EmployeesPage() {
  const supabase = await createClient()

  const { data: employees } = await supabase.from("employees").select("*").order("name")

  return (
    <AppLayout>
      <PageHeader title="Employees" description="Manage facility staff" actions={<AddEmployeeDialog />} />

      <div className="p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {employees && employees.length > 0 ? (
            employees.map((employee: Employee) => (
              <Card key={employee.id}>
                {employee.photo_url && (
                  <div className="w-full h-32 bg-slate-200 overflow-hidden">
                    <img
                      src={employee.photo_url || "/placeholder.svg"}
                      alt={employee.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{employee.name}</h3>
                      {employee.role && <p className="mt-1 text-sm text-gray-300">{employee.role}</p>}
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
                <CardContent className="space-y-3">
                  {employee.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${employee.email}`} className="hover:text-blue-400 truncate">
                        {employee.email}
                      </a>
                    </div>
                  )}
                  {employee.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${employee.phone}`} className="hover:text-blue-400">
                        {employee.phone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                    <EditEmployeeDialog employee={employee} />
                    <DeleteEmployeeButton employeeId={employee.id} employeeName={employee.name} />
                  </div>
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
