"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface DeleteEmployeeButtonProps {
  employeeId: string
  employeeName: string
}

export function DeleteEmployeeButton({ employeeId, employeeName }: DeleteEmployeeButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)

  async function handleDeactivate() {
    setIsUpdating(true)
    const supabase = createBrowserClient()
    const { error } = await supabase.from("employees").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", employeeId)
    if (error) {
      toast({ title: "No fue posible desactivar", description: error.message, variant: "destructive" })
      setIsUpdating(false)
      return
    }
    toast({ title: "Persona desactivada", description: `${employeeName} se mantiene en el historial, pero ya no figura como activa.` })
    setIsUpdating(false)
    router.refresh()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="flex-1 gap-1 bg-transparent text-muted-foreground"><UserMinus className="h-4 w-4" />Desactivar</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desactivar a {employeeName}</AlertDialogTitle>
          <AlertDialogDescription>La persona dejará de aparecer como activa, pero el registro se conservará para mantener trazabilidad. Puede reactivarse desde Editar.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeactivate} disabled={isUpdating}>{isUpdating ? "Actualizando…" : "Desactivar"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
