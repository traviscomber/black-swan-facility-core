"use client"

import { useState } from "react"
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
} from "@/components/ui/alert-dialog"
import { createBrowserClient } from "@/lib/supabase/client"
import { Trash2 } from "lucide-react"

interface DeleteAssetButtonProps {
  assetId: string
  assetName: string
  onDeleted: () => void
}

export function DeleteAssetButton({ assetId, assetName, onDeleted }: DeleteAssetButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.from("assets").delete().eq("id", assetId)

      if (error) throw error

      onDeleted()
      setShowDialog(false)
    } catch (err) {
      console.error("Error deleting asset:", err)
      alert("Failed to delete asset. It may be referenced by other records.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{assetName}"? This action cannot be undone and may affect related records
              like maintenance tasks and issues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
