"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@supabase/ssr"
import { Tag } from "lucide-react"
import { useRouter } from "next/navigation"

interface IssueLabelsSelectorProps {
  issueId: string
}

export function IssueLabelSelector({ issueId }: IssueLabelsSelectorProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [labels, setLabels] = useState<any[]>([])
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      setLoading(true)
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )

        // Fetch all available labels
        const { data: allLabels, error: labelsError } = await supabase
          .from("issue_labels")
          .select("*")
          .eq("is_active", true)

        if (labelsError) {
          console.error("[v0] Error fetching labels:", labelsError.message)
          setLabels([])
          setLoading(false)
          return
        }

        // Fetch currently assigned labels
        const { data: assignedLabels, error: assignedError } = await supabase
          .from("issue_label_assignments")
          .select("label_id")
          .eq("issue_id", issueId)

        if (assignedError) {
          console.error("[v0] Error fetching assigned labels:", assignedError.message)
          setSelectedLabels([])
          setLoading(false)
          return
        }

        setLabels(allLabels || [])
        setSelectedLabels((assignedLabels || []).map((l: any) => l.label_id))
      } catch (error) {
        console.error("[v0] Error loading labels:", error)
        setLabels([])
        setSelectedLabels([])
      }
      setLoading(false)
    }
  }

  const handleLabelToggle = async (labelId: string) => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      if (selectedLabels.includes(labelId)) {
        // Remove label
        const { error } = await supabase
          .from("issue_label_assignments")
          .delete()
          .eq("issue_id", issueId)
          .eq("label_id", labelId)
        if (!error) setSelectedLabels(selectedLabels.filter((id) => id !== labelId))
      } else {
        // Add label
        const { error } = await supabase
          .from("issue_label_assignments")
          .insert({ issue_id: issueId, label_id: labelId })
        if (!error) setSelectedLabels([...selectedLabels, labelId])
      }

      router.refresh()
    } catch (error) {
      console.error("[v0] Error toggling label:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Manage labels">
          <Tag className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Labels</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Loading labels...</p>
          ) : (
            labels.map((label) => (
              <label key={label.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLabels.includes(label.id)}
                  onChange={() => handleLabelToggle(label.id)}
                  className="h-4 w-4"
                />
                <Badge style={{ backgroundColor: label.color }} className="text-white">
                  {label.name}
                </Badge>
                <span className="text-xs text-muted-foreground">{label.description}</span>
              </label>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
