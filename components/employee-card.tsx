'use client'

import { Mail, MessageCircle, Phone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Employee } from "@/lib/types"
import { EditEmployeeDialog } from "@/components/edit-employee-dialog"
import { DeleteEmployeeButton } from "@/components/delete-employee-button"
import { useLanguage } from "@/lib/hooks/use-language"

interface EmployeeCardProps {
  employee: Employee
}

const COPY = {
  en: { rolePending: "Role not recorded", active: "Active", inactive: "Inactive", noEmail: "Email not recorded", noPhone: "Phone not recorded", historical: "Historical record. It can be reactivated from Edit." },
  es: { rolePending: "Función pendiente de registrar", active: "Activa", inactive: "Inactiva", noEmail: "Correo no registrado", noPhone: "Teléfono no registrado", historical: "Registro histórico. Puede reactivarse desde Editar." },
  de: { rolePending: "Rolle nicht erfasst", active: "Aktiv", inactive: "Inaktiv", noEmail: "E-Mail nicht erfasst", noPhone: "Telefon nicht erfasst", historical: "Historischer Datensatz. Er kann über Bearbeiten reaktiviert werden." },
} as const

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const { language } = useLanguage()
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en

  function openWhatsApp(phone: string) {
    const cleanPhone = phone.replace(/\D/g, "")
    window.open(`https://wa.me/${cleanPhone}`, "_blank", "noopener,noreferrer")
  }

  return (
    <Card className={!employee.is_active ? "opacity-70" : undefined}>
      {employee.photo_url && <div className="h-44 w-full overflow-hidden border-b bg-muted"><img src={employee.photo_url} alt={employee.name} className="h-full w-full object-cover" /></div>}
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1"><h3 className="truncate font-semibold text-foreground">{employee.name.trim()}</h3><p className="mt-1 text-sm text-muted-foreground">{employee.role?.trim() || copy.rolePending}</p></div>
          <Badge variant="outline" className={employee.is_active ? "border-primary/30" : "border-muted-foreground/30 text-muted-foreground"}>{employee.is_active ? copy.active : copy.inactive}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="min-h-16 space-y-2">
          {employee.email ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4 shrink-0" /><a href={`mailto:${employee.email}`} className="truncate hover:text-foreground hover:underline">{employee.email}</a></div> : <p className="text-xs text-muted-foreground">{copy.noEmail}</p>}
          {employee.phone ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4 shrink-0" /><a href={`tel:${employee.phone}`} className="hover:text-foreground hover:underline">{employee.phone}</a></div> : <p className="text-xs text-muted-foreground">{copy.noPhone}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {employee.phone && <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => openWhatsApp(employee.phone!)}><MessageCircle className="h-4 w-4" />WhatsApp</Button>}
          <EditEmployeeDialog employee={employee} />
          {employee.is_active && <DeleteEmployeeButton employeeId={employee.id} employeeName={employee.name.trim()} />}
        </div>
        {!employee.is_active && <p className="text-xs text-muted-foreground">{copy.historical}</p>}
      </CardContent>
    </Card>
  )
}
