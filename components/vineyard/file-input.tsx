"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react"

interface FileInputProps {
  onFileSelect: (file: File, fileType: "image" | "excel") => void
  accept: "image/*" | ".xlsx,.xls,.csv"
  fileType: "image" | "excel"
  label: string
  disabled?: boolean
}

export function FileInput({
  onFileSelect,
  accept,
  fileType,
  label,
  disabled,
}: FileInputProps) {
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError("")
    setFileName("")

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      setError("File size exceeds 50MB limit")
      return
    }

    // Validate file type
    if (fileType === "image") {
      const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
      if (!validImageTypes.includes(file.type)) {
        setError("Invalid image format. Use JPG, PNG, GIF, or WebP")
        return
      }
    } else if (fileType === "excel") {
      const validExcelTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
      ]
      if (!validExcelTypes.includes(file.type)) {
        setError("Invalid file format. Use .xlsx, .xls, or .csv")
        return
      }
    }

    setFileName(file.name)
    onFileSelect(file, fileType)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          disabled={disabled || loading}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || loading}
          className="flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Choose File
            </>
          )}
        </Button>
      </div>

      {fileName && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          {fileName}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}
