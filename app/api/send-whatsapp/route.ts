import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { to, message } = await request.json()

    // Format phone number (ensure it includes country code without + symbol for WhatsApp Web)
    let phoneNumber = to.replace(/\D/g, "") // Remove non-digits

    // Add Chile country code if not present
    if (!phoneNumber.startsWith("56")) {
      phoneNumber = `56${phoneNumber}`
    }

    // Generate WhatsApp Web URL
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`

    console.log("[v0] WhatsApp Web URL generated for:", phoneNumber)

    return NextResponse.json({
      success: true,
      whatsappUrl,
      phoneNumber,
    })
  } catch (error) {
    console.error("[v0] Error generating WhatsApp URL:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
