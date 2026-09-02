"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/hooks/use-language"

interface DeleteEmployeeButtonProps {
  employeeId: string
  employeeName: string
}

const COPY = {
  en: { action:"Deactivate", title:"Deactivate", description:"The person will stop appearing as active, but the record will be retained for traceability. It can be reactivated from Edit.", cancel:"Cancel", updating:"Updating…", failed:"Could not deactivate", done:"Person deactivated", doneDescription:"remains in history but is no longer shown as active." },
  es: { action:"Desactivar", title:"Desactivar a", description:"La persona dejará de aparecer como activa, pero el registro se conservará para mantener trazabilidad. Puede reactivarse desde Editar.", cancel:"Cancelar", updating:"Actualizando…", failed:"No fue posible desactivar", done:"Persona desactivada", doneDescription:"se mantiene en el historial, pero ya no figura como activa." },
  de: { action:"Deaktivieren", title:"Deaktivieren", description:"Die Person wird nicht mehr als aktiv angezeigt; der Datensatz bleibt für die Nachverfolgbarkeit erhalten. Er kann über Bearbeiten reaktiviert werden.", cancel:"Abbrechen", updating:"Aktualisieren…", failed:"Deaktivierung nicht möglich", done:"Person deaktiviert", doneDescription:"bleibt im Verlauf erhalten, wird aber nicht mehr als aktiv angezeigt." },
} as const

export function DeleteEmployeeButton({ employeeId, employeeName }: DeleteEmployeeButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { language } = useLanguage()
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en
  const [isUpdating, setIsUpdating] = useState(false)

  async function handleDeactivate() {
    setIsUpdating(true)
    const supabase = createBrowserClient()
    const { error } = await supabase.from("employees").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", employeeId)
    if (error) {
      toast({ title: copy.failed, description: error.message, variant: "destructive" })
      setIsUpdating(false)
      return
    }
    toast({ title: copy.done, description: `${employeeName} ${copy.doneDescription}` })
    setIsUpdating(false)
    router.refresh()
  }

  const title = language === "es" ? `${copy.title} ${employeeName}` : `${copy.title} ${employeeName}`

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="flex-1 gap-1 bg-transparent text-muted-foreground"><UserMinus className="h-4 w-4" />{copy.action}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{copy.cancel}</AlertDialogCancel><AlertDialogAction onClick={handleDeactivate} disabled={isUpdating}>{isUpdating ? copy.updating : copy.action}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
