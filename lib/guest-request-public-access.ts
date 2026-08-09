import { createHmac, timingSafeEqual } from "node:crypto"

type LocationGuestAccessPayload = {
  v: 1
  locationId: string
  deviceId: string
  exp: number
}

type GlobalGuestAccessPayload = {
  v: 2
  scope: "global"
  exp: number
}

export type PublicGuestAccessPayload = LocationGuestAccessPayload | GlobalGuestAccessPayload

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
  const payload: LocationGuestAccessPayload = {
    v: 1,
    locationId,
    deviceId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const encodedPayload = encode(JSON.stringify(payload))
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function createGlobalGuestAccessToken() {
  const year = new Date().getUTCFullYear()
  const payload: GlobalGuestAccessPayload = {
    v: 2,
    scope: "global",
    exp: Math.floor(Date.UTC(year + 1, 0, 1) / 1000),
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
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null

    if (payload.v === 1) {
      if (!payload.locationId || !payload.deviceId) return null
      return payload
    }

    if (payload.v === 2 && payload.scope === "global") return payload
    return null
  } catch {
    return null
  }
}
