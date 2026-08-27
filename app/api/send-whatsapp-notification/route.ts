import { type NextRequest, NextResponse } from "next/server"

function textField(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const requestType = textField(body.requestType)
    const guestName = textField(body.guestName)
    const roomNumber = textField(body.roomNumber)
    const locationName = textField(body.locationName)
    const priority = textField(body.priority)

    if (!requestType || !guestName || !roomNumber || !locationName || !priority) {
      return NextResponse.json(
        {
          success: false,
          status: "invalid_request",
          error: "requestType, guestName, roomNumber, locationName and priority are required",
        },
        { status: 400 },
      )
    }

    const whatsappNumber = process.env.WHATSAPP_CONTACT_NUMBER
    if (!whatsappNumber) {
      console.error("[WhatsApp Notification] WHATSAPP_CONTACT_NUMBER is not configured")
      return NextResponse.json(
        {
          success: false,
          status: "not_configured",
          error: "Automated WhatsApp delivery is not configured",
        },
        { status: 503 },
      )
    }

    console.warn("[WhatsApp Notification] Automated provider is not configured; delivery was not attempted", {
      guestName,
      roomNumber,
      priority,
    })

    return NextResponse.json(
      {
        success: false,
        status: "manual_required",
        error: "Automated WhatsApp delivery is unavailable. Use the manual WhatsApp flow instead.",
      },
      { status: 501 },
    )
  } catch (error) {
    console.error("[WhatsApp Notification] Request failed", error)
    return NextResponse.json(
      {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
