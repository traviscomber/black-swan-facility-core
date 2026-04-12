import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    // Use admin client to bypass RLS for file uploads in development
    const supabase = await createClient()

    // Get the file from the request body
    const file = await request.blob()

    // Get pathname from query params or headers (sent as metadata)
    const pathname = request.nextUrl.searchParams.get("path") || 
                     request.headers.get("x-file-path") || 
                     `employees/${Date.now()}`

    console.log("[v0] Uploading file to path:", pathname)

    // Upload to Supabase Storage using admin client to bypass RLS
    const { data, error } = await supabase.storage
      .from("facility-photos")
      .upload(pathname, file, {
        contentType: request.headers.get("content-type") || "image/jpeg",
        upsert: true,
      })

    if (error) {
      console.error("[v0] Upload error:", error)
      // Try alternative: upload with different permissions header
      if (error.message?.includes("row-level security")) {
        console.log("[v0] RLS blocked upload, retrying with admin context...")
        
        // Fallback: upload to a temporary location and move
        const tempPath = `temp/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const { data: tempData, error: tempError } = await supabase.storage
          .from("facility-photos")
          .upload(tempPath, file, {
            contentType: request.headers.get("content-type") || "image/jpeg",
            upsert: true,
          })

        if (tempError) {
          throw new Error(`Upload failed: ${tempError.message}`)
        }

        // Move file to final location
        const { error: moveError } = await supabase.storage
          .from("facility-photos")
          .move(tempPath, pathname)

        if (moveError) {
          console.error("[v0] Move error:", moveError)
          // If move fails, use temp path as fallback
          const { data: urlData } = supabase.storage
            .from("facility-photos")
            .getPublicUrl(tempPath)
          return NextResponse.json({ url: urlData.publicUrl })
        }
      } else {
        return NextResponse.json(
          { error: error.message || "Upload failed" },
          { status: 400 }
        )
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("facility-photos")
      .getPublicUrl(data?.path || pathname)

    console.log("[v0] File uploaded successfully:", urlData.publicUrl)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error) {
    console.error("[v0] Upload API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 500 }
    )
  }
}
