import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VINEYARD_BUCKET = "vineyard-files"
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
const EXCEL_EXTENSIONS = [".xlsx", ".xls", ".csv"]
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function uploadImage(
  file: File,
  folder: string
): Promise<{ url: string; path: string }> {
  if (!file) throw new Error("No file provided")

  const fileExt = file.name.split(".").pop()?.toLowerCase()
  if (!fileExt || !IMAGE_EXTENSIONS.includes(`.${fileExt}`)) {
    throw new Error("Invalid image file type")
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 50MB limit")
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
  const filePath = `${folder}/${fileName}`

  const { data, error } = await supabase.storage
    .from(VINEYARD_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data: publicData } = supabase.storage
    .from(VINEYARD_BUCKET)
    .getPublicUrl(filePath)

  return {
    url: publicData.publicUrl,
    path: filePath,
  }
}

export async function uploadExcelFile(
  file: File,
  folder: string
): Promise<{ url: string; path: string }> {
  if (!file) throw new Error("No file provided")

  const fileExt = file.name.split(".").pop()?.toLowerCase()
  if (!fileExt || !EXCEL_EXTENSIONS.includes(`.${fileExt}`)) {
    throw new Error("Invalid file type. Use .xlsx, .xls, or .csv")
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 50MB limit")
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
  const filePath = `${folder}/${fileName}`

  const { data, error } = await supabase.storage
    .from(VINEYARD_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data: publicData } = supabase.storage
    .from(VINEYARD_BUCKET)
    .getPublicUrl(filePath)

  return {
    url: publicData.publicUrl,
    path: filePath,
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(VINEYARD_BUCKET)
    .remove([filePath])

  if (error) throw new Error(`Delete failed: ${error.message}`)
}
