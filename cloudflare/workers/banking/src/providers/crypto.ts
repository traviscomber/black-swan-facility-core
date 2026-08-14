const encoder = new TextEncoder()

async function hmacSha256(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

export async function hmacSha256Hex(secret: string, message: string) {
  const signature = await hmacSha256(secret, message)
  return [...signature].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hmacSha256Base64(secret: string, message: string) {
  const signature = await hmacSha256(secret, message)
  let binary = ''
  for (const byte of signature) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const timingSafeEqualHex = timingSafeEqual
