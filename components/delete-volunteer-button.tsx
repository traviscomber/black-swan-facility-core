"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Trash2 } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface DeleteVolunteerButtonProps {
  volunteerId: string
  volunteerName: string
}

const COPY = {
  en: {
    action: "Delete",
    title: "Delete volunteer",
    description: (name: string) => `Are you sure you want to delete ${name}? This action cannot be undone.`,
    cancel: "Cancel",
    deleting: "Deleting…",
    failure: "Failed to delete volunteer",
  },
  es: {
    action: "Eliminar",
    title: "Eliminar voluntario",
    description: (name: string) => `¿Seguro que quieres eliminar a ${name}? Esta acción no se puede deshacer.`,
    cancel: "Cancelar",
    deleting: "Eliminando…",
    failure: "No se pudo eliminar al voluntario",
  },
  de: {
    action: "Löschen",
    title: "Freiwillige Person löschen",
    description: (name: string) => `Möchtest du ${name} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
    cancel: "Abbrechen",
    deleting: "Wird gelöscht…",
    failure: "Freiwillige Person konnte nicht gelöscht werden",
  },
} as const

export function DeleteVolunteerButton({ volunteerId, volunteerName }: DeleteVolunteerButtonProps) {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = COPY[language]
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.from("volunteers").delete().eq("id", volunteerId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error("Error deleting volunteer:", error)
      alert(copy.failure)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1 border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="mr-1 h-4 w-4" />
          {copy.action}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description(volunteerName)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isDeleting ? copy.deleting : copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
