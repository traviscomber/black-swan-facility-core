import { uploadImage, uploadExcelFile } from "@/lib/vineyard/file-operations"
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const folder = formData.get("folder") as string
    const fileType = formData.get("fileType") as string
    const vineId = formData.get("vineId") as string

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    if (!folder) {
      return NextResponse.json(
        { error: "No folder specified" },
        { status: 400 }
      )
    }

    let result
    if (fileType === "image") {
      result = await uploadImage(file, folder)
      
      // Si es una foto de viña y tenemos vineId, actualizar la BD
      if (vineId && folder.includes("vines")) {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          console.warn("[v0] Skipping DB update - Supabase not configured")
        } else {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          )
          console.log("[v0] Updating vine photo in DB for vine:", vineId)
          const { error: dbError } = await supabase
            .from("vineyard_vines")
            .update({ photo_url: result.url })
            .eq("id", vineId)

          if (dbError) {
            console.error("[v0] Error updating vine photo:", dbError)
            // No lanzar error, solo logear - la foto se subió correctamente
          } else {
            console.log("[v0] Vine photo updated in DB successfully")
          }
        }
      }
    } else if (fileType === "excel") {
      result = await uploadExcelFile(file, folder)
    } else {
      return NextResponse.json(
        { error: "Invalid file type. Use 'image' or 'excel'" },
        { status: 400 }
      )
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    console.error("[v0] Upload error:", message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
