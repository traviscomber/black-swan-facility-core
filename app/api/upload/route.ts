import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const file = await request.blob()
    const pathname = request.nextUrl.searchParams.get("path") || 
                     request.headers.get("x-file-path") || 
                     `employees/${Date.now()}`

    console.log("[v0] Uploading file to path:", pathname)

    // Get Supabase credentials from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase credentials")
    }

    // Use service role key to bypass RLS
    const uploadUrl = `${supabaseUrl}/storage/v1/object/facility-photos/${pathname}`
    
    console.log("[v0] Upload URL:", uploadUrl.replace(supabaseServiceRoleKey, "***"))

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        "Content-Type": request.headers.get("content-type") || "image/jpeg",
      },
      body: file,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] Upload failed:", response.status, errorBody)
      throw new Error(`Upload failed: ${response.status} ${errorBody}`)
    }

    console.log("[v0] File uploaded successfully to:", pathname)

    // Return public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/facility-photos/${pathname}`
    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error("[v0] Upload API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 500 }
    )
  }
}
