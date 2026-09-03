export type GreenApiConfig = {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export type GreenApiState =
  | "authorized"
  | "notAuthorized"
  | "blocked"
  | "sleepMode"
  | "starting"
  | "suspended"
  | "yellowCard"
  | string

export type GreenApiSendResult = {
  idMessage: string
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

export function getGreenApiConfig(): GreenApiConfig {
  return {
    apiUrl: (process.env.GREEN_API_API_URL?.trim() || "https://api.green-api.com").replace(/\/$/, ""),
    idInstance: requiredEnv("GREEN_API_ID_INSTANCE"),
    apiTokenInstance: requiredEnv("GREEN_API_TOKEN_INSTANCE"),
  }
}

export function normalizeGreenApiChatId(phone: string) {
  const rawDigits = phone.replace(/\D/g, "").replace(/^0+/, "")
  const digits = /^9\d{8}$/.test(rawDigits) ? `56${rawDigits}` : rawDigits
  if (!/^569\d{8}$/.test(digits)) {
    throw new Error(`Invalid Chile mobile number for WhatsApp: ${phone}`)
  }
  return `${digits}@c.us`
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text()
  let parsed: unknown = null
  try {
    parsed = body ? JSON.parse(body) : null
  } catch {
    parsed = body
  }
  if (!response.ok) {
    const detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed)
    throw new Error(`GreenAPI ${response.status}: ${detail}`)
  }
  return parsed as T
}

export async function getGreenApiState(config = getGreenApiConfig()): Promise<GreenApiState> {
  const response = await fetch(
    `${config.apiUrl}/waInstance${config.idInstance}/getStateInstance/${config.apiTokenInstance}`,
    { method: "GET", cache: "no-store", signal: AbortSignal.timeout(10_000) },
  )
  const data = await parseJsonResponse<{ stateInstance?: string }>(response)
  return data.stateInstance ?? "unknown"
}

export async function sendGreenApiText(
  phone: string,
  message: string,
  config = getGreenApiConfig(),
): Promise<GreenApiSendResult> {
  const response = await fetch(
    `${config.apiUrl}/waInstance${config.idInstance}/sendMessage/${config.apiTokenInstance}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatId: normalizeGreenApiChatId(phone), message }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  )
  return parseJsonResponse<GreenApiSendResult>(response)
}
