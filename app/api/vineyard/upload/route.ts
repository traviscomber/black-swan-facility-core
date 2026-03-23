import { uploadImage, uploadExcelFile } from "@/lib/vineyard/file-operations"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const folder = formData.get("folder") as string
    const fileType = formData.get("fileType") as string // "image" or "excel"

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
      result = await uploadImage(file, `vineyard/${folder}`)
    } else if (fileType === "excel") {
      result = await uploadExcelFile(file, `vineyard/${folder}`)
    } else {
      return NextResponse.json(
        { error: "Invalid file type. Use 'image' or 'excel'" },
        { status: 400 }
      )
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
