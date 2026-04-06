'use client'

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Employee } from "@/lib/types"
import { Mail, Phone, MessageCircle } from "lucide-react"
import { EditEmployeeDialog } from "@/components/edit-employee-dialog"
import { DeleteEmployeeButton } from "@/components/delete-employee-button"

interface EmployeeCardProps {
  employee: Employee
}

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '')
    const whatsappUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}`
    window.open(whatsappUrl, '_blank')
  }

  return (
    <Card>
      {employee.photo_url && (
        <div className="w-full h-48 bg-slate-200 overflow-hidden">
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
          {employee.phone && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-2 text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
              onClick={() => openWhatsApp(employee.phone!)}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          )}
          <EditEmployeeDialog employee={employee} />
          <DeleteEmployeeButton employeeId={employee.id} employeeName={employee.name} />
        </div>
      </CardContent>
    </Card>
  )
}
