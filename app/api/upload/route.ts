import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the file from the request body
    const file = await request.blob()

    // Get pathname from query params or headers (sent as metadata)
    const pathname = request.nextUrl.searchParams.get("path") || 
                     request.headers.get("x-file-path") || 
                     `employees/${Date.now()}`

    console.log("[v0] Uploading file to path:", pathname)

    // Upload to Supabase Storage with proper error handling
    const { data, error } = await supabase.storage
      .from("facility-photos")
      .upload(pathname, file, {
        contentType: request.headers.get("content-type") || "image/jpeg",
        upsert: true,
      })

    if (error) {
      console.error("[v0] Upload error:", error)
      return NextResponse.json(
        { error: error.message || "Upload failed" },
        { status: 400 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("facility-photos")
      .getPublicUrl(data.path)

    console.log("[v0] File uploaded successfully:", urlData.publicUrl)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error) {
    console.error("[v0] Upload API error:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}
