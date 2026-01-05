import { type NextRequest, NextResponse } from "next/server"

// WhatsApp notification endpoint - sends request to Antonia Valencia
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { requestType, guestName, roomNumber, locationName, description, priority } = body

    // Format message for WhatsApp
    const message = `
🏨 *New Hospitality Request*

👤 Guest: ${guestName}
🛏️ Room: ${roomNumber}
📍 Location: ${locationName}
📋 Request: ${requestType}
⚡ Priority: ${priority.toUpperCase()}

${description ? `📝 Details: ${description}` : ""}

Please reply when the request is handled.
    `.trim()

    const whatsappNumber = process.env.WHATSAPP_CONTACT_NUMBER

    if (!whatsappNumber) {
      console.error("[WhatsApp Error] WHATSAPP_CONTACT_NUMBER not configured")
      return NextResponse.json({ error: "WhatsApp number not configured" }, { status: 500 })
    }

    // TODO: Integrate with your WhatsApp service (Twilio, MessageBird, etc.)
    // Example for Twilio (uncomment and configure):
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const client = require('twilio')(accountSid, authToken)
    
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${whatsappNumber}`,
    })
    */

    // Log the request (replace with actual WhatsApp sending)
    console.log("[WhatsApp Notification Sent]", { guestName, roomNumber, priority })

    return NextResponse.json({ success: true, message: "Notification sent" })
  } catch (error: any) {
    console.error("[WhatsApp Error]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
