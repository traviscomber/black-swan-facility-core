import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { createClient } from "@/lib/supabase/server"
import type { Employee } from "@/lib/types"
import { AddEmployeeDialog } from "@/components/add-employee-dialog"
import { EmployeeCard } from "@/components/employee-card"

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
            employees.map((employee: Employee) => <EmployeeCard key={employee.id} employee={employee} />)
          ) : (
            <div className="col-span-full text-center text-gray-500">No employees found</div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
