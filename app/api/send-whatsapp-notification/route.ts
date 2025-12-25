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

    // TODO: Integrate with your WhatsApp service (Twilio, MessageBird, etc.)
    // Example for Twilio (uncomment and configure):
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const client = require('twilio')(accountSid, authToken)
    
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:+57XXXXXXXXXXX`, // Antonia's WhatsApp number
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
