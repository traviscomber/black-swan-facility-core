import { createHmac, timingSafeEqual } from "node:crypto"

type PublicGuestAccessPayload = {
  v: 1
  locationId: string
  deviceId: string
  exp: number
}

function getSecret() {
  const secret = process.env.GUEST_REQUEST_QR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Guest request QR signing secret is unavailable")
  return secret
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url")
}

export function createPublicGuestAccessToken(locationId: string, deviceId: string, ttlSeconds = 7 * 24 * 60 * 60) {
  const payload: PublicGuestAccessPayload = {
    v: 1,
    locationId,
    deviceId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const encodedPayload = encode(JSON.stringify(payload))
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function verifyPublicGuestAccessToken(token: string): PublicGuestAccessPayload | null {
  const [encodedPayload, suppliedSignature] = token.split(".")
  if (!encodedPayload || !suppliedSignature) return null

  const expectedSignature = sign(encodedPayload)
  const expected = Buffer.from(expectedSignature)
  const supplied = Buffer.from(suppliedSignature)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as PublicGuestAccessPayload
    if (payload.v !== 1 || !payload.locationId || !payload.deviceId || !payload.exp) return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
